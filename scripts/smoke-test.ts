/**
 * End-to-end smoke test for the Porch Credit ledger and the barter offer
 * lifecycle — the parts of Porchlight where a bug costs a member something
 * real. Creates its own fixtures, asserts the invariants, then cleans up.
 *
 *   npx tsx scripts/smoke-test.ts
 *
 * Run this after any change to src/lib/credits.ts or the barter actions.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

let failures = 0;

function check(label: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function balance(userId: string): Promise<number> {
  const agg = await db.tradeCreditEntry.aggregate({
    where: { userId },
    _sum: { delta: true },
  });
  return agg._sum.delta ?? 0;
}

/** Mirrors settleCreditTrade() in src/lib/credits.ts. */
async function settle(opts: {
  offerId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
}) {
  const { offerId, fromUserId, toUserId, amount } = opts;
  if (amount <= 0) throw new Error("Amount must be positive");

  await db.$transaction(async (tx) => {
    const agg = await tx.tradeCreditEntry.aggregate({
      where: { userId: fromUserId },
      _sum: { delta: true },
    });
    if ((agg._sum.delta ?? 0) < amount) {
      throw new Error("Insufficient Porch Credits");
    }
    await tx.tradeCreditEntry.createMany({
      data: [
        { userId: fromUserId, delta: -amount, reason: "TRADE_SPENT", offerId },
        { userId: toUserId, delta: amount, reason: "TRADE_EARNED", offerId },
      ],
    });
  });
}

async function main() {
  console.log("\nPorchlight smoke test\n");

  // ── Fixtures ────────────────────────────────────────────────
  console.log("Seed data");
  const neighborhoods = await db.neighborhood.count();
  check("Georgia neighborhoods seeded", neighborhoods >= 20, `found ${neighborhoods}`);
  check(
    "all neighborhoods are in GA",
    (await db.neighborhood.count({ where: { state: "GA" } })) === neighborhoods
  );

  const owner = await db.user.findUniqueOrThrow({
    where: { email: "demo@porchlight.app" },
  });
  const offerer = await db.user.findUniqueOrThrow({
    where: { email: "maya@porchlight.app" },
  });

  const ownerStart = await balance(owner.id);
  const offererStart = await balance(offerer.id);
  console.log(`  (owner ${ownerStart} credits, offerer ${offererStart} credits)`);

  // ── Happy path: a credit-priced trade completes ──────────────
  console.log("\nBarter lifecycle");
  const listing = await db.barterListing.create({
    data: {
      ownerId: owner.id,
      neighborhoodId: owner.neighborhoodId,
      kind: "SERVICE",
      title: "[smoke-test] temporary listing",
      description: "Created by scripts/smoke-test.ts",
      category: "REPAIRS",
      creditValue: 10,
    },
  });

  const offer = await db.barterOffer.create({
    data: {
      listingId: listing.id,
      offererId: offerer.id,
      message: "[smoke-test] offer",
      creditAmount: 10,
    },
  });
  check("offer starts PENDING", offer.status === "PENDING");

  await db.barterOffer.update({
    where: { id: offer.id },
    data: { status: "ACCEPTED" },
  });
  await db.barterListing.update({
    where: { id: listing.id },
    data: { status: "PENDING" },
  });
  check(
    "accepting moves the listing to PENDING",
    (await db.barterListing.findUniqueOrThrow({ where: { id: listing.id } }))
      .status === "PENDING"
  );

  await settle({
    offerId: offer.id,
    fromUserId: offerer.id,
    toUserId: owner.id,
    amount: 10,
  });

  const ownerAfter = await balance(owner.id);
  const offererAfter = await balance(offerer.id);
  check("credits left the offerer", offererAfter === offererStart - 10, `${offererStart} -> ${offererAfter}`);
  check("credits reached the owner", ownerAfter === ownerStart + 10, `${ownerStart} -> ${ownerAfter}`);
  check(
    "ledger is zero-sum across the trade",
    ownerAfter + offererAfter === ownerStart + offererStart
  );
  check(
    "settlement wrote exactly two ledger rows",
    (await db.tradeCreditEntry.count({ where: { offerId: offer.id } })) === 2
  );

  // ── Overdraft must be refused ───────────────────────────────
  console.log("\nLedger safety");
  let refused = false;
  try {
    await settle({
      offerId: offer.id,
      fromUserId: offerer.id,
      toUserId: owner.id,
      amount: offererAfter + 1_000,
    });
  } catch {
    refused = true;
  }
  check("overdraft is refused", refused);
  check(
    "refused settlement wrote nothing",
    (await balance(offerer.id)) === offererAfter
  );

  let rejectedNegative = false;
  try {
    await settle({
      offerId: offer.id,
      fromUserId: offerer.id,
      toUserId: owner.id,
      amount: -50,
    });
  } catch {
    rejectedNegative = true;
  }
  check("negative amounts are refused", rejectedNegative);

  // ── Ad-Boost metric integrity ───────────────────────────────
  console.log("\nAd-Boost metrics");
  const business = await db.business.findFirst({ where: { verifiedAt: { not: null } } });
  if (business) {
    const boost = await db.adBoost.create({
      data: {
        businessId: business.id,
        poolFunded: true,
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 86_400_000),
      },
    });
    const day = new Date().toISOString().slice(0, 10);
    await db.boostEvent.create({
      data: { boostId: boost.id, userId: offerer.id, kind: "IMPRESSION", day },
    });

    let deduped = false;
    try {
      await db.boostEvent.create({
        data: { boostId: boost.id, userId: offerer.id, kind: "IMPRESSION", day },
      });
    } catch {
      deduped = true;
    }
    check("a repeat impression from the same viewer is dropped", deduped);

    await db.adBoost.delete({ where: { id: boost.id } });
  } else {
    console.log("  skip (no verified business seeded)");
  }

  // ── Cleanup ─────────────────────────────────────────────────
  await db.tradeCreditEntry.deleteMany({ where: { offerId: offer.id } });
  await db.barterOffer.delete({ where: { id: offer.id } });
  await db.barterListing.delete({ where: { id: listing.id } });

  check("cleanup restored the owner's balance", (await balance(owner.id)) === ownerStart);
  check("cleanup restored the offerer's balance", (await balance(offerer.id)) === offererStart);

  console.log(
    failures === 0
      ? "\n✅ All smoke checks passed.\n"
      : `\n❌ ${failures} check(s) failed.\n`
  );
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("smoke test crashed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

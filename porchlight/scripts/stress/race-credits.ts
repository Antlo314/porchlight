/**
 * Concurrency safety test for the money-like paths.
 *
 *   npx tsx scripts/stress/race-credits.ts
 *
 * Every check here targets a read-then-write sequence that looks correct in
 * isolation but can be interleaved by two simultaneous requests. These are the
 * bugs that don't show up until two neighbors tap at the same moment, and the
 * ones that cost someone something real when they do.
 *
 * Creates its own fixtures prefixed [race] and deletes them at the end.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (ok) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function balance(userId: string) {
  const agg = await db.tradeCreditEntry.aggregate({
    where: { userId },
    _sum: { delta: true },
  });
  return agg._sum.delta ?? 0;
}

/** Exact copy of settleCreditTrade() from src/lib/credits.ts. */
async function settle(opts: {
  offerId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
}) {
  const { offerId, fromUserId, toUserId, amount } = opts;
  if (amount <= 0) throw new Error("Amount must be positive");

  await db.$transaction(async (tx) => {
    // Row lock first — see the comment in src/lib/credits.ts.
    await tx.user.update({
      where: { id: fromUserId },
      data: { updatedAt: new Date() },
    });

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
  console.log("\nPorchlight concurrency stress test\n");

  const hood = await db.neighborhood.findFirstOrThrow();
  const spender = await db.user.create({
    data: {
      email: `race-spender-${Date.now()}@example.test`,
      name: "[race] Spender",
      passwordHash: "x",
      neighborhoodId: hood.id,
    },
  });
  const receiver = await db.user.create({
    data: {
      email: `race-receiver-${Date.now()}@example.test`,
      name: "[race] Receiver",
      passwordHash: "x",
      neighborhoodId: hood.id,
    },
  });

  const START = 100;
  await db.tradeCreditEntry.create({
    data: { userId: spender.id, delta: START, reason: "ADJUSTMENT" },
  });

  const listing = await db.barterListing.create({
    data: {
      ownerId: receiver.id,
      neighborhoodId: hood.id,
      kind: "SERVICE",
      title: "[race] listing",
      description: "concurrency fixture",
      category: "OTHER",
      creditValue: 20,
    },
  });
  const offer = await db.barterOffer.create({
    data: {
      listingId: listing.id,
      offererId: spender.id,
      message: "[race] offer",
      creditAmount: 20,
    },
  });

  // ── 1. Double-spend ─────────────────────────────────────────
  // 10 simultaneous settlements of 20 against a 100-credit balance.
  // At most 5 may succeed; the balance must never go negative.
  console.log("Double-spend under concurrency (10 x 20 credits vs 100 balance)");
  const attempts = await Promise.allSettled(
    Array.from({ length: 10 }, () =>
      settle({
        offerId: offer.id,
        fromUserId: spender.id,
        toUserId: receiver.id,
        amount: 20,
      })
    )
  );
  const ok = attempts.filter((a) => a.status === "fulfilled").length;
  const spenderEnd = await balance(spender.id);
  const receiverEnd = await balance(receiver.id);

  console.log(`  ${ok}/10 settlements succeeded, spender ended at ${spenderEnd}`);
  check("balance never went negative", spenderEnd >= 0, `ended at ${spenderEnd}`);
  check("no more than 5 settlements succeeded", ok <= 5, `${ok} succeeded`);
  check(
    "credits are conserved (nothing minted)",
    spenderEnd + receiverEnd === START,
    `${spenderEnd} + ${receiverEnd} != ${START}`
  );
  check(
    "spend matches what was received",
    receiverEnd === START - spenderEnd,
    `received ${receiverEnd}, spender down ${START - spenderEnd}`
  );

  // ── 2. Double-accept on one listing ─────────────────────────
  console.log("\nDouble-accept on a single listing");
  const listing2 = await db.barterListing.create({
    data: {
      ownerId: receiver.id,
      neighborhoodId: hood.id,
      kind: "GOODS",
      title: "[race] contested listing",
      description: "concurrency fixture",
      category: "OTHER",
    },
  });
  const rivals = await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      db.barterOffer.create({
        data: {
          listingId: listing2.id,
          offererId: spender.id,
          message: `[race] rival offer ${i}`,
          offeredItemDesc: "a thing",
        },
      })
    )
  );

  // Mirrors the accept path: only accept while the listing is still OPEN.
  await Promise.allSettled(
    rivals.map((r) =>
      db.$transaction(async (tx) => {
        const current = await tx.barterListing.findUniqueOrThrow({
          where: { id: listing2.id },
        });
        if (current.status !== "OPEN") throw new Error("Already taken");
        await tx.barterOffer.update({
          where: { id: r.id },
          data: { status: "ACCEPTED" },
        });
        await tx.barterListing.update({
          where: { id: listing2.id },
          data: { status: "PENDING" },
        });
      })
    )
  );

  const accepted = await db.barterOffer.count({
    where: { listingId: listing2.id, status: "ACCEPTED" },
  });
  console.log(`  ${accepted} offer(s) reached ACCEPTED`);
  check("at most one offer was accepted", accepted <= 1, `${accepted} accepted`);

  // ── 3. Reaction toggle storm ────────────────────────────────
  console.log("\nReaction toggle storm (unique constraint)");
  const post = await db.post.create({
    data: {
      authorId: receiver.id,
      neighborhoodId: hood.id,
      type: "GENERAL",
      body: "[race] post",
    },
  });
  await Promise.allSettled(
    Array.from({ length: 12 }, () =>
      db.reaction.upsert({
        where: { userId_postId: { userId: spender.id, postId: post.id } },
        update: { kind: "LIKE" },
        create: { userId: spender.id, postId: post.id, kind: "LIKE" },
      })
    )
  );
  const reactions = await db.reaction.count({ where: { postId: post.id } });
  check("one member produced exactly one reaction row", reactions === 1, `${reactions} rows`);

  // ── Cleanup ─────────────────────────────────────────────────
  await db.reaction.deleteMany({ where: { postId: post.id } });
  await db.post.delete({ where: { id: post.id } });
  await db.tradeCreditEntry.deleteMany({
    where: { userId: { in: [spender.id, receiver.id] } },
  });
  await db.barterOffer.deleteMany({
    where: { listingId: { in: [listing.id, listing2.id] } },
  });
  await db.barterListing.deleteMany({
    where: { id: { in: [listing.id, listing2.id] } },
  });
  await db.user.deleteMany({ where: { id: { in: [spender.id, receiver.id] } } });

  console.log(
    failures === 0
      ? "\n✅ No concurrency defects found.\n"
      : `\n❌ ${failures} concurrency defect(s).\n`
  );
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("race test crashed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

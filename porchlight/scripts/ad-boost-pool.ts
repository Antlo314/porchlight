/**
 * Ad-Boost Pool — monthly payout run.
 *
 *   npx tsx scripts/ad-boost-pool.ts            # create the boosts
 *   npx tsx scripts/ad-boost-pool.ts --dry-run  # print the plan, write nothing
 *   npx tsx scripts/ad-boost-pool.ts --days=14  # shorter boost window
 *
 * This is the "we pay for your ads" promise, operationalized. Every month:
 *
 *   1. Sum the monthly price of every ACTIVE paid subscription.
 *   2. Take AD_BOOST_POOL_SHARE (20%) of it — that's the pool.
 *   3. Find businesses that are verified AND average >= AD_BOOST_MIN_RATING.
 *   4. Split the pool evenly and give each one a poolFunded AdBoost row
 *      spanning the next 30 days.
 *
 * Eligibility is deliberately plan-blind: a Free-plan business that neighbors
 * genuinely rate highly gets bought advertising, funded by the businesses on
 * paid plans. That's the inversion of pay-to-play the product is built on.
 *
 * Note on money: AdBoost has no budget column (see prisma/schema.prisma), so
 * the per-business allocation is reported here for the books rather than
 * stored on the row. When Stripe goes live, replace the PLAN_META revenue
 * estimate below with actually-collected revenue — see the comment block in
 * src/app/(app)/business/pricing/actions.ts.
 *
 * Safe to re-run: a business that already has a pool-funded boost overlapping
 * the target window is skipped, so a double-run can't double-pay anyone.
 */
import { db } from "../src/lib/db";
import {
  AD_BOOST_MIN_RATING,
  AD_BOOST_POOL_SHARE,
  PLAN_META,
  type PlanValue,
} from "../src/lib/validators";

const DAY_MS = 24 * 60 * 60 * 1000;

type Args = { dryRun: boolean; days: number };

function parseArgs(argv: string[]): Args {
  const dryRun = argv.includes("--dry-run");
  const daysArg = argv.find((a) => a.startsWith("--days="));
  const parsedDays = daysArg ? Number(daysArg.split("=")[1]) : 30;
  const days =
    Number.isFinite(parsedDays) && parsedDays > 0 && parsedDays <= 365
      ? Math.floor(parsedDays)
      : 30;
  return { dryRun, days };
}

function toPlan(raw: string): PlanValue {
  return raw === "LOCAL_PRO" || raw === "FEATURED" ? raw : "FREE";
}

function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

async function main() {
  const { dryRun, days } = parseArgs(process.argv.slice(2));
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + days * DAY_MS);

  console.log("─".repeat(64));
  console.log("Porchlight Ad-Boost Pool");
  console.log(
    `Window: ${startsAt.toDateString()} → ${endsAt.toDateString()} (${days} days)`
  );
  if (dryRun) console.log("MODE:   dry run — nothing will be written");
  console.log("─".repeat(64));

  // ── 1. Pool size ────────────────────────────────────────────────────────
  const paidSubs = await db.subscription.findMany({
    where: { status: "ACTIVE", plan: { not: "FREE" } },
    select: { plan: true },
  });

  const revenueCents = paidSubs.reduce(
    (sum, s) => sum + PLAN_META[toPlan(s.plan)].priceMonthly * 100,
    0
  );
  const poolCents = Math.floor(revenueCents * AD_BOOST_POOL_SHARE);

  const planCounts = paidSubs.reduce<Record<string, number>>((acc, s) => {
    const plan = toPlan(s.plan);
    acc[plan] = (acc[plan] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`\nActive paid subscriptions: ${paidSubs.length}`);
  for (const [plan, count] of Object.entries(planCounts)) {
    console.log(
      `  ${PLAN_META[toPlan(plan)].label.padEnd(10)} ${String(count).padStart(3)} × $${PLAN_META[toPlan(plan)].priceMonthly}/mo`
    );
  }
  console.log(`Monthly subscription revenue: ${usd(revenueCents)}`);
  console.log(
    `Pool (${Math.round(AD_BOOST_POOL_SHARE * 100)}% of revenue): ${usd(poolCents)}`
  );

  if (poolCents <= 0) {
    console.log(
      "\nNo paid subscriptions yet, so there is no pool to spend. Nothing to do."
    );
    return;
  }

  // ── 2. Eligibility: verified + well reviewed ────────────────────────────
  const verified = await db.business.findMany({
    where: { verifiedAt: { not: null } },
    select: {
      id: true,
      name: true,
      reviews: { select: { rating: true } },
      subscription: { select: { plan: true } },
      adBoosts: {
        where: { poolFunded: true, endsAt: { gt: startsAt } },
        select: { id: true, endsAt: true },
      },
    },
  });

  const scored = verified
    .map((b) => ({
      id: b.id,
      name: b.name,
      plan: toPlan(b.subscription?.plan ?? "FREE"),
      reviewCount: b.reviews.length,
      avgRating:
        b.reviews.length > 0
          ? b.reviews.reduce((s, r) => s + r.rating, 0) / b.reviews.length
          : null,
      alreadyBoosted: b.adBoosts.length > 0,
    }))
    .filter((b) => b.avgRating !== null && b.avgRating >= AD_BOOST_MIN_RATING);

  const skipped = scored.filter((b) => b.alreadyBoosted);
  const eligible = scored.filter((b) => !b.alreadyBoosted);

  console.log(
    `\nVerified businesses: ${verified.length} · rated ${AD_BOOST_MIN_RATING.toFixed(1)}★+: ${scored.length}`
  );
  if (skipped.length > 0) {
    console.log(
      `Skipping ${skipped.length} already covered by a live pool boost:`
    );
    for (const b of skipped) console.log(`  – ${b.name}`);
  }

  if (eligible.length === 0) {
    console.log(
      "\nNo business needs a new boost this run. The pool rolls over."
    );
    return;
  }

  // ── 3. Split evenly ─────────────────────────────────────────────────────
  const perBusinessCents = Math.floor(poolCents / eligible.length);
  const remainderCents = poolCents - perBusinessCents * eligible.length;

  console.log(
    `\nSplitting ${usd(poolCents)} across ${eligible.length} business${
      eligible.length === 1 ? "" : "es"
    } → ${usd(perBusinessCents)} each` +
      (remainderCents > 0 ? ` (${usd(remainderCents)} rolls over)` : "")
  );
  console.log("");
  for (const b of eligible) {
    console.log(
      `  ${b.name.padEnd(32).slice(0, 32)} ${b.avgRating!.toFixed(1)}★ ` +
        `${String(b.reviewCount).padStart(3)} rev  ${PLAN_META[b.plan].label.padEnd(9)} ` +
        `→ ${usd(perBusinessCents)}`
    );
  }

  // ── 4. Write the boosts ─────────────────────────────────────────────────
  if (dryRun) {
    console.log("\nDry run: no AdBoost rows written.");
    return;
  }

  await db.adBoost.createMany({
    data: eligible.map((b) => ({
      businessId: b.id,
      poolFunded: true,
      startsAt,
      endsAt,
    })),
  });

  console.log(
    `\n✓ Created ${eligible.length} pool-funded boost${
      eligible.length === 1 ? "" : "es"
    }, live now through ${endsAt.toDateString()}.`
  );
  console.log(
    "  They appear in the Services featured rail tagged “Ad-Boost Pool”."
  );
}

main()
  .catch((error) => {
    console.error("\nAd-Boost Pool run failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });

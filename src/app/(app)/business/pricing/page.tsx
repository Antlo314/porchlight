import Link from "next/link";
import { Callout } from "@/components/business/Callout";
import { PlanPicker } from "@/components/business/PlanPicker";
import { averageRating, toPlan } from "@/components/business/types";
import { Card, SectionHeading } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { pluralize } from "@/lib/format";
import { paidPlansReady, stripeConfigured } from "@/lib/stripe";
import {
  AD_BOOST_MIN_RATING,
  AD_BOOST_POOL_SHARE,
  PLAN_META,
  type PlanValue,
} from "@/lib/validators";

/** Live pool math — the same rules scripts/ad-boost-pool.ts runs on. */
async function adBoostPoolSnapshot() {
  const [paidSubs, verified] = await Promise.all([
    db.subscription.findMany({
      where: { status: "ACTIVE", plan: { not: "FREE" } },
      select: { plan: true },
    }),
    db.business.findMany({
      where: { verifiedAt: { not: null } },
      select: { id: true, reviews: { select: { rating: true } } },
    }),
  ]);

  const monthlyRevenue = paidSubs.reduce(
    (sum, s) => sum + PLAN_META[toPlan(s.plan)].priceMonthly,
    0
  );

  const eligible = verified.filter((b) => {
    const avg = averageRating(b.reviews);
    return avg !== null && avg >= AD_BOOST_MIN_RATING;
  });

  return {
    monthlyRevenue,
    pool: monthlyRevenue * AD_BOOST_POOL_SHARE,
    eligibleCount: eligible.length,
  };
}

export default async function PricingPage() {
  const user = await requireUser();

  const [business, pool] = await Promise.all([
    db.business.findFirst({
      where: { ownerId: user.id },
      select: {
        id: true,
        subscription: {
          select: { plan: true, status: true, stripeSubscriptionId: true },
        },
      },
    }),
    adBoostPoolSnapshot(),
  ]);

  const currentPlan: PlanValue | null = business
    ? business.subscription?.status === "ACTIVE"
      ? toPlan(business.subscription.plan)
      : "FREE"
    : null;

  const poolShareLabel = `${Math.round(AD_BOOST_POOL_SHARE * 100)}%`;

  return (
    <div className="space-y-4">
      <Link
        href={business ? "/business/manage" : "/services"}
        className="inline-flex min-h-11 items-center text-sm font-semibold text-ink-soft"
      >
        ← Back
      </Link>

      <header>
        <h1 className="text-2xl font-bold">Plans for local businesses</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Get found by your actual neighbors. Start free, upgrade only when the
          work is coming in.
        </p>
      </header>

      <Callout>
        <h2 className="font-semibold text-porch-800">Why listing is free</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          Getting found by the neighbors already looking for you shouldn&apos;t
          cost anything up front. On Porchlight, being listed, reviewed, and
          messaged costs{" "}
          <span className="font-semibold text-ink">$0 — permanently</span>.
          Local Pro is <span className="font-semibold text-ink">$19/mo</span>,
          cancel any time, and {poolShareLabel} of every subscription dollar
          goes straight back out as free advertising for well-reviewed
          businesses.
        </p>
      </Callout>

      <PlanPicker
        currentPlan={currentPlan}
        hasBusiness={business !== null}
        checkoutLive={stripeConfigured() && paidPlansReady()}
        billed={Boolean(business?.subscription?.stripeSubscriptionId)}
      />

      <section>
        <SectionHeading title="The Ad-Boost Pool" />
        <Card>
          <p className="text-[15px] leading-relaxed">
            We take{" "}
            <span className="font-semibold">
              {poolShareLabel} of all subscription revenue
            </span>{" "}
            and spend it on featured placement for verified businesses rated{" "}
            <span className="font-semibold">
              {AD_BOOST_MIN_RATING.toFixed(1)}★ or better
            </span>{" "}
            — including businesses on the Free plan. It's the opposite of
            pay-to-play: earn your neighbors' trust and{" "}
            <span className="font-semibold">we buy the ads</span>.
          </p>

          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-card border border-line p-2">
              <dt className="text-xs text-ink-soft">Monthly subs</dt>
              <dd className="text-lg font-bold tabular-nums">
                ${pool.monthlyRevenue}
              </dd>
            </div>
            <div className="rounded-card border border-porch-200 bg-porch-50 p-2">
              <dt className="text-xs text-porch-800">This month's pool</dt>
              <dd className="text-lg font-bold tabular-nums text-porch-800">
                ${pool.pool.toFixed(2)}
              </dd>
            </div>
            <div className="rounded-card border border-line p-2">
              <dt className="text-xs text-ink-soft">Eligible</dt>
              <dd className="text-lg font-bold tabular-nums">
                {pool.eligibleCount}
              </dd>
            </div>
          </dl>

          <p className="mt-3 text-xs text-ink-soft">
            The pool is split evenly across{" "}
            {pool.eligibleCount > 0
              ? pluralize(pool.eligibleCount, "eligible business", "eligible businesses")
              : "every eligible business"}{" "}
            and paid out as 30-day boosts. Boosts bought this way are marked
            &ldquo;Ad-Boost Pool&rdquo; in the directory so neighbors know we
            paid, not the business.
          </p>
        </Card>
      </section>

      {!(stripeConfigured() && paidPlansReady()) && (
        <Callout tone="quiet">
          <h2 className="text-sm font-semibold">Checkout is warming up</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Paid plans need a card. If this note is still here after a refresh,
            Stripe isn&apos;t reaching this deploy yet.
          </p>
        </Callout>
      )}
    </div>
  );
}

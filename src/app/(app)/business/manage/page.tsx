import Link from "next/link";
import { redirect } from "next/navigation";
import { BusinessAnalytics } from "@/components/business/BusinessAnalytics";
import { BusinessLogo } from "@/components/business/BusinessLogo";
import { BusinessProfileEditor } from "@/components/business/BusinessProfileEditor";
import { ServiceListingManager } from "@/components/business/ServiceListingManager";
import {
  averageRating,
  toBusinessCategory,
  toListingStatus,
  toPlan,
  type ServiceListingRow,
} from "@/components/business/types";
import {
  Badge,
  ButtonLink,
  Card,
  SectionHeading,
  Stars,
  VerifiedMark,
} from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseImages } from "@/lib/json";
import { BUSINESS_CATEGORY_META, PLAN_META } from "@/lib/validators";

function formatPeriodEnd(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function ManageBusinessPage() {
  const user = await requireUser();
  const now = new Date();

  const business = await db.business.findFirst({
    where: { ownerId: user.id },
    include: {
      subscription: true,
      services: { orderBy: { createdAt: "desc" } },
      reviews: { select: { rating: true, verifiedJob: true } },
      adBoosts: { select: { startsAt: true, endsAt: true, poolFunded: true } },
    },
  });

  if (!business) redirect("/business/new");

  const category = toBusinessCategory(business.category);
  const meta = BUSINESS_CATEGORY_META[category];

  // A past-due or cancelled subscription falls back to FREE limits, matching
  // what the server actions enforce.
  const subscriptionActive = business.subscription?.status === "ACTIVE";
  const plan = subscriptionActive ? toPlan(business.subscription?.plan) : "FREE";
  const planMeta = PLAN_META[plan];

  const delivery = await db.adBoost.aggregate({
    where: { businessId: business.id },
    _sum: { impressions: true, clicks: true },
  });

  const liveBoosts = business.adBoosts.filter(
    (b) => b.startsAt <= now && b.endsAt >= now
  );

  // `images` has to travel with the row: the edit sheet sends back the full
  // gallery, so a row that arrives without it would save an empty one.
  const listings: ServiceListingRow[] = business.services.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    priceInfo: s.priceInfo,
    status: toListingStatus(s.status),
    images: parseImages(s.images),
  }));

  return (
    <div className="space-y-4">
      <Link
        href={`/services/${business.id}`}
        className="inline-flex min-h-11 items-center text-sm font-semibold text-ink-soft"
      >
        ← View public profile
      </Link>

      <Card>
        <div className="flex gap-3">
          <BusinessLogo
            name={business.name}
            category={category}
            logoUrl={business.logoUrl}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-1.5">
              <h1 className="text-xl font-bold leading-tight">
                {business.name}
              </h1>
              {business.verifiedAt && (
                <span className="mt-1">
                  <VerifiedMark label="Verified by Porchlight" />
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-ink-soft">
              <span aria-hidden>{meta.icon}</span> {meta.label}
            </p>
            <div className="mt-1.5">
              <Stars
                rating={averageRating(business.reviews)}
                count={business.reviews.length}
              />
            </div>
          </div>
        </div>
        <div className="mt-3">
          <BusinessProfileEditor
            initial={{
              name: business.name,
              category,
              description: business.description,
              phone: business.phone ?? "",
              website: business.website ?? "",
              logoUrl: business.logoUrl ?? "",
            }}
          />
        </div>
        {!business.verifiedAt && (
          <p className="mt-3 rounded-xl bg-porch-50 px-3 py-2 text-xs text-porch-800">
            Not verified yet. Verified businesses rated 4.5★ and up qualify for
            free Ad-Boost Pool placement — message support with proof of
            license/insurance to get the check mark.
          </p>
        )}
      </Card>

      <section>
        <SectionHeading title="Your plan" />
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{planMeta.label}</h3>
                {!subscriptionActive && business.subscription && (
                  <Badge className="bg-red-100 text-red-800">
                    {business.subscription.status === "PAST_DUE"
                      ? "Past due"
                      : "Cancelled"}
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-sm text-ink-soft">
                {planMeta.tagline}
              </p>
            </div>
            <p className="shrink-0 text-right">
              <span className="text-xl font-bold tabular-nums">
                ${planMeta.priceMonthly}
              </span>
              <span className="block text-xs text-ink-soft">/mo</span>
            </p>
          </div>

          <ul className="mt-3 space-y-1">
            {planMeta.features.map((feature) => (
              <li key={feature} className="flex gap-2 text-sm text-ink-soft">
                <span aria-hidden className="text-porch-600">
                  ✓
                </span>
                {feature}
              </li>
            ))}
          </ul>

          {business.subscription?.currentPeriodEnd && plan !== "FREE" && (
            <p className="mt-3 text-xs text-ink-soft">
              Current period ends{" "}
              {formatPeriodEnd(business.subscription.currentPeriodEnd)}.
            </p>
          )}

          <div className="mt-4">
            <ButtonLink
              href="/business/pricing"
              variant={plan === "FREE" ? "primary" : "secondary"}
              size="lg"
            >
              {plan === "FREE" ? "Compare plans" : "Change plan"}
            </ButtonLink>
          </div>
        </Card>
      </section>

      <section>
        <SectionHeading title="How you're doing" />
        <BusinessAnalytics
          reviewCount={business.reviews.length}
          avgRating={averageRating(business.reviews)}
          verifiedJobCount={business.reviews.filter((r) => r.verifiedJob).length}
          impressions={delivery._sum.impressions ?? 0}
          clicks={delivery._sum.clicks ?? 0}
          liveBoosts={liveBoosts.length}
          poolFundedBoosts={liveBoosts.filter((b) => b.poolFunded).length}
        />
      </section>

      <section>
        <SectionHeading title="Service listings" />
        <ServiceListingManager listings={listings} plan={plan} />
      </section>
    </div>
  );
}

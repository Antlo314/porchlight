import Link from "next/link";
import { BusinessDirectory } from "@/components/business/BusinessDirectory";
import {
  averageRating,
  toBusinessCategory,
  toPlan,
  type DirectoryBusiness,
  type FeaturedReason,
} from "@/components/business/types";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { pluralize } from "@/lib/format";
import { visibleNeighborhoodIds } from "@/lib/visibility";

/**
 * Rotate the featured rail so the same business isn't permanently first.
 * The offset is derived from the day so the server and any re-render agree
 * (a random shuffle would tear on hydration and make "rotating placement"
 * unauditable for the businesses paying for it).
 */
function rotateForToday<T>(items: T[]): T[] {
  if (items.length < 2) return items;
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  const offset = dayIndex % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

export default async function ServicesPage() {
  const user = await requireUser();
  const now = new Date();

  const neighborhoodIds = await visibleNeighborhoodIds(user);

  const [rows, myBusiness, openJobs] = await Promise.all([
    db.business.findMany({
      where: { neighborhoodId: { in: neighborhoodIds } },
      include: {
        reviews: { select: { rating: true } },
        subscription: { select: { plan: true, status: true } },
        adBoosts: {
          where: { startsAt: { lte: now }, endsAt: { gte: now } },
          select: { poolFunded: true },
        },
      },
      take: 100,
    }),
    db.business.findFirst({
      where: { ownerId: user.id },
      select: { id: true },
    }),
    db.jobRequest.count({
      where: { neighborhoodId: { in: neighborhoodIds }, status: "OPEN" },
    }),
  ]);

  const businesses: DirectoryBusiness[] = rows.map((b) => {
    const liveBoost = b.adBoosts[0] ?? null;
    const plan = toPlan(b.subscription?.plan);
    const featuredByPlan =
      plan === "FEATURED" && b.subscription?.status === "ACTIVE";

    // A live boost is the more specific reason, so it wins the badge.
    const featuredReason: FeaturedReason | null = liveBoost
      ? "BOOST"
      : featuredByPlan
        ? "PLAN"
        : null;

    return {
      id: b.id,
      name: b.name,
      category: toBusinessCategory(b.category),
      description: b.description,
      logoUrl: b.logoUrl,
      verified: b.verifiedAt !== null,
      avgRating: averageRating(b.reviews),
      reviewCount: b.reviews.length,
      plan,
      featuredReason,
      hasLiveBoost: liveBoost !== null,
      poolFunded: liveBoost?.poolFunded ?? false,
    };
  });

  // Best-reviewed first, then most-reviewed, then alphabetical — a brand new
  // listing with no reviews still surfaces, just below proven neighbors.
  const sorted = [...businesses].sort((a, b) => {
    const ra = a.avgRating ?? -1;
    const rb = b.avgRating ?? -1;
    if (rb !== ra) return rb - ra;
    if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount;
    return a.name.localeCompare(b.name);
  });

  const featured = rotateForToday(
    businesses.filter((b) => b.featuredReason !== null)
  );

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Local services</h1>
        <p className="text-sm text-ink-soft">
          Neighbors in {user.neighborhood.name} vouching for neighbors.
        </p>
      </header>

      {/* Entry point for the job board. It has no tab of its own (five is the
          limit at 375px), so Services is where neighbors and pros find it. */}
      <Link
        href="/jobs"
        className="flex min-h-14 items-center justify-between rounded-card border border-line bg-card px-4 transition-transform duration-100 active:scale-[0.99] active:bg-porch-50/50"
      >
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold">
            <span aria-hidden>🧰</span> Need something done?
          </span>
          <span className="block text-sm text-ink-soft">
            {openJobs > 0
              ? `${pluralize(openJobs, "neighbor")} asking for help right now`
              : "Post a job and let local pros come to you"}
          </span>
        </span>
        <span aria-hidden className="shrink-0 text-ink-soft">
          →
        </span>
      </Link>

      <Link
        href={myBusiness ? "/business/manage" : "/business/pricing"}
        className="block rounded-card border border-dashed border-porch-300 bg-porch-50 p-4 transition-transform duration-100 active:scale-[0.99]"
      >
        <p className="text-sm font-semibold text-porch-800">
          {myBusiness ? "Manage your business" : "Own a local business?"}
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          {myBusiness
            ? "Update your listings, see your reviews, and check your plan."
            : "List free. Go Pro for $19/mo when the work comes in."}
        </p>
      </Link>

      <BusinessDirectory featured={featured} businesses={sorted} />
    </div>
  );
}

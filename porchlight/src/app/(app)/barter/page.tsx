import Link from "next/link";
import { Fab } from "@/components/ui";
import { BarterBrowse } from "@/components/barter/BarterBrowse";
import { CreditBalanceCard } from "@/components/barter/CreditBalanceCard";
import { requireUser } from "@/lib/auth";
import { creditBalance } from "@/lib/credits";
import { db } from "@/lib/db";
import { visibleNeighborhoodIds } from "@/lib/visibility";

export const metadata = { title: "Barter" };

export default async function BarterPage() {
  const user = await requireUser();

  const [listings, balance, pendingOnMyListings] = await Promise.all([
    db.barterListing.findMany({
      where: {
        neighborhoodId: { in: await visibleNeighborhoodIds(user) },
        status: "OPEN",
      },
      orderBy: { createdAt: "desc" },
      take: 60,
      include: {
        owner: { select: { id: true, name: true, avatarUrl: true } },
      },
    }),
    creditBalance(user.id),
    db.barterOffer.count({
      where: { status: "PENDING", listing: { ownerId: user.id } },
    }),
  ]);

  return (
    <div className="space-y-4">
      <CreditBalanceCard balance={balance} href="/barter/credits" />

      <Link
        href="/barter/offers"
        className="flex min-h-12 items-center justify-between rounded-card border border-line bg-card px-4 transition-transform duration-100 active:scale-[0.99] active:bg-porch-50/50"
      >
        <span className="text-[15px] font-semibold">
          <span aria-hidden>📨</span> My offers
        </span>
        <span className="flex items-center gap-2 text-sm text-ink-soft">
          {pendingOnMyListings > 0 && (
            <span className="rounded-full bg-porch-600 px-2 py-0.5 text-xs font-bold text-white">
              {pendingOnMyListings} to review
            </span>
          )}
          →
        </span>
      </Link>

      <BarterBrowse listings={listings} />

      <Fab href="/barter/new" label="Post a trade" />
    </div>
  );
}

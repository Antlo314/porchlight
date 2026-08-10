import { BackLink } from "@/components/barter/BackLink";
import { OffersTabs, type OfferRow } from "@/components/barter/OffersTabs";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = { title: "Offers" };

export default async function OffersPage() {
  const user = await requireUser();

  const [made, received] = await Promise.all([
    db.barterOffer.findMany({
      where: { offererId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            kind: true,
            status: true,
            owner: { select: { name: true } },
          },
        },
      },
    }),
    db.barterOffer.findMany({
      where: { listing: { ownerId: user.id } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        listing: { select: { id: true, title: true, kind: true, status: true } },
        offerer: { select: { name: true } },
      },
    }),
  ]);

  const madeRows: OfferRow[] = made.map((offer) => ({
    id: offer.id,
    status: offer.status,
    message: offer.message,
    offeredItemDesc: offer.offeredItemDesc,
    creditAmount: offer.creditAmount,
    createdAt: offer.createdAt,
    listing: {
      id: offer.listing.id,
      title: offer.listing.title,
      kind: offer.listing.kind,
      status: offer.listing.status,
    },
    counterpartName: offer.listing.owner.name,
  }));

  const receivedRows: OfferRow[] = received.map((offer) => ({
    id: offer.id,
    status: offer.status,
    message: offer.message,
    offeredItemDesc: offer.offeredItemDesc,
    creditAmount: offer.creditAmount,
    createdAt: offer.createdAt,
    listing: {
      id: offer.listing.id,
      title: offer.listing.title,
      kind: offer.listing.kind,
      status: offer.listing.status,
    },
    counterpartName: offer.offerer.name,
  }));

  return (
    <div className="space-y-4">
      <BackLink />

      <div>
        <h1 className="text-2xl font-bold">Offers</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Every trade you&apos;ve proposed, and everything neighbors have
          proposed to you.
        </p>
      </div>

      <OffersTabs made={madeRows} received={receivedRows} />
    </div>
  );
}

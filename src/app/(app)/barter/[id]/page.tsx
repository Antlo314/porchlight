import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Avatar,
  Badge,
  ButtonLink,
  Card,
  CreditPill,
  SectionHeading,
  VerifiedMark,
} from "@/components/ui";
import { BackLink } from "@/components/barter/BackLink";
import { MyOfferPanel } from "@/components/barter/MyOfferPanel";
import { OfferComposer } from "@/components/barter/OfferComposer";
import { OwnerOffersPanel } from "@/components/barter/OwnerOffersPanel";
import { ReportListingButton } from "@/components/barter/ReportListingButton";
import { ListingStatusBadge } from "@/components/barter/StatusBadge";
import { categoryLabel, creditsToHours, kindMeta } from "@/components/barter/meta";
import { requireUser } from "@/lib/auth";
import { creditBalance } from "@/lib/credits";
import { db } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { parseImages } from "@/lib/json";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const listing = await db.barterListing.findUnique({
    where: { id },
    select: { title: true },
  });
  // The root layout's title template already appends "· Porchlight".
  return { title: listing ? listing.title : "Listing" };
}

export default async function ListingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requireUser();

  const listing = await db.barterListing.findUnique({
    where: { id },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          bio: true,
          karma: true,
          verifiedAt: true,
        },
      },
      neighborhood: { select: { name: true } },
      offers: {
        orderBy: { createdAt: "desc" },
        include: {
          offerer: {
            select: { id: true, name: true, avatarUrl: true, karma: true },
          },
        },
      },
    },
  });

  if (!listing) notFound();

  const isOwner = listing.ownerId === user.id;

  // Listings are neighborhood-scoped: your own area, or one you follow.
  if (!isOwner && listing.neighborhoodId !== user.neighborhoodId) {
    const follow = await db.neighborhoodFollow.findUnique({
      where: {
        userId_neighborhoodId: {
          userId: user.id,
          neighborhoodId: listing.neighborhoodId,
        },
      },
      select: { userId: true },
    });
    if (!follow) notFound();
  }

  const balance = await creditBalance(user.id);
  const meta = kindMeta(listing.kind);
  const images = parseImages(listing.images);
  const myOffer = listing.offers.find(
    (offer) =>
      offer.offererId === user.id &&
      ["PENDING", "ACCEPTED", "COMPLETED"].includes(offer.status)
  );

  return (
    <div className="space-y-4">
      <BackLink />

      {images.length > 0 && (
        <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4">
          {images.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- user-supplied
            // photo URLs; next/image would need every host allowlisted.
            <img
              key={`${src}-${i}`}
              src={src}
              alt=""
              className={`h-52 shrink-0 snap-start rounded-card border border-line object-cover ${
                images.length === 1 ? "w-full" : "w-72"
              }`}
            />
          ))}
        </div>
      )}

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-porch-100 text-porch-800">
            <span aria-hidden>{meta.icon}</span> {meta.label}
          </Badge>
          <Badge>{categoryLabel(listing.category)}</Badge>
          <ListingStatusBadge status={listing.status} />
        </div>

        <div className="mt-2 flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold leading-tight">{listing.title}</h1>
          {listing.creditValue !== null && (
            <CreditPill amount={listing.creditValue} className="mt-1" />
          )}
        </div>

        <p className="mt-1 text-sm text-ink-soft">
          {listing.neighborhood.name} · posted {timeAgo(listing.createdAt)}
          {listing.kind === "TIME" && listing.creditValue !== null && (
            <> · about {creditsToHours(listing.creditValue)} hours</>
          )}
        </p>
      </div>

      <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
        {listing.description}
      </p>

      {listing.wants && (
        <Card className="border-porch-200 bg-porch-50">
          <p className="text-xs font-semibold uppercase tracking-wide text-porch-800">
            Wants in return
          </p>
          <p className="mt-1 text-[15px]">{listing.wants}</p>
        </Card>
      )}

      <Card>
        <div className="flex items-center gap-3">
          <Avatar
            name={listing.owner.name}
            src={listing.owner.avatarUrl}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 font-semibold">
              <span className="truncate">{listing.owner.name}</span>
              {listing.owner.verifiedAt && (
                <VerifiedMark label="Verified resident" />
              )}
            </p>
            <p className="text-sm text-ink-soft">
              {listing.owner.karma} karma
              {isOwner ? " · this is your listing" : ""}
            </p>
          </div>
        </div>

        {listing.owner.bio && (
          <p className="mt-3 line-clamp-3 text-sm text-ink-soft">
            {listing.owner.bio}
          </p>
        )}

        {!isOwner && (
          <div className="mt-3 flex items-center gap-2">
            <ButtonLink
              href={`/messages/new?to=${listing.owner.id}`}
              variant="secondary"
              size="md"
              className="flex-1"
            >
              💬 Message
            </ButtonLink>
            <ReportListingButton listingId={listing.id} />
          </div>
        )}
      </Card>

      {isOwner ? (
        <>
          <OwnerOffersPanel
            offers={listing.offers}
            listingStatus={listing.status}
          />
          {listing.status === "COMPLETED" && (
            <Card className="border-pine-500/30 bg-pine-500/5">
              <p className="text-[15px] font-semibold">
                <span aria-hidden>🎉</span> Trade complete
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                Nice work. Credits and karma have already been posted — check
                your{" "}
                <Link href="/barter/credits" className="font-semibold text-porch-700">
                  credit history
                </Link>
                .
              </p>
            </Card>
          )}
        </>
      ) : myOffer ? (
        <MyOfferPanel
          offer={myOffer}
          ownerId={listing.owner.id}
          ownerName={listing.owner.name}
        />
      ) : listing.status === "OPEN" ? (
        <OfferComposer
          listingId={listing.id}
          listingKind={listing.kind}
          ownerName={listing.owner.name}
          creditValue={listing.creditValue}
          balance={balance}
        />
      ) : (
        <>
          <SectionHeading title="Offers" />
          <Card>
            <p className="text-[15px] font-semibold">Not taking offers</p>
            <p className="mt-1 text-sm text-ink-soft">
              {listing.status === "PENDING"
                ? `${listing.owner.name} is mid-trade on this one. Check back if it reopens.`
                : "This listing is closed, but there's plenty more on the block."}
            </p>
            <ButtonLink href="/barter" variant="secondary" size="md" className="mt-3">
              Browse other trades
            </ButtonLink>
          </Card>
        </>
      )}
    </div>
  );
}

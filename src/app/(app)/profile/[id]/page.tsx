import { notFound, redirect } from "next/navigation";
import { BackLink } from "@/components/profile/BackLink";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileLinkRow } from "@/components/profile/ProfileLinkRow";
import {
  ProfileListingRow,
  type ProfileListingRowData,
} from "@/components/profile/ProfileListingRow";
import {
  ProfilePostRow,
  type ProfilePostRowData,
} from "@/components/profile/ProfilePostRow";
import { StatTile } from "@/components/profile/StatTile";
import { firstName } from "@/components/profile/format";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  SectionHeading,
} from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const person = await db.user.findUnique({
    where: { id },
    select: { name: true },
  });
  return {
    // The root layout's title template already appends "· Porchlight".
    title: person ? person.name : "Neighbor",
  };
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { id } = await params;
  const viewer = await requireUser();

  // Your own card lives at /profile, with all the private controls on it.
  if (id === viewer.id) redirect("/profile");

  // Only public columns are selected. email, addressLine and passwordHash are
  // deliberately absent so they can never reach the client payload.
  const person = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      bio: true,
      karma: true,
      createdAt: true,
      verifiedAt: true,
      neighborhoodId: true,
      neighborhood: { select: { name: true, city: true } },
    },
  });
  if (!person) notFound();

  // Posts and listings are neighborhood-scoped: show only the ones the viewer
  // would already be able to see in the feed or the barter board.
  const follows = await db.neighborhoodFollow.findMany({
    where: { userId: viewer.id },
    select: { neighborhoodId: true },
  });
  const visibleNeighborhoodIds = [
    viewer.neighborhoodId,
    ...follows.map((f) => f.neighborhoodId),
  ];

  const [posts, listings, tradesAsOwner, tradesAsOfferer, business] =
    await Promise.all([
      db.post.findMany({
        where: {
          authorId: person.id,
          neighborhoodId: { in: visibleNeighborhoodIds },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          images: true,
          pinned: true,
          createdAt: true,
          _count: { select: { comments: true, reactions: true } },
        },
      }),
      db.barterListing.findMany({
        where: {
          ownerId: person.id,
          status: "OPEN",
          neighborhoodId: { in: visibleNeighborhoodIds },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          kind: true,
          title: true,
          description: true,
          category: true,
          images: true,
          creditValue: true,
          status: true,
          createdAt: true,
        },
      }),
      db.barterOffer.count({
        where: { status: "COMPLETED", listing: { ownerId: person.id } },
      }),
      db.barterOffer.count({
        where: { status: "COMPLETED", offererId: person.id },
      }),
      db.business.findFirst({
        where: { ownerId: person.id },
        select: { id: true, name: true, verifiedAt: true },
      }),
    ]);

  const completedTrades = tradesAsOwner + tradesAsOfferer;
  const postRows: ProfilePostRowData[] = posts;
  const listingRows: ProfileListingRowData[] = listings;
  const sameNeighborhood = person.neighborhoodId === viewer.neighborhoodId;

  return (
    <div className="space-y-4">
      <BackLink href="/feed" label="Back" />

      <ProfileHeader
        name={person.name}
        avatarUrl={person.avatarUrl}
        neighborhoodLabel={`${person.neighborhood.name}, ${person.neighborhood.city}`}
        bio={person.bio}
        joinedAt={person.createdAt}
        verified={person.verifiedAt !== null}
        badge={
          sameNeighborhood ? (
            <Badge className="bg-porch-100 text-porch-800">
              🏡 Your neighborhood
            </Badge>
          ) : undefined
        }
      >
        <ButtonLink
          href={`/messages/new?to=${person.id}`}
          size="lg"
          className="mt-4"
        >
          💬 Message {firstName(person.name)}
        </ButtonLink>
      </ProfileHeader>

      <div className="grid grid-cols-2 gap-3">
        <StatTile icon="⭐" value={person.karma} label="Karma" />
        <StatTile icon="🤝" value={completedTrades} label="Trades done" />
      </div>

      {business && (
        <ProfileLinkRow
          href={`/services/${business.id}`}
          icon="🏪"
          label={business.name}
          sub={
            business.verifiedAt
              ? "Verified local business"
              : "Local business on Porchlight"
          }
        />
      )}

      <SectionHeading title="Recent posts" />
      {postRows.length === 0 ? (
        <Card>
          <p className="text-[15px] font-semibold">Nothing posted yet</p>
          <p className="mt-1 text-sm text-ink-soft">
            {firstName(person.name)} hasn&apos;t posted anything you can see.
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {postRows.map((post) => (
            <li key={post.id}>
              <ProfilePostRow post={post} />
            </li>
          ))}
        </ul>
      )}

      <SectionHeading title="Up for trade" />
      {listingRows.length === 0 ? (
        <EmptyState
          icon="🧺"
          title="No open listings"
          body={`${firstName(person.name)} doesn't have anything up for trade right now. Browse what the rest of the neighborhood is offering.`}
          actionLabel="Browse barter"
          actionHref="/barter"
        />
      ) : (
        <ul className="space-y-2">
          {listingRows.map((listing) => (
            <li key={listing.id}>
              <ProfileListingRow listing={listing} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import LogoutButton from "@/components/LogoutButton";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileLinkRow } from "@/components/profile/ProfileLinkRow";
import { StatTile } from "@/components/profile/StatTile";
import { Badge, ButtonLink, Card, SectionHeading } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { creditBalance } from "@/lib/credits";
import { db } from "@/lib/db";
import { pluralize } from "@/lib/format";
import { PLAN_META, type PlanValue } from "@/lib/validators";

export const metadata = { title: "Me" };

export default async function ProfilePage() {
  const user = await requireUser();

  const [
    balance,
    postCount,
    listingCount,
    openListingCount,
    tradesAsOwner,
    tradesAsOfferer,
    offersMadePending,
    offersReceivedPending,
    business,
  ] = await Promise.all([
    creditBalance(user.id),
    db.post.count({ where: { authorId: user.id } }),
    db.barterListing.count({ where: { ownerId: user.id } }),
    db.barterListing.count({ where: { ownerId: user.id, status: "OPEN" } }),
    // A completed trade counts from either side of the handshake.
    db.barterOffer.count({
      where: { status: "COMPLETED", listing: { ownerId: user.id } },
    }),
    db.barterOffer.count({ where: { status: "COMPLETED", offererId: user.id } }),
    db.barterOffer.count({ where: { status: "PENDING", offererId: user.id } }),
    db.barterOffer.count({
      where: { status: "PENDING", listing: { ownerId: user.id } },
    }),
    db.business.findFirst({
      where: { ownerId: user.id },
      select: {
        id: true,
        name: true,
        verifiedAt: true,
        subscription: { select: { plan: true } },
      },
    }),
  ]);

  const completedTrades = tradesAsOwner + tradesAsOfferer;
  const pendingOffers = offersMadePending + offersReceivedPending;
  const isStaff = user.role === "MODERATOR" || user.role === "ADMIN";
  const plan = business?.subscription
    ? (PLAN_META[business.subscription.plan as PlanValue] ?? PLAN_META.FREE)
    : null;

  return (
    <div className="space-y-4">
      <ProfileHeader
        name={user.name}
        avatarUrl={user.avatarUrl}
        neighborhoodLabel={`${user.neighborhood.name}, ${user.neighborhood.city}`}
        bio={user.bio}
        joinedAt={user.createdAt}
        verified={user.verifiedAt !== null}
        badge={
          isStaff ? (
            <Badge className="bg-pine-500/10 text-pine-700">
              🛡️ {user.role === "ADMIN" ? "Admin" : "Moderator"}
            </Badge>
          ) : undefined
        }
      >
        {!user.bio && (
          <p className="mt-3 text-[15px] text-ink-soft">
            No bio yet — neighbors trust a face and a sentence more than a blank
            card.
          </p>
        )}
        <ButtonLink
          href="/profile/edit"
          variant="secondary"
          size="md"
          className="mt-3 w-full"
        >
          ✏️ Edit profile
        </ButtonLink>
      </ProfileHeader>

      <div className="grid grid-cols-2 gap-3">
        <StatTile
          icon="🪙"
          value={balance}
          label="Porch Credits"
          href="/barter/credits"
        />
        <StatTile icon="⭐" value={user.karma} label="Karma" />
        <StatTile
          icon="📝"
          value={postCount}
          label="Posts"
          href="/profile/posts"
        />
        <StatTile
          icon="🤝"
          value={completedTrades}
          label="Trades done"
          href="/barter/offers"
        />
      </div>

      {user.verifiedAt === null && (
        <Card className="border-porch-200 bg-porch-50">
          <p className="text-[15px] font-semibold">
            <span aria-hidden>🏠</span> You&apos;re not address-verified yet
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Verified neighbors get a checkmark, and their trades get taken more
            seriously. Ask a moderator in {user.neighborhood.name} to verify
            you.
          </p>
        </Card>
      )}

      <SectionHeading title="Your stuff" />
      <ul className="space-y-2">
        <li>
          <ProfileLinkRow
            href="/profile/posts"
            icon="📝"
            label="My posts"
            sub={
              postCount === 0
                ? "Nothing posted yet"
                : pluralize(postCount, "post")
            }
          />
        </li>
        <li>
          <ProfileLinkRow
            href="/profile/listings"
            icon="🧺"
            label="My barter listings"
            sub={
              listingCount === 0
                ? "Nothing up for trade yet"
                : `${pluralize(listingCount, "listing")} · ${openListingCount} open`
            }
          />
        </li>
        <li>
          <ProfileLinkRow
            href="/barter/offers"
            icon="🤝"
            label="My offers"
            sub={
              pendingOffers === 0
                ? "No offers waiting"
                : `${pluralize(pendingOffers, "offer")} waiting on a decision`
            }
            trailing={
              pendingOffers > 0 ? (
                <Badge className="bg-porch-600 text-white">
                  {pendingOffers}
                </Badge>
              ) : undefined
            }
          />
        </li>
        <li>
          {business ? (
            <ProfileLinkRow
              href="/business/manage"
              icon="🏪"
              label={business.name}
              sub={`${plan?.label ?? "Free"} plan${business.verifiedAt ? " · verified" : ""}`}
            />
          ) : (
            <ProfileLinkRow
              href="/business/new"
              icon="🏪"
              label="List your business"
              sub="Free profile, free reviews, no listing fee"
            />
          )}
        </li>
      </ul>

      <SectionHeading title="Account" />
      <ul className="space-y-2">
        <li>
          <ProfileLinkRow
            href="/profile/edit"
            icon="✏️"
            label="Edit profile"
            sub="Name, bio, and photo"
          />
        </li>
        {isStaff && (
          <li>
            <ProfileLinkRow
              href="/moderation"
              icon="🛡️"
              label="Moderation queue"
              sub="Reports from your neighborhood"
            />
          </li>
        )}
      </ul>

      <div className="pt-2">
        <LogoutButton />
      </div>
    </div>
  );
}

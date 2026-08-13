import { BackLink } from "@/components/profile/BackLink";
import {
  ProfileListingRow,
  type ProfileListingRowData,
} from "@/components/profile/ProfileListingRow";
import { ButtonLink, EmptyState } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { pluralize } from "@/lib/format";

export const metadata = { title: "My listings" };

// Open first, then in-progress, then everything that's already closed out.
const STATUS_ORDER: Record<string, number> = {
  OPEN: 0,
  PENDING: 1,
  COMPLETED: 2,
  WITHDRAWN: 3,
};

export default async function MyListingsPage() {
  const user = await requireUser();

  const listings = await db.barterListing.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
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
  });

  const rows: ProfileListingRowData[] = [...listings].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
  );
  const openCount = rows.filter((l) => l.status === "OPEN").length;

  return (
    <div className="space-y-4">
      <BackLink />

      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">My listings</h1>
          {rows.length > 0 && (
            <p className="mt-1 text-sm text-ink-soft">
              {pluralize(rows.length, "listing")} · {openCount} open
            </p>
          )}
        </div>
        {rows.length > 0 && (
          <ButtonLink href="/barter/new" size="md" className="shrink-0">
            ＋ New
          </ButtonLink>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon="🧺"
          title="Nothing up for trade"
          body="Offer a tool, a skill, or an hour of help. Neighbors trade for Porch Credits when nobody wants cash."
          actionLabel="List something"
          actionHref="/barter/new"
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((listing) => (
            <li key={listing.id}>
              <ProfileListingRow listing={listing} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

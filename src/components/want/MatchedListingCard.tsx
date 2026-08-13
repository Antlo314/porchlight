import { Avatar, CardLink, CreditPill } from "@/components/ui";
import { parseImages } from "@/lib/json";
import type { MatchReason } from "@/lib/matching";
import { ReasonChips } from "./ReasonChips";
import { matchReasons, wantCategoryLabel, wantKindMeta } from "./meta";

/** Shape returned by findListingsForWant() in @/lib/matching. */
export type MatchedListing = {
  id: string;
  kind: string;
  category: string;
  title: string;
  description: string;
  creditValue: number | null;
  /** Raw JSON column; parsed with parseImages. */
  images: string;
  owner: { id: string; name: string; avatarUrl: string | null };
};

/**
 * A listing that already answers a want the member just posted. Shown right
 * after the compose step, so "post a want" pays off in the same breath instead
 * of promising a notification later.
 */
export function MatchedListingCard({
  listing,
  match,
}: {
  listing: MatchedListing;
  match: MatchReason;
}) {
  const kind = wantKindMeta(listing.kind);
  const cover = parseImages(listing.images)[0];

  return (
    <CardLink href={`/barter/${listing.id}`} padded={false}>
      <div className="flex gap-3 p-4">
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element -- covers are
          // either our own "/uploads/…" (relative) or an external link;
          // next/image would need every host allowlisted.
          <img
            src={cover}
            alt=""
            loading="lazy"
            className="h-20 w-20 shrink-0 rounded-xl border border-line bg-line/50 object-cover"
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[15px] font-semibold leading-snug">
              {listing.title}
            </h3>
            {listing.creditValue !== null && (
              <CreditPill amount={listing.creditValue} />
            )}
          </div>

          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-soft">
            <span className="font-semibold">
              <span aria-hidden>{kind.icon}</span> {kind.label}
            </span>
            <span aria-hidden>·</span>
            <span>{wantCategoryLabel(listing.category)}</span>
          </p>

          <p className="mt-1.5 line-clamp-2 text-sm text-ink-soft">
            {listing.description}
          </p>

          <div className="mt-2 flex items-center gap-2">
            <Avatar
              name={listing.owner.name}
              src={listing.owner.avatarUrl}
              size="sm"
            />
            <span className="truncate text-sm text-ink-soft">
              {listing.owner.name}
            </span>
            <span aria-hidden className="ml-auto shrink-0 text-ink-soft">
              ›
            </span>
          </div>

          <ReasonChips
            reasons={matchReasons(match, listing.category)}
            className="mt-2"
          />
        </div>
      </div>
    </CardLink>
  );
}

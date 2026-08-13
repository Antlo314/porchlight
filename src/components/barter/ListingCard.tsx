import { Avatar, CardLink, CreditPill } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { parseImages } from "@/lib/json";
import { categoryLabel, kindMeta } from "./meta";
import { ListingStatusBadge } from "./StatusBadge";

/** Exactly what a listing row needs — keeps page queries honest. */
export type ListingCardData = {
  id: string;
  kind: string;
  title: string;
  description: string;
  category: string;
  /** Raw JSON column; parsed with parseImages. */
  images: string;
  wants: string | null;
  creditValue: number | null;
  status: string;
  createdAt: Date | string;
  owner: { id: string; name: string; avatarUrl: string | null };
};

export function ListingCard({ listing }: { listing: ListingCardData }) {
  const meta = kindMeta(listing.kind);
  const cover = parseImages(listing.images)[0];

  return (
    <CardLink href={`/barter/${listing.id}`} padded={false}>
      <div className="flex gap-3 p-4">
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element -- covers are
          // either our own "/uploads/…" (relative, which <img> resolves
          // natively) or an external link; next/image needs an allowlist.
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
            <span className="font-semibold text-ink-soft">
              <span aria-hidden>{meta.icon}</span> {meta.label}
            </span>
            <span aria-hidden>·</span>
            <span>{categoryLabel(listing.category)}</span>
            <span aria-hidden>·</span>
            <span>{timeAgo(listing.createdAt)}</span>
          </p>

          <p className="mt-1.5 line-clamp-2 text-sm text-ink-soft">
            {listing.description}
          </p>

          {listing.wants && (
            <p className="mt-1.5 line-clamp-1 text-sm">
              <span className="font-semibold text-porch-700">wants:</span>{" "}
              <span className="text-ink-soft">{listing.wants}</span>
            </p>
          )}

          <div className="mt-2.5 flex items-center gap-2">
            <Avatar
              name={listing.owner.name}
              src={listing.owner.avatarUrl}
              size="sm"
            />
            <span className="truncate text-sm text-ink-soft">
              {listing.owner.name}
            </span>
            {listing.status !== "OPEN" && (
              <span className="ml-auto">
                <ListingStatusBadge status={listing.status} />
              </span>
            )}
          </div>
        </div>
      </div>
    </CardLink>
  );
}

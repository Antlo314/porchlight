import { Badge, CardLink, CreditPill } from "@/components/ui";
import { timeAgo, truncate } from "@/lib/format";
import { parseImages } from "@/lib/json";
import {
  BARTER_CATEGORY_LABELS,
  BARTER_KIND_META,
  type BarterCategoryValue,
  type BarterKindValue,
} from "@/lib/validators";

/** Exactly what a profile listing row needs. */
export type ProfileListingRowData = {
  id: string;
  kind: string;
  title: string;
  description: string;
  category: string;
  /** Raw JSON column; parsed here with parseImages(). */
  images: string;
  creditValue: number | null;
  status: string;
  createdAt: Date | string;
};

const STATUS_CLASS: Record<string, string> = {
  OPEN: "bg-pine-500/10 text-pine-700",
  PENDING: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-porch-100 text-porch-800",
  WITHDRAWN: "bg-line text-ink-soft",
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  PENDING: "In progress",
  COMPLETED: "Completed",
  WITHDRAWN: "Withdrawn",
};

export function ProfileListingRow({
  listing,
}: {
  listing: ProfileListingRowData;
}) {
  const meta =
    BARTER_KIND_META[listing.kind as BarterKindValue] ?? BARTER_KIND_META.GOODS;
  const categoryLabel =
    BARTER_CATEGORY_LABELS[listing.category as BarterCategoryValue] ?? "Other";
  const cover = parseImages(listing.images)[0];

  return (
    <CardLink href={`/barter/${listing.id}`} padded={false}>
      <div className="flex gap-3 p-3">
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element -- listing photos
          // are arbitrary user-supplied URLs; next/image would need an allowlist.
          <img
            src={cover}
            alt=""
            className="h-16 w-16 shrink-0 rounded-xl border border-line object-cover"
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-1 text-[15px] font-semibold leading-snug">
              {listing.title}
            </h3>
            {listing.creditValue !== null && (
              <CreditPill amount={listing.creditValue} />
            )}
          </div>

          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-soft">
            <span className="font-semibold">
              <span aria-hidden>{meta.icon}</span> {meta.label}
            </span>
            <span aria-hidden>·</span>
            <span>{categoryLabel}</span>
            <span aria-hidden>·</span>
            <span>{timeAgo(listing.createdAt)}</span>
          </p>

          <p className="mt-1.5 line-clamp-2 text-sm text-ink-soft">
            {truncate(listing.description, 140)}
          </p>

          <div className="mt-2">
            <Badge className={STATUS_CLASS[listing.status] ?? STATUS_CLASS.OPEN}>
              {STATUS_LABEL[listing.status] ?? listing.status}
            </Badge>
          </div>
        </div>
      </div>
    </CardLink>
  );
}

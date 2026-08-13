import Link from "next/link";
import { Avatar, ButtonLink, Card, CreditPill } from "@/components/ui";
import type { MatchReason } from "@/lib/matching";
import { ReasonChips } from "./ReasonChips";
import {
  firstName,
  matchReasons,
  wantCategoryLabel,
  wantKindMeta,
} from "./meta";

/** Shape returned by matchesForMyListings() in @/lib/matching. */
export type ListingMatchData = {
  listingId: string;
  listingTitle: string;
  want: {
    id: string;
    kind: string;
    category: string;
    title: string;
    description: string | null;
    creditOffer: number | null;
    user: { id: string; name: string; avatarUrl: string | null };
  };
  match: MatchReason;
};

/**
 * "A neighbor is waiting for the thing you already listed."
 *
 * Every row answers three questions in order: who, what they need, and which
 * of your listings it is — then gives the one action worth taking. The reason
 * chips sit directly above the Message button on purpose: a member checks the
 * app's reasoning and acts in the same glance, and a match they can verify is
 * a match they will trust next time.
 */
export function MatchRow({ row }: { row: ListingMatchData }) {
  const { want } = row;
  const kind = wantKindMeta(want.kind);

  return (
    <Card>
      <div className="flex items-center gap-3">
        <Link
          href={`/profile/${want.user.id}`}
          className="flex min-w-0 flex-1 items-center gap-3 py-1"
        >
          <Avatar name={want.user.name} src={want.user.avatarUrl} size="md" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold">
              {want.user.name}
            </span>
            <span className="block truncate text-xs text-ink-soft">
              <span aria-hidden>{kind.icon}</span> {kind.label} ·{" "}
              {wantCategoryLabel(want.category)}
            </span>
          </span>
        </Link>
        {want.creditOffer !== null && <CreditPill amount={want.creditOffer} />}
      </div>

      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
        Is looking for
      </p>
      <p className="mt-0.5 text-[17px] font-bold leading-snug">
        &ldquo;{want.title}&rdquo;
      </p>
      {want.description && (
        <p className="mt-1 line-clamp-2 text-sm text-ink-soft">
          {want.description}
        </p>
      )}

      <Link
        href={`/barter/${row.listingId}`}
        className="mt-3 flex min-h-12 items-center gap-2 rounded-xl border border-line bg-cream px-3 transition-transform duration-100 active:scale-[0.99]"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
            Your listing
          </span>
          <span className="block truncate text-sm font-semibold">
            {row.listingTitle}
          </span>
        </span>
        <span aria-hidden className="shrink-0 text-ink-soft">
          ›
        </span>
      </Link>

      <ReasonChips
        reasons={matchReasons(row.match, want.category)}
        className="mt-3"
      />

      <ButtonLink
        href={`/messages/new?to=${want.user.id}`}
        size="lg"
        className="mt-3"
      >
        Message {firstName(want.user.name)}
      </ButtonLink>
    </Card>
  );
}

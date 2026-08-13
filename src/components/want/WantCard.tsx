import Link from "next/link";
import { Avatar, Badge, ButtonLink, Card, CreditPill } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { ReasonChips } from "./ReasonChips";
import {
  WANT_STATUS_META,
  firstName,
  toWantStatus,
  wantCategoryLabel,
  wantKindMeta,
} from "./meta";

/** Exactly what a want row needs — keeps the board's query honest. */
export type WantCardData = {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  category: string;
  creditOffer: number | null;
  status: string;
  createdAt: Date | string;
  user: { id: string; name: string; avatarUrl: string | null };
};

/**
 * Set when the viewer already has an open listing that answers this want.
 * `reasons` comes from matchReasons() — never a bare score.
 */
export type WantMatchSummary = {
  listingId: string;
  listingTitle: string;
  reasons: string[];
};

/**
 * One neighbor's "here is what I need".
 *
 * A want has no detail page of its own — everything worth knowing fits on the
 * card, and the only useful next step is a message. So the card is a plain
 * Card, not a CardLink, and the tap targets inside it are the real actions.
 */
export function WantCard({
  want,
  myMatch,
  showStatus = false,
  footer,
}: {
  want: WantCardData;
  myMatch?: WantMatchSummary;
  /** Own wants show their status; the neighbor board is all OPEN already. */
  showStatus?: boolean;
  /** Owner controls, appended below the body. */
  footer?: React.ReactNode;
}) {
  const kind = wantKindMeta(want.kind);
  const status = toWantStatus(want.status);
  const statusMeta = WANT_STATUS_META[status];
  const dimmed = showStatus && status !== "OPEN";

  return (
    <Card
      padded={false}
      className={`overflow-hidden ${
        myMatch ? "border-porch-300 shadow-sm shadow-porch-900/5" : ""
      }`.trim()}
    >
      {/* The whole point of recording wants: this band tells a browsing member
          that the thing they already listed is the thing someone is waiting
          for. It leads the card because it is the only new information on it. */}
      {myMatch && (
        <Link
          href={`/barter/${myMatch.listingId}`}
          className="flex min-h-11 items-center gap-2 bg-porch-600 px-4 py-2.5 text-white transition-colors active:bg-porch-700"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-bold">
              <span aria-hidden>🎯</span> You have this
            </span>
            <span className="block truncate text-xs text-white/85">
              Your listing: {myMatch.listingTitle}
            </span>
          </span>
          <span aria-hidden className="shrink-0 text-white/85">
            ›
          </span>
        </Link>
      )}

      <div className={`p-4 ${dimmed ? "opacity-70" : ""}`.trim()}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[15px] font-semibold leading-snug">
            {want.title}
          </h3>
          {want.creditOffer !== null && (
            <CreditPill amount={want.creditOffer} />
          )}
        </div>

        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-soft">
          <span className="font-semibold">
            <span aria-hidden>{kind.icon}</span> {kind.label}
          </span>
          <span aria-hidden>·</span>
          <span>{wantCategoryLabel(want.category)}</span>
          <span aria-hidden>·</span>
          <span>{timeAgo(want.createdAt)}</span>
          {showStatus && (
            <>
              <span aria-hidden>·</span>
              <Badge className={statusMeta.className}>{statusMeta.label}</Badge>
            </>
          )}
        </p>

        {want.description && (
          <p className="mt-1.5 line-clamp-3 text-sm text-ink-soft">
            {want.description}
          </p>
        )}

        <div className="mt-2.5 flex items-center gap-2">
          <Avatar name={want.user.name} src={want.user.avatarUrl} size="sm" />
          <span className="truncate text-sm text-ink-soft">
            {want.user.name} is looking for this
          </span>
        </div>

        {myMatch && (
          <>
            <ReasonChips reasons={myMatch.reasons} className="mt-3" />
            <ButtonLink
              href={`/messages/new?to=${want.user.id}`}
              size="lg"
              className="mt-3"
            >
              Message {firstName(want.user.name)}
            </ButtonLink>
          </>
        )}

        {footer}
      </div>
    </Card>
  );
}

import Link from "next/link";
import { Badge, ButtonLink, Stars, VerifiedMark } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { jobCategoryMeta } from "./meta";

export type JobReplyRow = {
  id: string;
  message: string;
  quoteInfo: string | null;
  createdAt: Date | string;
  business: {
    id: string;
    /** The owner's user id — the Message button needs a person, not a business. */
    ownerId: string;
    name: string;
    category: string;
    logoUrl: string | null;
    verified: boolean;
    avgRating: number | null;
    reviewCount: number;
  };
};

/** Logo when the pro uploaded one, category tile when they didn't. */
function ProLogo({
  name,
  category,
  logoUrl,
}: {
  name: string;
  category: string;
  logoUrl: string | null;
}) {
  const cls = "h-12 w-12 shrink-0 rounded-xl border border-line object-cover";

  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- logos come from
    // arbitrary owner-supplied hosts; next/image would need each allowlisted.
    return <img src={logoUrl} alt={`${name} logo`} className={cls} />;
  }

  return (
    <span
      aria-hidden
      className={`${cls} flex items-center justify-center bg-porch-50 text-xl`}
    >
      {jobCategoryMeta(category).icon}
    </span>
  );
}

export function JobReplyCard({
  reply,
  canMessage,
  isMine = false,
}: {
  reply: JobReplyRow;
  /** Show the Message button — off for the pro looking at their own reply. */
  canMessage: boolean;
  isMine?: boolean;
}) {
  const { business } = reply;

  return (
    // Not built on <Card>: the "your reply" tint competes with Card's own
    // background classes, so this owns its whole class list.
    <div
      className={`rounded-card border p-4 ${
        isMine ? "border-porch-200 bg-porch-50" : "border-line bg-card"
      }`}
    >
      <div className="flex items-start gap-3">
        <ProLogo
          name={business.name}
          category={business.category}
          logoUrl={business.logoUrl}
        />

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 font-semibold leading-snug">
            <Link href={`/services/${business.id}`} className="truncate">
              {business.name}
            </Link>
            {business.verified && <VerifiedMark label="Verified business" />}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <Stars rating={business.avgRating} count={business.reviewCount} />
            <span className="text-xs text-ink-soft">
              {timeAgo(reply.createdAt)}
            </span>
          </div>
        </div>

        {reply.quoteInfo && (
          <Badge className="bg-pine-500/10 text-pine-700">
            {reply.quoteInfo}
          </Badge>
        )}
      </div>

      <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed">
        {reply.message}
      </p>

      <div className="mt-3 flex items-center gap-2">
        {canMessage && (
          <ButtonLink
            href={`/messages/new?to=${business.ownerId}`}
            variant="primary"
            size="md"
            className="flex-1"
          >
            💬 Message
          </ButtonLink>
        )}
        <ButtonLink
          href={`/services/${business.id}`}
          variant="secondary"
          size="md"
          className={canMessage ? "flex-1" : "w-full"}
        >
          View profile
        </ButtonLink>
      </div>

      {isMine && (
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-porch-800">
          Your reply · free on every plan
        </p>
      )}
    </div>
  );
}

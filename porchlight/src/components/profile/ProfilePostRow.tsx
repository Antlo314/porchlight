import { Badge, CardLink } from "@/components/ui";
import { timeAgo, truncate } from "@/lib/format";
import { parseImages } from "@/lib/json";
import { POST_TYPE_META, type PostTypeValue } from "@/lib/validators";

/** Exactly what a profile post row needs — keeps the page queries honest. */
export type ProfilePostRowData = {
  id: string;
  type: string;
  title: string | null;
  body: string;
  /** Raw JSON column; parsed here with parseImages(). */
  images: string;
  pinned: boolean;
  createdAt: Date | string;
  _count: { comments: number; reactions: number };
};

export function ProfilePostRow({ post }: { post: ProfilePostRowData }) {
  const meta =
    POST_TYPE_META[post.type as PostTypeValue] ?? POST_TYPE_META.GENERAL;
  const cover = parseImages(post.images)[0];

  return (
    <CardLink href={`/feed/${post.id}`} padded={false}>
      <div className="flex gap-3 p-3">
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element -- post photos are
          // arbitrary user-supplied URLs; next/image would need an allowlist.
          <img
            src={cover}
            alt=""
            className="h-16 w-16 shrink-0 rounded-xl border border-line object-cover"
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className={meta.badgeClass}>
              <span aria-hidden>{meta.icon}</span>
              {meta.label}
            </Badge>
            {post.pinned && (
              <Badge className="bg-porch-600 text-white">📌 Pinned</Badge>
            )}
            <span className="text-xs text-ink-soft">
              {timeAgo(post.createdAt)}
            </span>
          </div>

          {post.title && (
            <h3 className="mt-1.5 line-clamp-1 text-[15px] font-semibold leading-snug">
              {post.title}
            </h3>
          )}

          <p className="mt-1 line-clamp-2 text-sm text-ink-soft">
            {truncate(post.body, 160)}
          </p>

          <p className="mt-2 flex items-center gap-3 text-xs text-ink-soft">
            <span className="inline-flex items-center gap-1 tabular-nums">
              <span aria-hidden>👍</span>
              {post._count.reactions}
              <span className="sr-only">reactions</span>
            </span>
            <span className="inline-flex items-center gap-1 tabular-nums">
              <span aria-hidden>💬</span>
              {post._count.comments}
              <span className="sr-only">comments</span>
            </span>
          </p>
        </div>
      </div>
    </CardLink>
  );
}

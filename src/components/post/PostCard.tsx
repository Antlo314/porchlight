import { Avatar, Badge, CardLink } from "@/components/ui";
import { formatEventRange, timeAgo } from "@/lib/format";
import { parseImages } from "@/lib/json";
import { POST_TYPE_META, type PostTypeValue } from "@/lib/validators";
import { PostImages } from "./PostImages";

/** Exactly what the feed query selects — keeps page.tsx and the card in sync. */
export type FeedPost = {
  id: string;
  type: string;
  title: string | null;
  body: string;
  /** Raw JSON column; parsed here with parseImages(). */
  images: string;
  pinned: boolean;
  createdAt: Date;
  author: { id: string; name: string; avatarUrl: string | null };
  event: { startsAt: Date; endsAt: Date | null; location: string } | null;
  _count: { comments: number; reactions: number };
};

export function PostCard({ post }: { post: FeedPost }) {
  const meta =
    POST_TYPE_META[post.type as PostTypeValue] ?? POST_TYPE_META.GENERAL;
  const images = parseImages(post.images);

  return (
    <CardLink href={`/feed/${post.id}`} className="animate-fade-in">
      <div className="flex items-start gap-3">
        <Avatar name={post.author.name} src={post.author.avatarUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-semibold">{post.author.name}</span>
            <span className="shrink-0 text-sm text-ink-soft">
              · {timeAgo(post.createdAt)}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge className={meta.badgeClass}>
              <span aria-hidden>{meta.icon}</span>
              {meta.label}
            </Badge>
            {post.pinned && (
              <Badge className="bg-porch-600 text-white">📌 Pinned</Badge>
            )}
          </div>
        </div>
      </div>

      {post.title && (
        <h2 className="mt-3 text-[17px] font-bold leading-snug">
          {post.title}
        </h2>
      )}

      {post.event && (
        <p className="mt-1.5 text-sm font-semibold text-pine-600">
          📅 {formatEventRange(post.event.startsAt, post.event.endsAt)}
          <span className="block font-normal text-ink-soft">
            📍 {post.event.location}
          </span>
        </p>
      )}

      <p className="mt-1.5 line-clamp-4 whitespace-pre-wrap text-[15px] leading-relaxed">
        {post.body}
      </p>

      <PostImages images={images} />

      <div className="mt-3 flex items-center gap-4 border-t border-line pt-2.5 text-sm text-ink-soft">
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <span aria-hidden>👍</span>
          {post._count.reactions}
          <span className="sr-only">reactions</span>
        </span>
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <span aria-hidden>💬</span>
          {post._count.comments}
          <span className="sr-only">comments</span>
        </span>
      </div>
    </CardLink>
  );
}

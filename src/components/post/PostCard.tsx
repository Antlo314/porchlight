import Link from "next/link";
import { Avatar, Badge, Card } from "@/components/ui";
import { formatEventRange, timeAgo } from "@/lib/format";
import { parseImages } from "@/lib/json";
import { daysLeft, formatSafetyWhen } from "@/lib/safety";
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
  expiresAt: Date | null;
  createdAt: Date;
  author: { id: string; name: string; avatarUrl: string | null };
  event: { startsAt: Date; endsAt: Date | null; location: string } | null;
  safety: {
    location: string;
    happenedAt: Date | null;
    expiresAt: Date;
  } | null;
  _count: { comments: number; reactions: number };
};

export function PostCard({ post }: { post: FeedPost }) {
  const meta =
    POST_TYPE_META[post.type as PostTypeValue] ?? POST_TYPE_META.GENERAL;
  const images = parseImages(post.images);

  return (
    <Card
      className={`animate-fade-in ${
        post.type === "SAFETY" ? "border-pine-200 bg-pine-50/40" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <Link href={`/profile/${post.author.id}`} className="shrink-0">
          <Avatar name={post.author.name} src={post.author.avatarUrl} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Link
              href={`/profile/${post.author.id}`}
              className="truncate font-semibold hover:text-porch-700"
            >
              {post.author.name}
            </Link>
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

      <Link href={`/feed/${post.id}`} className="mt-3 block">
        {post.title && (
          <h2 className="font-display text-[1.15rem] font-semibold leading-snug">
            {post.title}
          </h2>
        )}

        {post.safety && (
          <p className="mt-1.5 text-sm font-semibold text-pine-700">
            {post.safety.location}
            {formatSafetyWhen(post.safety.happenedAt) && (
              <span className="block font-normal text-ink-soft">
                {formatSafetyWhen(post.safety.happenedAt)}
              </span>
            )}
            <span className="mt-0.5 block font-normal text-ink-soft">
              Leaves in {daysLeft(post.safety.expiresAt)}{" "}
              {daysLeft(post.safety.expiresAt) === 1 ? "day" : "days"}
            </span>
          </p>
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
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-2.5">
        <Link
          href={`/feed/${post.id}#comment-composer-input`}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-porch-800 hover:bg-porch-50"
        >
          Reply
          {post._count.comments > 0 && (
            <span className="tabular-nums text-ink-soft">
              {post._count.comments}
            </span>
          )}
        </Link>
        <Link
          href={`/feed/${post.id}`}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-ink-soft hover:bg-porch-50"
        >
          <span aria-hidden>👍</span>
          {post._count.reactions}
        </Link>
        <Link
          href={`/messages/new?to=${post.author.id}`}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-ink-soft hover:bg-porch-50"
        >
          Message
        </Link>
      </div>
    </Card>
  );
}

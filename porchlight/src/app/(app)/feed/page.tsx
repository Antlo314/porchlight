import { PostCard } from "@/components/post/PostCard";
import { PostTypeFilter } from "@/components/post/PostTypeFilter";
import { EmptyState, Fab } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { POST_TYPE_META, PostType } from "@/lib/validators";
import { visibleNeighborhoodIds } from "@/lib/visibility";
import { pluralize } from "@/lib/format";
import Link from "next/link";

const PAGE_SIZE = 40;

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[] }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const rawType = Array.isArray(params.type) ? params.type[0] : params.type;
  const parsed = PostType.safeParse(rawType);
  const activeType = parsed.success ? parsed.data : null;

  // Home neighborhood plus any the member follows.
  const neighborhoodIds = await visibleNeighborhoodIds(user);

  const [posts, upcomingEvents] = await Promise.all([
    db.post.findMany({
      where: {
        neighborhoodId: { in: neighborhoodIds },
        ...(activeType ? { type: activeType } : {}),
      },
      // Pinned notices ride at the top of the block, then newest first.
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: PAGE_SIZE,
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        event: { select: { startsAt: true, endsAt: true, location: true } },
        _count: { select: { comments: true, reactions: true } },
      },
    }),
    db.eventDetail.count({
      where: {
        startsAt: { gte: new Date() },
        post: { neighborhoodId: { in: neighborhoodIds } },
      },
    }),
  ]);

  return (
    <div className="space-y-3">
      <PostTypeFilter active={activeType} />

      {/* The events calendar has no tab of its own (five is the limit at 375px),
          so the feed is its entry point. */}
      <Link
        href="/events"
        className="flex min-h-12 items-center justify-between rounded-card border border-line bg-card px-4 transition-transform duration-100 active:scale-[0.99] active:bg-porch-50/50"
      >
        <span className="text-[15px] font-semibold">
          <span aria-hidden>📅</span> Upcoming events
        </span>
        <span className="flex items-center gap-2 text-sm text-ink-soft">
          {upcomingEvents > 0
            ? pluralize(upcomingEvents, "event")
            : "Nothing yet"}
          <span aria-hidden>→</span>
        </span>
      </Link>

      {posts.length === 0 ? (
        activeType ? (
          <EmptyState
            icon={POST_TYPE_META[activeType].icon}
            title={`No ${POST_TYPE_META[activeType].label.toLowerCase()} posts yet`}
            body={`Nothing here for ${user.neighborhood.name} right now. Start the conversation or clear the filter.`}
            actionLabel="Write one"
            actionHref={`/feed/new?type=${activeType}`}
          />
        ) : (
          <EmptyState
            icon="🏮"
            title="It's quiet on the block"
            body={`Be the first neighbor in ${user.neighborhood.name} to post something.`}
            actionLabel="Write a post"
            actionHref="/feed/new"
          />
        )
      ) : (
        <ul className="space-y-3">
          {posts.map((post) => (
            <li key={post.id}>
              <PostCard post={post} />
            </li>
          ))}
        </ul>
      )}

      <Fab href="/feed/new" label="New post" />
    </div>
  );
}

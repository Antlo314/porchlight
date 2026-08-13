import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CommentThread,
  type CommentNode,
} from "@/components/post/CommentThread";
import { PostImages } from "@/components/post/PostImages";
import { PostMenu } from "@/components/post/PostMenu";
import {
  ReactionBar,
  type ReactionCounts,
  type ReactionKind,
} from "@/components/post/ReactionBar";
import { RsvpButton } from "@/components/event/RsvpButton";
import {
  Avatar,
  AvatarStack,
  Badge,
  Card,
  SectionHeading,
  VerifiedMark,
} from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEventForPost } from "@/lib/events";
import { formatEventRange, pluralize, timeAgo } from "@/lib/format";
import { parseImages } from "@/lib/json";
import { POST_TYPE_META, type PostTypeValue } from "@/lib/validators";
import { canViewNeighborhood } from "../queries";
import {
  createCommentAction,
  deleteCommentAction,
  deletePostAction,
  toggleReactionAction,
} from "./actions";

const REACTION_KINDS = ["LIKE", "THANKS", "HELPFUL"] as const;

function asReactionKind(value: string | undefined): ReactionKind | null {
  return REACTION_KINDS.includes(value as ReactionKind)
    ? (value as ReactionKind)
    : null;
}

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const post = await db.post.findUnique({
    where: { id },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          karma: true,
          verifiedAt: true,
        },
      },
      reactions: { select: { userId: true, kind: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
    },
  });
  if (!post) notFound();

  const allowed = await canViewNeighborhood({
    userId: user.id,
    homeNeighborhoodId: user.neighborhoodId,
    neighborhoodId: post.neighborhoodId,
  });
  if (!allowed) notFound();

  const meta =
    POST_TYPE_META[post.type as PostTypeValue] ?? POST_TYPE_META.GENERAL;
  const images = parseImages(post.images);

  const counts: ReactionCounts = { LIKE: 0, THANKS: 0, HELPFUL: 0 };
  for (const reaction of post.reactions) {
    const kind = asReactionKind(reaction.kind);
    if (kind) counts[kind] += 1;
  }
  const myReaction = asReactionKind(
    post.reactions.find((r) => r.userId === user.id)?.kind
  );

  // One level of threading: replies hang off their root comment.
  const roots: CommentNode[] = post.comments
    .filter((c) => c.parentId === null)
    .map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt,
      author: c.author,
      replies: [],
    }));
  const rootsById = new Map<string, CommentNode>(
    roots.map((r) => [r.id, r])
  );
  for (const comment of post.comments) {
    if (!comment.parentId) continue;
    rootsById.get(comment.parentId)?.replies.push({
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt,
      author: comment.author,
    });
  }

  const event = post.type === "EVENT" ? await getEventForPost(post.id) : null;
  const goingRsvps = event?.rsvps.filter((r) => r.status === "GOING") ?? [];
  const myRsvpRaw = event?.rsvps.find((r) => r.userId === user.id)?.status;
  const myRsvp =
    myRsvpRaw === "GOING" || myRsvpRaw === "MAYBE" ? myRsvpRaw : null;

  return (
    <div className="space-y-4">
      <Link
        href="/feed"
        className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-ink-soft"
      >
        ← Back to the feed
      </Link>

      <Card className="animate-fade-in">
        <div className="flex items-start gap-3">
          <Avatar name={post.author.name} src={post.author.avatarUrl} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="truncate font-semibold">
                {post.author.name}
              </span>
              {post.author.verifiedAt && (
                <VerifiedMark label="Verified neighbor" />
              )}
            </div>
            <p className="text-sm text-ink-soft">
              {timeAgo(post.createdAt)} · {post.author.karma} karma
            </p>
          </div>
          <PostMenu
            postId={post.id}
            canDelete={post.authorId === user.id}
            deletePost={deletePostAction}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge className={meta.badgeClass}>
            <span aria-hidden>{meta.icon}</span>
            {meta.label}
          </Badge>
          {post.pinned && (
            <Badge className="bg-porch-600 text-white">📌 Pinned</Badge>
          )}
        </div>

        {post.title && (
          <h1 className="mt-3 text-xl font-bold leading-snug">{post.title}</h1>
        )}

        <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">
          {post.body}
        </p>

        <PostImages images={images} expanded />
      </Card>

      {event && (
        <Card className="animate-fade-in">
          <p className="text-sm font-semibold text-pine-600">
            📅 {formatEventRange(event.startsAt, event.endsAt)}
          </p>
          <p className="mt-0.5 text-[15px]">📍 {event.location}</p>

          <div className="mt-3">
            <RsvpButton
              eventId={post.id}
              initialStatus={myRsvp}
              initialGoingCount={goingRsvps.length}
            />
          </div>

          {goingRsvps.length > 0 && (
            <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
              <AvatarStack people={goingRsvps.map((r) => r.user)} />
              <span className="text-sm text-ink-soft">
                {pluralize(goingRsvps.length, "neighbor")} going
              </span>
            </div>
          )}
        </Card>
      )}

      <ReactionBar
        postId={post.id}
        initialKind={myReaction}
        initialCounts={counts}
        toggleReaction={toggleReactionAction}
      />

      <div>
        <SectionHeading
          title={pluralize(post.comments.length, "comment")}
        />
        <CommentThread
          postId={post.id}
          comments={roots}
          currentUser={{
            id: user.id,
            name: user.name,
            avatarUrl: user.avatarUrl,
          }}
          createComment={createCommentAction}
          deleteComment={deleteCommentAction}
        />
      </div>
    </div>
  );
}

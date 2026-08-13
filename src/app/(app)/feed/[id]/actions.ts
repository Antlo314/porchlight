"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { truncate } from "@/lib/format";
import { notify } from "@/lib/notify";
import { createCommentSchema, reactionSchema } from "@/lib/validators";
import { canViewNeighborhood } from "../queries";

// Id-only guards for the two delete actions; every domain schema still comes
// from @/lib/validators.
const postIdSchema = z.object({ postId: z.string().min(1) });
const commentIdSchema = z.object({ commentId: z.string().min(1) });

function postLabel(post: { title: string | null; body: string }) {
  return post.title ?? truncate(post.body, 40);
}

/**
 * Adds, switches, or removes the caller's reaction (Reaction is keyed on
 * userId+postId, so a member holds at most one). The post's author earns a
 * karma point when a neighbor reacts, and loses it if they take it back.
 */
export async function toggleReactionAction(input: {
  postId: string;
  kind: "LIKE" | "THANKS" | "HELPFUL";
}): Promise<{ error?: string } | undefined> {
  const user = await requireUser();

  const parsed = reactionSchema.safeParse(input);
  if (!parsed.success) return { error: "That reaction isn't valid" };
  const { postId, kind } = parsed.data;

  const post = await db.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, neighborhoodId: true },
  });
  if (!post) return { error: "That post is gone" };

  const allowed = await canViewNeighborhood({
    userId: user.id,
    homeNeighborhoodId: user.neighborhoodId,
    neighborhoodId: post.neighborhoodId,
  });
  if (!allowed) return { error: "That post isn't in your neighborhood" };

  const existing = await db.reaction.findUnique({
    where: { userId_postId: { userId: user.id, postId } },
    select: { kind: true },
  });

  // Karma only moves for a genuine first reaction from someone else.
  const earnsKarma = post.authorId !== user.id;

  if (existing?.kind === kind) {
    await db.reaction.delete({
      where: { userId_postId: { userId: user.id, postId } },
    });
    if (earnsKarma) {
      await db.user.update({
        where: { id: post.authorId },
        data: { karma: { decrement: 1 } },
      });
    }
  } else if (existing) {
    await db.reaction.update({
      where: { userId_postId: { userId: user.id, postId } },
      data: { kind },
    });
  } else {
    await db.reaction.create({ data: { userId: user.id, postId, kind } });
    if (earnsKarma) {
      await db.user.update({
        where: { id: post.authorId },
        data: { karma: { increment: 1 } },
      });
    }
  }

  revalidatePath(`/feed/${postId}`);
  revalidatePath("/feed");
  return undefined;
}

/**
 * Adds a comment or a one-level reply, gives the commenter a karma point, and
 * notifies the post author (plus the parent comment's author on a reply).
 */
export async function createCommentAction(input: {
  postId: string;
  parentId?: string;
  body: string;
}): Promise<{ error?: string } | undefined> {
  const user = await requireUser();

  const parsed = createCommentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Write something first" };
  }
  const { postId, body } = parsed.data;

  const post = await db.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      authorId: true,
      neighborhoodId: true,
      title: true,
      body: true,
    },
  });
  if (!post) return { error: "That post is gone" };

  const allowed = await canViewNeighborhood({
    userId: user.id,
    homeNeighborhoodId: user.neighborhoodId,
    neighborhoodId: post.neighborhoodId,
  });
  if (!allowed) return { error: "That post isn't in your neighborhood" };

  let parentId: string | null = null;
  let repliedToAuthorId: string | null = null;

  if (parsed.data.parentId) {
    const parent = await db.comment.findUnique({
      where: { id: parsed.data.parentId },
      select: { id: true, postId: true, parentId: true, authorId: true },
    });
    if (!parent || parent.postId !== post.id) {
      return { error: "That comment is gone" };
    }
    // Threading stays one level deep: replying to a reply attaches to its root.
    parentId = parent.parentId ?? parent.id;
    repliedToAuthorId = parent.authorId;
  }

  await db.comment.create({
    data: { postId: post.id, authorId: user.id, parentId, body },
  });

  await db.user.update({
    where: { id: user.id },
    data: { karma: { increment: 1 } },
  });

  await notify({
    userId: post.authorId,
    actorId: user.id,
    type: "NEW_COMMENT",
    payload: {
      href: `/feed/${post.id}`,
      text: `${user.name} commented on "${postLabel(post)}"`,
      actorName: user.name,
    },
  });

  if (repliedToAuthorId && repliedToAuthorId !== post.authorId) {
    await notify({
      userId: repliedToAuthorId,
      actorId: user.id,
      type: "NEW_COMMENT",
      payload: {
        href: `/feed/${post.id}`,
        text: `${user.name} replied to your comment`,
        actorName: user.name,
      },
    });
  }

  revalidatePath(`/feed/${post.id}`);
  revalidatePath("/feed");
  return undefined;
}

/** Only the comment's author may remove it. */
export async function deleteCommentAction(input: {
  commentId: string;
}): Promise<{ error?: string } | undefined> {
  const user = await requireUser();

  const parsed = commentIdSchema.safeParse(input);
  if (!parsed.success) return { error: "That comment isn't valid" };

  const comment = await db.comment.findUnique({
    where: { id: parsed.data.commentId },
    select: { id: true, authorId: true, postId: true },
  });
  if (!comment) return { error: "That comment is already gone" };
  if (comment.authorId !== user.id) {
    return { error: "You can only delete your own comments" };
  }

  await db.comment.delete({ where: { id: comment.id } });

  revalidatePath(`/feed/${comment.postId}`);
  revalidatePath("/feed");
  return undefined;
}

/** Only the post's author may remove it; comments, reactions and the event
 *  row cascade away with it. */
export async function deletePostAction(input: {
  postId: string;
}): Promise<{ error?: string } | undefined> {
  const user = await requireUser();

  const parsed = postIdSchema.safeParse(input);
  if (!parsed.success) return { error: "That post isn't valid" };

  const post = await db.post.findUnique({
    where: { id: parsed.data.postId },
    select: { id: true, authorId: true },
  });
  if (!post) return { error: "That post is already gone" };
  if (post.authorId !== user.id) {
    return { error: "You can only delete your own posts" };
  }

  await db.post.delete({ where: { id: post.id } });

  revalidatePath("/feed");
  redirect("/feed");
}

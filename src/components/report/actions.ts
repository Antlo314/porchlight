"use server";

// The one write path for user-filed reports. It lives beside <ReportSheet>
// rather than in a route folder because every vertical (feed, barter, services,
// messages) files reports through the same sheet.
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createReportSchema } from "@/lib/validators";
import {
  encodeReason,
  TARGET_TYPE_META,
  type ReportTargetType,
  type SubmitReportResult,
} from "./reportMeta";

type AccessCheck = { ok: true; ownerId: string | null } | { ok: false; error: string };

/** A member can see their home neighborhood plus any neighborhood they follow. */
async function canSeeNeighborhood(
  userId: string,
  homeNeighborhoodId: string,
  neighborhoodId: string
): Promise<boolean> {
  if (neighborhoodId === homeNeighborhoodId) return true;
  const follow = await db.neighborhoodFollow.findUnique({
    where: { userId_neighborhoodId: { userId, neighborhoodId } },
    select: { userId: true },
  });
  return follow !== null;
}

function gone(targetType: ReportTargetType): AccessCheck {
  return {
    ok: false,
    error: `That ${TARGET_TYPE_META[targetType].noun} is no longer here.`,
  };
}

function outOfReach(targetType: ReportTargetType): AccessCheck {
  return {
    ok: false,
    error: `That ${TARGET_TYPE_META[targetType].noun} isn't in your neighborhood.`,
  };
}

/**
 * Confirms the reporter can actually see what they're reporting. Without this a
 * client could enumerate ids from other neighborhoods (or other people's DMs)
 * and confirm they exist just by watching which reports succeed.
 */
async function checkAccess(
  user: { id: string; neighborhoodId: string },
  targetType: ReportTargetType,
  targetId: string
): Promise<AccessCheck> {
  switch (targetType) {
    case "POST": {
      const post = await db.post.findUnique({
        where: { id: targetId },
        select: { authorId: true, neighborhoodId: true },
      });
      if (!post) return gone(targetType);
      if (
        !(await canSeeNeighborhood(user.id, user.neighborhoodId, post.neighborhoodId))
      ) {
        return outOfReach(targetType);
      }
      return { ok: true, ownerId: post.authorId };
    }

    case "COMMENT": {
      const comment = await db.comment.findUnique({
        where: { id: targetId },
        select: {
          authorId: true,
          post: { select: { neighborhoodId: true } },
        },
      });
      if (!comment) return gone(targetType);
      if (
        !(await canSeeNeighborhood(
          user.id,
          user.neighborhoodId,
          comment.post.neighborhoodId
        ))
      ) {
        return outOfReach(targetType);
      }
      return { ok: true, ownerId: comment.authorId };
    }

    case "MESSAGE": {
      const message = await db.message.findUnique({
        where: { id: targetId },
        select: { senderId: true, conversationId: true },
      });
      if (!message) return gone(targetType);
      const participant = await db.conversationParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId: message.conversationId,
            userId: user.id,
          },
        },
        select: { userId: true },
      });
      if (!participant) {
        return {
          ok: false,
          error: "You can only report messages from your own conversations.",
        };
      }
      return { ok: true, ownerId: message.senderId };
    }

    case "LISTING": {
      const listing = await db.barterListing.findUnique({
        where: { id: targetId },
        select: { ownerId: true, neighborhoodId: true },
      });
      if (!listing) return gone(targetType);
      if (
        !(await canSeeNeighborhood(
          user.id,
          user.neighborhoodId,
          listing.neighborhoodId
        ))
      ) {
        return outOfReach(targetType);
      }
      return { ok: true, ownerId: listing.ownerId };
    }

    case "BUSINESS": {
      const business = await db.business.findUnique({
        where: { id: targetId },
        select: { ownerId: true, neighborhoodId: true },
      });
      if (!business) return gone(targetType);
      if (
        !(await canSeeNeighborhood(
          user.id,
          user.neighborhoodId,
          business.neighborhoodId
        ))
      ) {
        return outOfReach(targetType);
      }
      return { ok: true, ownerId: business.ownerId };
    }

    case "USER": {
      const person = await db.user.findUnique({
        where: { id: targetId },
        select: { id: true },
      });
      if (!person) return gone(targetType);
      // Neighbors are reachable across neighborhoods (comments, DMs, business
      // pages), so there's no neighborhood gate here — only the self check.
      return { ok: true, ownerId: person.id };
    }
  }
}

export async function submitReportAction(input: {
  targetType: string;
  targetId: string;
  reason: string;
  detail?: string;
}): Promise<SubmitReportResult> {
  const user = await requireUser();

  const parsed = createReportSchema.safeParse({
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason,
    detail: input.detail?.trim() ? input.detail : undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Pick a reason first.",
    };
  }

  const { targetType, targetId, reason, detail } = parsed.data;

  const access = await checkAccess(user, targetType, targetId);
  if (!access.ok) return { ok: false, error: access.error };

  if (access.ownerId === user.id) {
    return {
      ok: false,
      error: `That's your own ${TARGET_TYPE_META[targetType].noun}.`,
    };
  }

  // One open report per person per target. Re-reporting the same thing while a
  // moderator is already looking at it just makes the queue noisier.
  const existing = await db.report.findFirst({
    where: {
      reporterId: user.id,
      targetType,
      targetId,
      status: "OPEN",
    },
    select: { id: true },
  });
  if (existing) return { ok: true, duplicate: true };

  await db.report.create({
    data: {
      reporterId: user.id,
      targetType,
      targetId,
      reason: encodeReason(reason, detail),
    },
  });

  revalidatePath("/moderation");
  return { ok: true, duplicate: false };
}

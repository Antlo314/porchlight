// Notification creation. Every vertical routes through notify() so the payload
// shape and self-notification suppression stay consistent.
import { db } from "./db";

export type NotificationType =
  | "NEW_COMMENT"
  | "NEW_MESSAGE"
  | "OFFER_RECEIVED"
  | "OFFER_ACCEPTED"
  | "OFFER_DECLINED"
  | "RSVP"
  | "REVIEW"
  | "JOB_REQUEST"
  | "JOB_REPLY"
  | "WANT_MATCHED"
  | "SYSTEM";

export type NotificationPayload = {
  /** Where tapping the notification should take the user. */
  href: string;
  /** One-line summary rendered in the list. */
  text: string;
  /** Display name of whoever triggered it, when there is one. */
  actorName?: string;
};

export async function notify(opts: {
  userId: string;
  /** Suppresses the notification when the actor is also the recipient. */
  actorId?: string;
  type: NotificationType;
  payload: NotificationPayload;
}) {
  if (opts.actorId && opts.actorId === opts.userId) return;

  await db.notification.create({
    data: {
      userId: opts.userId,
      type: opts.type,
      payload: JSON.stringify(opts.payload),
    },
  });
}

/**
 * Fan-out variant: one INSERT for the whole recipient list instead of one per
 * person. Used where a single event notifies many members at once (a new job
 * request reaching every matching business), which would otherwise put dozens
 * of round trips on the critical path of a form submit.
 */
export async function notifyMany(opts: {
  userIds: string[];
  /** Suppressed from the recipient list, same rule as notify(). */
  actorId?: string;
  type: NotificationType;
  payload: NotificationPayload;
}) {
  const recipients = Array.from(new Set(opts.userIds)).filter(
    (id) => id !== opts.actorId
  );
  if (recipients.length === 0) return;

  const payload = JSON.stringify(opts.payload);
  await db.notification.createMany({
    data: recipients.map((userId) => ({ userId, type: opts.type, payload })),
  });
}

export async function unreadNotificationCount(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, readAt: null } });
}

export async function unreadMessageCount(userId: string): Promise<number> {
  // A conversation is "unread" when it holds a message newer than the
  // participant's lastReadAt that someone else sent.
  //
  // This runs on every render of the (app) shell to badge the Messages tab, so
  // it must stay at two queries regardless of how many conversations the member
  // is in — one row per unread conversation, counted by grouping rather than by
  // asking per conversation.
  const parts = await db.conversationParticipant.findMany({
    where: { userId },
    select: { conversationId: true, lastReadAt: true },
  });
  if (parts.length === 0) return 0;

  const groups = await db.message.groupBy({
    by: ["conversationId"],
    where: {
      senderId: { not: userId },
      OR: parts.map((p) => ({
        conversationId: p.conversationId,
        createdAt: { gt: p.lastReadAt },
      })),
    },
    _count: { _all: true },
  });

  return groups.length;
}

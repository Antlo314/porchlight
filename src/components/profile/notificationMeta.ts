import type { NotificationType } from "@/lib/notify";

/**
 * Display metadata per notification type. `type` is a plain String column
 * (SQLite has no enums), so every lookup goes through notificationMeta() —
 * an unknown value from an older row falls back to SYSTEM instead of crashing.
 */
export const NOTIFICATION_META: Record<
  NotificationType,
  { icon: string; label: string; iconClass: string }
> = {
  NEW_COMMENT: {
    icon: "💬",
    label: "Comment",
    iconClass: "bg-porch-50",
  },
  NEW_MESSAGE: {
    icon: "✉️",
    label: "Message",
    iconClass: "bg-porch-50",
  },
  OFFER_RECEIVED: {
    icon: "🤝",
    label: "Offer",
    iconClass: "bg-porch-100",
  },
  OFFER_ACCEPTED: {
    icon: "✅",
    label: "Offer accepted",
    iconClass: "bg-pine-500/10",
  },
  OFFER_DECLINED: {
    icon: "↩️",
    label: "Offer declined",
    iconClass: "bg-line",
  },
  RSVP: {
    icon: "📅",
    label: "RSVP",
    iconClass: "bg-pine-500/10",
  },
  REVIEW: {
    icon: "⭐",
    label: "Review",
    iconClass: "bg-porch-100",
  },
  JOB_REQUEST: {
    icon: "🧰",
    label: "Job request",
    iconClass: "bg-porch-100",
  },
  JOB_REPLY: {
    icon: "📬",
    label: "Pro replied",
    iconClass: "bg-pine-500/10",
  },
  WANT_MATCHED: {
    icon: "🎯",
    label: "Match",
    iconClass: "bg-porch-100",
  },
  SYSTEM: {
    icon: "🏮",
    label: "Porchlight",
    iconClass: "bg-porch-50",
  },
};

export function notificationMeta(type: string) {
  return NOTIFICATION_META[type as NotificationType] ?? NOTIFICATION_META.SYSTEM;
}

const FALLBACK_TEXT: Record<NotificationType, string> = {
  NEW_COMMENT: "commented on your post",
  NEW_MESSAGE: "sent you a message",
  OFFER_RECEIVED: "made an offer on your listing",
  OFFER_ACCEPTED: "accepted your offer",
  OFFER_DECLINED: "passed on your offer",
  RSVP: "responded to your event",
  REVIEW: "left a review",
  JOB_REQUEST: "asked the block for help with a job",
  JOB_REPLY: "replied to your job request",
  WANT_MATCHED: "listed something you were looking for",
  SYSTEM: "There's an update from Porchlight",
};

/**
 * Used when a row's payload is missing or malformed. A bad JSON blob should
 * still render something a human can act on rather than an empty line.
 */
export function notificationFallbackText(
  type: string,
  actorName: string | null
): string {
  const key = (type in FALLBACK_TEXT ? type : "SYSTEM") as NotificationType;
  if (key === "SYSTEM") return FALLBACK_TEXT.SYSTEM;
  return `${actorName ?? "A neighbor"} ${FALLBACK_TEXT[key]}`;
}

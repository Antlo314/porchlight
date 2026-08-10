import {
  NotificationList,
  type NotificationRow,
} from "@/components/profile/NotificationList";
import { notificationFallbackText } from "@/components/profile/notificationMeta";
import { EmptyState } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parsePayload } from "@/lib/json";
import type { NotificationPayload } from "@/lib/notify";
import { markAllNotificationsRead } from "./actions";

export const metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 60;

/**
 * A payload is user-adjacent data that was serialized by another vertical, so
 * treat every field as untrusted: only in-app absolute paths become links, and
 * anything else renders as plain, non-navigating text.
 */
function safeHref(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return null;
  // "//evil.example" is protocol-relative — an off-site link in disguise.
  if (trimmed.startsWith("//")) return null;
  return trimmed;
}

function safeText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export default async function NotificationsPage() {
  const user = await requireUser();

  const rows = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
  });

  const items: NotificationRow[] = rows.map((row) => {
    const payload = parsePayload<NotificationPayload>(row.payload);
    const actorName = safeText(payload.actorName);
    return {
      id: row.id,
      type: row.type,
      href: safeHref(payload.href),
      text:
        safeText(payload.text) ??
        notificationFallbackText(row.type, actorName),
      createdAt: row.createdAt.toISOString(),
      unread: row.readAt === null,
    };
  });

  // Marking read is deliberately NOT done here: this render also happens on a
  // router prefetch, which would clear the bell for a screen nobody looked at.
  // NotificationList fires markAllNotificationsRead() once it's actually shown.
  if (items.length === 0) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-bold">Notifications</h1>
        <EmptyState
          icon="🔔"
          title="Nothing yet"
          body="When a neighbor comments, offers a trade, or RSVPs to your event, it lands here."
          actionLabel="Go to the feed"
          actionHref="/feed"
        />
      </div>
    );
  }

  return (
    <NotificationList items={items} markAllAction={markAllNotificationsRead} />
  );
}

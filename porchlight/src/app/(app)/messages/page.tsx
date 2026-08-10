import {
  Avatar,
  AvatarStack,
  CardLink,
  EmptyState,
  Fab,
  SectionHeading,
} from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { timeAgo, truncate } from "@/lib/format";
import { conversationTitle, otherParticipants } from "./queries";

// Always fresh: an inbox that lags behind a sent message reads as broken.
export const dynamic = "force-dynamic";

const PREVIEW_CHARS = 64;

export default async function MessagesPage() {
  const user = await requireUser();

  const conversations = await db.conversation.findMany({
    where: { participants: { some: { userId: user.id } } },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      participants: {
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { sender: { select: { id: true, name: true } } },
      },
    },
  });

  // One grouped count for the whole inbox: a conversation is unread when it
  // holds a message from someone else newer than *this* viewer's lastReadAt.
  const unreadByConversation = new Map<string, number>();
  const mine = conversations
    .map((c) => c.participants.find((p) => p.userId === user.id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  if (mine.length > 0) {
    const rows = await db.message.groupBy({
      by: ["conversationId"],
      where: {
        senderId: { not: user.id },
        OR: mine.map((p) => ({
          conversationId: p.conversationId,
          createdAt: { gt: p.lastReadAt },
        })),
      },
      _count: { _all: true },
    });
    for (const row of rows) {
      unreadByConversation.set(row.conversationId, row._count._all);
    }
  }

  return (
    <div>
      <SectionHeading title="Messages" />

      {conversations.length === 0 ? (
        <EmptyState
          icon="💬"
          title="No conversations yet"
          body="Message a neighbor from their profile, a barter listing, or start one here."
          actionLabel="Start a conversation"
          actionHref="/messages/new"
        />
      ) : (
        <ul className="space-y-2">
          {conversations.map((conversation) => {
            const others = otherParticipants(
              conversation.participants,
              user.id
            );
            const title = conversationTitle(conversation, others);
            const last = conversation.messages[0];
            const unread = unreadByConversation.get(conversation.id) ?? 0;

            const prefix = !last
              ? ""
              : last.sender.id === user.id
                ? "You: "
                : conversation.isGroup
                  ? `${last.sender.name.split(" ")[0]}: `
                  : "";

            return (
              <li key={conversation.id}>
                <CardLink
                  href={`/messages/${conversation.id}`}
                  padded={false}
                  className={
                    unread > 0 ? "border-porch-200 bg-porch-50/40" : undefined
                  }
                >
                  <div className="flex min-h-16 items-center gap-3 p-3">
                    {others.length > 1 ? (
                      <AvatarStack
                        people={others.map((p) => p.user)}
                        max={3}
                      />
                    ) : (
                      <Avatar
                        name={others[0]?.user.name ?? title}
                        src={others[0]?.user.avatarUrl}
                        size="md"
                      />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <p
                          className={`min-w-0 flex-1 truncate ${
                            unread > 0 ? "font-bold" : "font-semibold"
                          }`}
                        >
                          {title}
                        </p>
                        {last && (
                          <span className="shrink-0 text-xs text-ink-soft">
                            {timeAgo(last.createdAt)}
                          </span>
                        )}
                      </div>

                      <div className="mt-0.5 flex items-center gap-2">
                        <p
                          className={`min-w-0 flex-1 truncate text-sm ${
                            unread > 0
                              ? "font-semibold text-ink"
                              : "text-ink-soft"
                          }`}
                        >
                          {last
                            ? `${prefix}${truncate(last.body, PREVIEW_CHARS)}`
                            : "No messages yet"}
                        </p>
                        {unread > 0 && (
                          <span
                            aria-label={`${unread} unread`}
                            className="min-w-5 shrink-0 rounded-full bg-porch-600 px-1.5 text-center text-[11px] font-bold leading-5 text-white"
                          >
                            {unread > 9 ? "9+" : unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardLink>
              </li>
            );
          })}
        </ul>
      )}

      <Fab href="/messages/new" label="New message" icon="✎" />
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import MessageThread from "@/components/chat/MessageThread";
import { toChatMessage } from "@/components/chat/types";
import { Avatar, AvatarStack } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { pluralize } from "@/lib/format";
import { conversationTitle, otherParticipants } from "../queries";
import { sendMessage } from "./actions";

export const dynamic = "force-dynamic";

const HISTORY_LIMIT = 200;

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  // Captured before the read so a message landing mid-render still gets polled.
  const openedAt = new Date().toISOString();

  const conversation = await db.conversation.findUnique({
    where: { id },
    include: {
      participants: {
        orderBy: { joinedAt: "asc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              neighborhood: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  // Authorization: a conversation you aren't in must be indistinguishable from
  // one that doesn't exist.
  const membership = conversation?.participants.find(
    (p) => p.userId === user.id
  );
  if (!conversation || !membership) notFound();

  const rows = await db.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
  });
  const messages = rows.reverse().map(toChatMessage);

  // Opening the thread clears its unread state.
  await db.conversationParticipant.update({
    where: {
      conversationId_userId: { conversationId: conversation.id, userId: user.id },
    },
    data: { lastReadAt: new Date() },
  });

  const others = otherParticipants(conversation.participants, user.id);
  const title = conversationTitle(conversation, others);
  const subtitle = conversation.isGroup
    ? pluralize(conversation.participants.length, "member")
    : (others[0]?.user.neighborhood.name ?? "Porchlight neighbor");

  return (
    <div>
      <div className="-mt-2 mb-1 flex items-center gap-3 border-b border-line pb-3">
        <Link
          href="/messages"
          aria-label="Back to messages"
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl text-ink-soft active:bg-line/60"
        >
          ←
        </Link>

        {others.length > 1 ? (
          <AvatarStack people={others.map((p) => p.user)} max={3} />
        ) : (
          <Avatar
            name={others[0]?.user.name ?? title}
            src={others[0]?.user.avatarUrl}
            size="md"
          />
        )}

        <div className="min-w-0 flex-1">
          <h1 className="truncate font-bold leading-tight">{title}</h1>
          <p className="truncate text-xs text-ink-soft">{subtitle}</p>
        </div>
      </div>

      <MessageThread
        conversationId={conversation.id}
        currentUserId={user.id}
        currentUserName={user.name}
        currentUserAvatarUrl={user.avatarUrl}
        isGroup={conversation.isGroup}
        initialMessages={messages}
        openedAt={openedAt}
        sendAction={sendMessage}
      />
    </div>
  );
}

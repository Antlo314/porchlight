// Shared reads for the messaging vertical. Not a route — Next only treats
// page/layout/route/loading/error files in the app dir as routable.
import { db } from "@/lib/db";

export type ParticipantLite = {
  userId: string;
  user: { id: string; name: string; avatarUrl: string | null };
};

/**
 * The id of the existing 1:1 conversation between two users, or null.
 *
 * Reuse matters: without an exact participant-set match every "Message" tap
 * would spawn a duplicate thread. `some`-filters alone would also match a group
 * that happens to contain both people, so the set size is checked too.
 */
export async function findDirectConversationId(
  userAId: string,
  userBId: string
): Promise<string | null> {
  if (userAId === userBId) return null;

  const candidates = await db.conversation.findMany({
    where: {
      isGroup: false,
      AND: [
        { participants: { some: { userId: userAId } } },
        { participants: { some: { userId: userBId } } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, participants: { select: { userId: true } } },
  });

  const exact = candidates.find(
    (c) =>
      c.participants.length === 2 &&
      c.participants.every(
        (p) => p.userId === userAId || p.userId === userBId
      )
  );
  return exact?.id ?? null;
}

/** Everyone in the conversation except the viewer. */
export function otherParticipants<T extends ParticipantLite>(
  participants: T[],
  currentUserId: string
): T[] {
  return participants.filter((p) => p.userId !== currentUserId);
}

/** Group title if there is one, otherwise the other participants' names. */
export function conversationTitle(
  conversation: { title: string | null; isGroup: boolean },
  others: ParticipantLite[]
): string {
  if (conversation.title) return conversation.title;
  if (others.length === 0) return "Just you";
  return others.map((p) => p.user.name).join(", ");
}

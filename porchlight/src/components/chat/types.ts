// Shared message shape for the chat vertical. Dates cross the server/client
// boundary as ISO strings so the same object works for RSC props, server-action
// return values, and the polling endpoint's JSON.

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  body: string;
  imageUrl: string | null;
  createdAt: string;
  /** Client-only: optimistic message still in flight. */
  pending?: boolean;
  /** Client-only: the send failed and can be retried. */
  failed?: boolean;
};

export type SendMessageResult =
  | { ok: true; message: ChatMessage }
  | { ok: false; error: string };

/** Shape of the `sendMessage` server action, passed down as a prop. */
export type SendMessageAction = (input: {
  conversationId: string;
  body: string;
}) => Promise<SendMessageResult>;

/**
 * `startConversation` redirects into the thread on success, so it only ever
 * *returns* when something went wrong.
 */
export type StartConversationAction = (input: {
  recipientId: string;
  body: string;
}) => Promise<{ ok: false; error: string } | void>;

type MessageRow = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  imageUrl: string | null;
  createdAt: Date;
  sender: { id: string; name: string; avatarUrl: string | null };
};

export function toChatMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversationId,
    senderId: row.senderId,
    senderName: row.sender.name,
    senderAvatarUrl: row.sender.avatarUrl,
    body: row.body,
    imageUrl: row.imageUrl,
    createdAt: row.createdAt.toISOString(),
  };
}

function sortKey(m: ChatMessage) {
  return `${m.createdAt}|${m.id}`;
}

/**
 * Folds server messages (initial render, a revalidation, or a poll tick) into
 * whatever the client already has. Returns the *same array reference* when
 * nothing changed so a `setState` from an effect can't loop.
 */
export function mergeMessages(
  current: ChatMessage[],
  incoming: ChatMessage[]
): ChatMessage[] {
  if (incoming.length === 0) return current;

  const byId = new Map<string, ChatMessage>();
  for (const m of current) byId.set(m.id, m);
  for (const m of incoming) {
    const existing = byId.get(m.id);
    // Server rows win, but never clobber a real row with an older copy.
    byId.set(m.id, existing?.pending ? m : { ...existing, ...m });
  }

  const confirmed = [...byId.values()].filter((m) => !m.pending);
  // Drop optimistic rows whose real counterpart has landed.
  const pending = [...byId.values()].filter(
    (m) =>
      m.pending &&
      !confirmed.some((c) => c.senderId === m.senderId && c.body === m.body)
  );

  const next = [...confirmed, ...pending].sort((a, b) =>
    sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : 0
  );

  if (next.length === current.length) {
    const unchanged = next.every((m, i) => {
      const prev = current[i];
      return (
        prev &&
        prev.id === m.id &&
        prev.body === m.body &&
        prev.pending === m.pending &&
        prev.failed === m.failed
      );
    });
    if (unchanged) return current;
  }
  return next;
}

/**
 * Polling cursor: the newest confirmed message, or `fallback` (the moment the
 * conversation was opened) when the thread is still empty.
 */
export function latestCursor(messages: ChatMessage[], fallback: string): string {
  let latest: string | null = null;
  for (const m of messages) {
    if (!m.pending && (latest === null || m.createdAt > latest)) {
      latest = m.createdAt;
    }
  }
  return latest ?? fallback;
}

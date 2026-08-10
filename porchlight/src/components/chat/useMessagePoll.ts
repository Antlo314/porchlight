"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "./types";

/**
 * Near-realtime delivery without a socket: poll the conversation's message
 * endpoint every `intervalMs`, but only while the tab is actually visible so a
 * backgrounded tab costs nothing. Coming back to the tab fetches immediately.
 */
export function useMessagePoll({
  conversationId,
  since,
  onMessages,
  intervalMs = 4000,
  enabled = true,
}: {
  conversationId: string;
  /** ISO timestamp of the newest message the client already has. */
  since: string;
  onMessages: (messages: ChatMessage[]) => void;
  intervalMs?: number;
  enabled?: boolean;
}) {
  // Kept in refs so a new cursor or callback never tears down the interval.
  const sinceRef = useRef(since);
  const onMessagesRef = useRef(onMessages);

  useEffect(() => {
    sinceRef.current = since;
  }, [since]);

  useEffect(() => {
    onMessagesRef.current = onMessages;
  });

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let inFlight = false;

    async function tick() {
      if (cancelled || inFlight) return;
      if (document.visibilityState !== "visible") return;

      inFlight = true;
      try {
        const res = await fetch(
          `/api/conversations/${encodeURIComponent(conversationId)}/messages?since=${encodeURIComponent(sinceRef.current)}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data: unknown = await res.json();
        const messages =
          data && typeof data === "object" && "messages" in data
            ? (data as { messages: ChatMessage[] }).messages
            : [];
        if (!cancelled && Array.isArray(messages) && messages.length > 0) {
          onMessagesRef.current(messages);
        }
      } catch {
        // Offline or a flaky hop — the next tick retries.
      } finally {
        inFlight = false;
      }
    }

    const timer = setInterval(tick, intervalMs);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [conversationId, intervalMs, enabled]);
}

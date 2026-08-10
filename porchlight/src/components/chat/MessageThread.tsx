"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Avatar, EmptyState, useToast } from "@/components/ui";
import { formatEventTime } from "@/lib/format";
import { sendMessageSchema } from "@/lib/validators";
import Composer from "./Composer";
import { dayKey, dayLabel, sameGroupWindow } from "./date";
import {
  latestCursor,
  mergeMessages,
  type ChatMessage,
  type SendMessageAction,
} from "./types";
import { useMessagePoll } from "./useMessagePoll";

const BODY_MAX = sendMessageSchema.shape.body.maxLength ?? 4000;
/** Auto-scroll only when the reader was already parked at the bottom. */
const STICK_THRESHOLD = 180;

type Row =
  | { kind: "divider"; key: string; label: string }
  | {
      kind: "group";
      key: string;
      senderId: string;
      senderName: string;
      senderAvatarUrl: string | null;
      mine: boolean;
      items: ChatMessage[];
    };

/**
 * Bubble groups + date dividers.
 *
 * `localDates` is false during SSR and the first client render: day bucketing
 * depends on the *viewer's* timezone, which the server can't know, so dividers
 * only appear once we're running in the browser. Keeping both renders
 * identical is what stops a hydration mismatch.
 */
function buildRows(
  messages: ChatMessage[],
  currentUserId: string,
  localDates: boolean
): Row[] {
  const rows: Row[] = [];
  let group: Extract<Row, { kind: "group" }> | null = null;
  let day: string | null = null;

  for (const m of messages) {
    if (localDates) {
      const key = dayKey(m.createdAt);
      if (key !== day) {
        rows.push({
          kind: "divider",
          key: `divider-${key}`,
          label: dayLabel(m.createdAt),
        });
        day = key;
        group = null;
      }
    }

    const previous =
      group && group.items.length > 0
        ? group.items[group.items.length - 1]
        : null;
    const continues =
      group !== null &&
      previous !== null &&
      group.senderId === m.senderId &&
      sameGroupWindow(previous.createdAt, m.createdAt);

    if (continues && group) {
      group.items.push(m);
    } else {
      group = {
        kind: "group",
        key: `group-${m.id}`,
        senderId: m.senderId,
        senderName: m.senderName,
        senderAvatarUrl: m.senderAvatarUrl,
        mine: m.senderId === currentUserId,
        items: [m],
      };
      rows.push(group);
    }
  }
  return rows;
}

export default function MessageThread({
  conversationId,
  currentUserId,
  currentUserName,
  currentUserAvatarUrl,
  isGroup,
  initialMessages,
  openedAt,
  sendAction,
}: {
  conversationId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserAvatarUrl: string | null;
  isGroup: boolean;
  initialMessages: ChatMessage[];
  /** ISO fallback cursor for a conversation with no messages yet. */
  openedAt: string;
  sendAction: SendMessageAction;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [localDates, setLocalDates] = useState(false);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  useEffect(() => setLocalDates(true), []);

  // Fold fresh server data (e.g. the revalidation after a send) into state.
  const serverKey = useMemo(
    () => initialMessages.map((m) => m.id).join(","),
    [initialMessages]
  );
  useEffect(() => {
    setMessages((prev) => mergeMessages(prev, initialMessages));
    // initialMessages is a fresh array each render; serverKey is its identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey]);

  const cursor = useMemo(
    () => latestCursor(messages, openedAt),
    [messages, openedAt]
  );

  const handlePolled = useCallback((incoming: ChatMessage[]) => {
    setMessages((prev) => mergeMessages(prev, incoming));
  }, []);

  useMessagePoll({
    conversationId,
    since: cursor,
    onMessages: handlePolled,
  });

  // ── Scrolling ────────────────────────────────────────────────
  const atBottomRef = useRef(true);
  const settledRef = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      atBottomRef.current =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - STICK_THRESHOLD;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    // The first pass and the dividers pass both jump straight to the newest
    // message; after that we only follow along if the reader was at the bottom.
    const settling = !settledRef.current;
    if (localDates) settledRef.current = true;

    const lastIsMine = messages[messages.length - 1]?.senderId === currentUserId;
    if (settling || lastIsMine || atBottomRef.current) {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: settling ? "auto" : "smooth",
      });
      atBottomRef.current = true;
    }
  }, [messages, currentUserId, localDates]);

  // ── Sending ──────────────────────────────────────────────────
  const send = useCallback(
    (body: string) => {
      const temp: ChatMessage = {
        id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        conversationId,
        senderId: currentUserId,
        senderName: currentUserName,
        senderAvatarUrl: currentUserAvatarUrl,
        body,
        imageUrl: null,
        createdAt: new Date().toISOString(),
        pending: true,
      };
      setMessages((prev) => [...prev, temp]);

      startTransition(async () => {
        const result = await sendAction({ conversationId, body });
        if (result.ok) {
          setMessages((prev) =>
            mergeMessages(
              prev.filter((m) => m.id !== temp.id),
              [result.message]
            )
          );
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === temp.id ? { ...m, pending: false, failed: true } : m
            )
          );
          toast(result.error, "error");
        }
      });
    },
    [
      conversationId,
      currentUserAvatarUrl,
      currentUserId,
      currentUserName,
      sendAction,
      toast,
    ]
  );

  const retry = useCallback(
    (message: ChatMessage) => {
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
      send(message.body);
    },
    [send]
  );

  const rows = useMemo(
    () => buildRows(messages, currentUserId, localDates),
    [messages, currentUserId, localDates]
  );

  return (
    <>
      {messages.length === 0 ? (
        <EmptyState
          icon="👋"
          title="No messages yet"
          body="Say hello — neighbors usually reply within a day."
        />
      ) : (
        <div className="space-y-1">
          {rows.map((row) =>
            row.kind === "divider" ? (
              <div
                key={row.key}
                className="flex items-center justify-center py-3"
              >
                <span className="rounded-full bg-line/70 px-3 py-1 text-xs font-semibold text-ink-soft">
                  {row.label}
                </span>
              </div>
            ) : (
              <MessageGroup
                key={row.key}
                row={row}
                isGroup={isGroup}
                showTime={localDates}
                onRetry={retry}
              />
            )
          )}
        </div>
      )}

      {/* Clears the fixed composer stacked on top of the tab bar. */}
      <div className="h-12" aria-hidden />

      <Composer
        onSend={send}
        maxLength={BODY_MAX}
        sending={isPending}
        placeholder="Write a message…"
      />
    </>
  );
}

function MessageGroup({
  row,
  isGroup,
  showTime,
  onRetry,
}: {
  row: Extract<Row, { kind: "group" }>;
  isGroup: boolean;
  showTime: boolean;
  onRetry: (message: ChatMessage) => void;
}) {
  const { mine, items } = row;
  const last = items[items.length - 1];

  return (
    <div className={`flex gap-2 pt-2 ${mine ? "justify-end" : "justify-start"}`}>
      {!mine && isGroup && (
        <div className="flex flex-col justify-end">
          <Avatar name={row.senderName} src={row.senderAvatarUrl} size="sm" />
        </div>
      )}

      <div
        className={`flex max-w-[78%] flex-col ${mine ? "items-end" : "items-start"}`}
      >
        {!mine && isGroup && (
          <p className="mb-0.5 px-1 text-xs font-semibold text-ink-soft">
            {row.senderName}
          </p>
        )}

        {items.map((m, i) => {
          const isLast = i === items.length - 1;
          const corner = !isLast ? "" : mine ? "rounded-br-md" : "rounded-bl-md";
          return (
            <div key={m.id} className={i > 0 ? "mt-0.5" : ""}>
              <div
                className={`animate-fade-in rounded-2xl px-3.5 py-2 text-[15px] leading-snug ${corner} ${
                  mine
                    ? "bg-porch-600 text-white"
                    : "border border-line bg-card text-ink"
                } ${m.pending ? "opacity-70" : ""} ${
                  m.failed ? "opacity-80 ring-1 ring-red-400" : ""
                }`}
              >
                {m.imageUrl && (
                  // Message images come from arbitrary user hosts, same as avatars.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.imageUrl}
                    alt=""
                    className="mb-1.5 max-h-64 w-full rounded-xl object-cover"
                  />
                )}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
              </div>

              {m.failed && (
                <button
                  type="button"
                  onClick={() => onRetry(m)}
                  className="mt-1 min-h-9 px-1 text-xs font-semibold text-red-600"
                >
                  Not sent · Tap to retry
                </button>
              )}
            </div>
          );
        })}

        <span className="mt-1 px-1 text-[11px] text-ink-soft">
          {last.pending
            ? "Sending…"
            : showTime
              ? formatEventTime(last.createdAt)
              : " "}
        </span>
      </div>
    </div>
  );
}

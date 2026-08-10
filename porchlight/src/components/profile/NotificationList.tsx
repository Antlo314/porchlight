"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button, useToast } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { notificationMeta } from "./notificationMeta";

/** A payload-parsed, safety-checked notification, ready to render. */
export type NotificationRow = {
  id: string;
  type: string;
  /** Already validated as an in-app path, or null when the payload was bad. */
  href: string | null;
  text: string;
  createdAt: string;
  unread: boolean;
};

export function NotificationList({
  items,
  markAllAction,
}: {
  items: NotificationRow[];
  markAllAction: () => Promise<{ ok: boolean }>;
}) {
  // Which rows were new when this screen opened. Held in a ref so the refresh
  // that follows the mark-all write doesn't erase the "what's new" highlight —
  // the bell clears, the highlight stays until the user leaves or taps below.
  const wasUnread = useRef(
    new Set(items.filter((item) => item.unread).map((item) => item.id))
  );
  const newCount = wasUnread.current.size;

  const [dimmed, setDimmed] = useState(newCount === 0);
  const [pending, startTransition] = useTransition();
  const markedOnOpen = useRef(false);
  const toast = useToast();

  // Viewing the screen is the read receipt: clear the badge as soon as the list
  // is actually on screen (a prefetch never runs effects, so it can't fire).
  useEffect(() => {
    if (newCount === 0 || markedOnOpen.current) return;
    markedOnOpen.current = true;
    void markAllAction();
  }, [newCount, markAllAction]);

  function markAll() {
    setDimmed(true);
    startTransition(async () => {
      const result = await markAllAction();
      if (!result.ok) {
        setDimmed(false);
        toast("Couldn't mark those read. Try again.", "error");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Notifications</h1>
        {!dimmed && (
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={markAll}
            disabled={pending}
          >
            Mark all read
          </Button>
        )}
      </div>

      {!dimmed && (
        <p className="text-sm font-semibold text-porch-700">
          {newCount} new since you last looked
        </p>
      )}

      <ul className="space-y-2">
        {items.map((item) => {
          const meta = notificationMeta(item.type);
          const unread = !dimmed && wasUnread.current.has(item.id);

          const body = (
            <div
              className={`flex items-start gap-3 rounded-card border p-3 transition-colors ${
                unread ? "border-porch-200 bg-porch-50" : "border-line bg-card"
              }`}
            >
              <span
                aria-hidden
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl ${meta.iconClass}`}
              >
                {meta.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] leading-snug">{item.text}</p>
                <p className="mt-1 text-xs text-ink-soft">
                  {meta.label} · {timeAgo(item.createdAt)}
                </p>
              </div>
              {unread && (
                <span className="mt-2 shrink-0">
                  <span
                    aria-hidden
                    className="block h-2.5 w-2.5 rounded-full bg-porch-600"
                  />
                  <span className="sr-only">Unread</span>
                </span>
              )}
            </div>
          );

          return (
            <li key={item.id} className="animate-fade-in">
              {item.href ? (
                <Link
                  href={item.href}
                  className="block transition-transform duration-100 active:scale-[0.99]"
                >
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

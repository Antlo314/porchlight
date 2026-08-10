"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, CharCount, Spinner, Textarea } from "@/components/ui";

const MIN_HEIGHT = 44; // 44px tap target, matches Button size="md"
const MAX_HEIGHT = 132; // ~5 lines before the textarea starts scrolling

/**
 * Sticky message input that floats above the bottom tab bar.
 *
 * The parent owns the message list, so `onSend` is fire-and-forget: it appends
 * optimistically and reconciles with the server itself. The composer clears
 * immediately on submit — the tap must never wait for a round trip.
 */
export default function Composer({
  onSend,
  maxLength,
  placeholder = "Write a message…",
  sending = false,
  autoFocus = false,
}: {
  onSend: (body: string) => void;
  maxLength: number;
  placeholder?: string;
  sending?: boolean;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState("");
  const [height, setHeight] = useState(MIN_HEIGHT);
  const [enterSends, setEnterSends] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Enter sends on pointer-precise (desktop) devices; on a touch keyboard Enter
  // has to stay a newline or people can't write a second sentence.
  useEffect(() => {
    setEnterSends(window.matchMedia("(pointer: fine)").matches);
  }, []);

  const textarea = useCallback(
    () => boxRef.current?.querySelector("textarea") ?? null,
    []
  );

  const grow = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = "0px";
    const next = Math.min(Math.max(el.scrollHeight, MIN_HEIGHT), MAX_HEIGHT);
    el.style.height = `${next}px`;
    setHeight(next);
  }, []);

  // Measure the real control once mounted instead of guessing its line height.
  useEffect(() => {
    const el = textarea();
    if (!el) return;
    grow(el);
    if (autoFocus) el.focus();
  }, [autoFocus, grow, textarea]);

  function submit() {
    const body = value.trim();
    if (!body) return;

    onSend(body.slice(0, maxLength));
    setValue("");

    const el = textarea();
    if (el) {
      el.value = "";
      grow(el);
      // Keep the keyboard up so a reply can follow straight away.
      el.focus();
    }
  }

  const canSend = value.trim().length > 0;

  return (
    <div
      ref={boxRef}
      className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-cream/95 backdrop-blur"
    >
      <form
        className="mx-auto flex max-w-md items-end gap-2 px-4 py-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Textarea
            name="body"
            rows={1}
            value={value}
            maxLength={maxLength}
            placeholder={placeholder}
            aria-label="Message"
            // Inline styles beat the shared control's min-height/resize so the
            // same primitive can be a single-line composer here.
            style={{
              minHeight: `${MIN_HEIGHT}px`,
              height: `${height}px`,
              resize: "none",
              overflowY: height >= MAX_HEIGHT ? "auto" : "hidden",
            }}
            onChange={(e) => {
              setValue(e.currentTarget.value);
              grow(e.currentTarget);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && enterSends) {
                e.preventDefault();
                submit();
              }
            }}
          />
          {value.length > maxLength - 200 && (
            <span className="absolute bottom-2 right-3 bg-card/90 px-1">
              <CharCount value={value} max={maxLength} />
            </span>
          )}
        </div>
        <Button
          type="submit"
          size="md"
          disabled={!canSend || sending}
          aria-label="Send message"
        >
          {sending ? <Spinner /> : "Send"}
        </Button>
      </form>
    </div>
  );
}

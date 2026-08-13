"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Input, useToast } from "@/components/ui";

const LINK_INPUT_ID = "invite-link";

/**
 * The share controls on /invite. Everything degrades: no clipboard API means
 * the link gets selected for a manual copy, and the native share sheet only
 * appears where the browser actually has one (phones, not desktops).
 */
export function InviteShare({
  url,
  code,
  shareText,
}: {
  url: string;
  code: string;
  shareText: string;
}) {
  const toast = useToast();
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [manualCopy, setManualCopy] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Feature-detect after mount. The server has no `navigator`, so deciding
  // this during render would hydrate into a mismatch.
  useEffect(() => {
    setCanShare(
      typeof navigator !== "undefined" && typeof navigator.share === "function"
    );
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  /**
   * The design-system Input is a plain function component with no ref in its
   * props type, so the fallback path reaches the node by id rather than
   * hand-rolling a second styled input just to hold a ref.
   */
  function selectLink() {
    if (typeof document === "undefined") return;
    const input = document.getElementById(LINK_INPUT_ID);
    if (!(input instanceof HTMLInputElement)) return;
    input.focus();
    input.select();
  }

  async function onCopy() {
    try {
      // Absent on http:// origins and older browsers — hence the fallback.
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast("Invite link copied — paste it wherever your neighbors are.");
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), 2400);
    } catch {
      setManualCopy(true);
      selectLink();
      toast(
        "This browser won't let us copy for you — the link is selected, copy it by hand.",
        "error"
      );
    }
  }

  async function onShare() {
    try {
      await navigator.share({ title: "Porchlight", text: shareText, url });
    } catch {
      // Dismissing the share sheet rejects too, so there's nothing worth saying.
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label
          htmlFor={LINK_INPUT_ID}
          className="mb-1.5 block text-sm font-semibold"
        >
          Your invite link
        </label>
        <Input
          id={LINK_INPUT_ID}
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          onClick={(e) => e.currentTarget.select()}
          aria-describedby={manualCopy ? "invite-link-hint" : undefined}
          className="font-mono"
        />
        {manualCopy && (
          <p id="invite-link-hint" className="mt-1.5 text-sm text-ink-soft">
            Tap the link above to select it, then copy — or just read out the
            code{" "}
            <span className="font-mono font-bold tracking-wider text-ink">
              {code}
            </span>
            .
          </p>
        )}
      </div>

      <Button type="button" size="lg" onClick={onCopy} aria-live="polite">
        {copied ? (
          <>
            <span aria-hidden>✓</span> Copied
          </>
        ) : (
          <>
            <span aria-hidden>🔗</span> Copy link
          </>
        )}
      </Button>

      {canShare && (
        <Button type="button" variant="secondary" size="lg" onClick={onShare}>
          <span aria-hidden>📤</span> Share…
        </Button>
      )}
    </div>
  );
}

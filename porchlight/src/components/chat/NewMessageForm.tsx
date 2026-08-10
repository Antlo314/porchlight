"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/ui";
import { startConversationSchema } from "@/lib/validators";
import Composer from "./Composer";
import type { StartConversationAction } from "./types";

const BODY_MAX = startConversationSchema.shape.body.maxLength ?? 4000;

/**
 * First-message composer for a brand-new 1:1 thread. The action redirects into
 * the conversation on success, so the only state kept here is an optimistic
 * bubble that covers the round trip.
 */
export default function NewMessageForm({
  recipientId,
  recipientName,
  startAction,
}: {
  recipientId: string;
  recipientName: string;
  startAction: StartConversationAction;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  const firstName = recipientName.split(" ")[0] ?? recipientName;

  function send(body: string) {
    setDraft(body);
    startTransition(async () => {
      const result = await startAction({ recipientId, body });
      if (result && !result.ok) {
        setDraft(null);
        toast(result.error, "error");
      }
    });
  }

  return (
    <>
      {draft ? (
        <div className="flex justify-end pt-2">
          <div className="max-w-[78%]">
            <div className="animate-fade-in rounded-2xl rounded-br-md bg-porch-600 px-3.5 py-2 text-[15px] leading-snug text-white opacity-70">
              <p className="whitespace-pre-wrap break-words">{draft}</p>
            </div>
            <span className="mt-1 block px-1 text-right text-[11px] text-ink-soft">
              Sending…
            </span>
          </div>
        </div>
      ) : (
        <div className="px-6 py-12 text-center">
          <span className="text-4xl" aria-hidden>
            ✉️
          </span>
          <h2 className="mt-3 text-lg font-semibold">Say hi to {firstName}</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Your first message starts the conversation. Keep it neighborly.
          </p>
        </div>
      )}

      {/* Clears the fixed composer stacked on top of the tab bar. */}
      <div className="h-12" aria-hidden />

      <Composer
        onSend={send}
        maxLength={BODY_MAX}
        sending={isPending}
        autoFocus
        placeholder={`Message ${firstName}…`}
      />
    </>
  );
}

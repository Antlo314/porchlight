"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, ConfirmSheet, useToast } from "@/components/ui";
import { setWantStatusAction } from "@/app/(app)/barter/wants/actions";
import { WantCard, type WantCardData } from "./WantCard";
import { toWantStatus, type WantStatusValue } from "./meta";

const CONFIRM_COPY: Record<
  "FULFILLED" | "CLOSED",
  { title: string; body: string; confirmLabel: string; destructive: boolean }
> = {
  FULFILLED: {
    title: "Mark this as found?",
    body: "It comes off the wants board and stops matching new listings, so neighbors stop offering you something you already have. You can reopen it any time.",
    confirmLabel: "Mark as found",
    destructive: false,
  },
  CLOSED: {
    title: "Close this want?",
    body: "It comes off the wants board and stops matching new listings. Nobody is notified. You can reopen it any time.",
    confirmLabel: "Close want",
    destructive: true,
  },
};

/**
 * The viewer's own want, with the two controls only they can use. The action
 * re-checks ownership server-side; this component is just the affordance.
 */
export function MyWantCard({ want }: { want: WantCardData }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [status, setStatus] = useState<WantStatusValue>(
    toWantStatus(want.status)
  );
  const [confirming, setConfirming] = useState<"FULFILLED" | "CLOSED" | null>(
    null
  );

  function change(next: WantStatusValue, successMessage: string) {
    const previous = status;
    // Optimistic: the badge and buttons swap immediately, and roll back if the
    // write is refused (a stale tab, a deleted want).
    setStatus(next);

    startTransition(async () => {
      const result = await setWantStatusAction({ wantId: want.id, status: next });
      if (result.ok) {
        toast(successMessage);
        router.refresh();
        return;
      }
      setStatus(previous);
      toast(result.error, "error");
    });
  }

  const controls =
    status === "OPEN" ? (
      <div className="mt-3 flex gap-2 border-t border-line pt-3">
        <Button
          variant="secondary"
          size="md"
          className="flex-1"
          disabled={pending}
          onClick={() => setConfirming("FULFILLED")}
        >
          ✅ Found it
        </Button>
        <Button
          variant="ghost"
          size="md"
          className="flex-1 border border-line"
          disabled={pending}
          onClick={() => setConfirming("CLOSED")}
        >
          Close
        </Button>
      </div>
    ) : (
      <div className="mt-3 border-t border-line pt-3">
        <p className="text-sm text-ink-soft">
          {status === "FULFILLED"
            ? "Off the board — nice. Reopen it if the trade fell through."
            : "Off the board and not matching new listings."}
        </p>
        <Button
          variant="secondary"
          size="md"
          className="mt-2 w-full"
          disabled={pending}
          onClick={() => change("OPEN", "Want reopened")}
        >
          Reopen this want
        </Button>
      </div>
    );

  return (
    <>
      <WantCard want={{ ...want, status }} showStatus footer={controls} />

      <ConfirmSheet
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        onConfirm={() => {
          if (!confirming) return;
          change(
            confirming,
            confirming === "FULFILLED" ? "Marked as found" : "Want closed"
          );
        }}
        title={confirming ? CONFIRM_COPY[confirming].title : ""}
        body={confirming ? CONFIRM_COPY[confirming].body : undefined}
        confirmLabel={
          confirming ? CONFIRM_COPY[confirming].confirmLabel : "Confirm"
        }
        destructive={confirming ? CONFIRM_COPY[confirming].destructive : false}
      />
    </>
  );
}

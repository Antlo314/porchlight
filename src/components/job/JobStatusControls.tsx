"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, ConfirmSheet, useToast } from "@/components/ui";
import { setJobStatusAction } from "@/app/(app)/jobs/actions";
import { JOB_STATUS_META, toJobStatus, type JobStatusValue } from "./meta";

const CONFIRM_COPY: Record<
  "FULFILLED" | "CLOSED",
  { title: string; body: string; confirmLabel: string; destructive: boolean }
> = {
  FULFILLED: {
    title: "Mark this job as fulfilled?",
    body: "It comes off the open board and the pros who replied hear that you are all set. Leaving a review afterwards is how the next neighbor finds good people.",
    confirmLabel: "Mark fulfilled",
    destructive: false,
  },
  CLOSED: {
    title: "Close this job?",
    body: "It comes off the open board and stops taking replies. The pros who already replied are told. You can reopen it any time.",
    confirmLabel: "Close job",
    destructive: true,
  },
};

/** Requester-only controls. The action re-checks ownership server-side. */
export function JobStatusControls({
  jobId,
  status,
}: {
  jobId: string;
  status: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [current, setCurrent] = useState<JobStatusValue>(toJobStatus(status));
  const [confirming, setConfirming] = useState<"FULFILLED" | "CLOSED" | null>(
    null
  );

  function change(next: JobStatusValue, successMessage: string) {
    const previous = current;
    // Optimistic: the buttons swap immediately, and roll back if the write is
    // refused (someone else's session, a deleted job).
    setCurrent(next);

    startTransition(async () => {
      const result = await setJobStatusAction({ jobId, status: next });
      if (result.ok) {
        toast(successMessage);
        router.refresh();
        return;
      }
      setCurrent(previous);
      toast(result.error, "error");
    });
  }

  if (current !== "OPEN") {
    const meta = JOB_STATUS_META[current];
    return (
      <div className="rounded-card border border-line bg-card p-4">
        <p className="text-[15px] font-semibold">
          This job is {meta.label.toLowerCase()}
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          {current === "FULFILLED"
            ? "Nice — it is off the open board. Reopen it if the work fell through."
            : "It is off the open board and not taking replies."}
        </p>
        <Button
          variant="secondary"
          size="lg"
          className="mt-3"
          disabled={pending}
          onClick={() => change("OPEN", "Job reopened")}
        >
          Reopen this job
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-2">
        <Button
          variant="primary"
          size="md"
          className="flex-1"
          disabled={pending}
          onClick={() => setConfirming("FULFILLED")}
        >
          ✅ Mark as fulfilled
        </Button>
        <Button
          variant="secondary"
          size="md"
          className="flex-1"
          disabled={pending}
          onClick={() => setConfirming("CLOSED")}
        >
          Close
        </Button>
      </div>

      <ConfirmSheet
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        onConfirm={() => {
          if (!confirming) return;
          change(
            confirming,
            confirming === "FULFILLED" ? "Marked as fulfilled" : "Job closed"
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

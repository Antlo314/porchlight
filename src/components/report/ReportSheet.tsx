"use client";

// The single report UI for the whole app. Every vertical imports this exact
// component, so it must stay free of any other vertical's modules — only
// @/components/ui, @/lib/validators, and this folder.
import { useEffect, useState, useTransition } from "react";
import {
  Button,
  CharCount,
  Field,
  FormError,
  Sheet,
  Textarea,
  useToast,
} from "@/components/ui";
import { REPORT_REASON_LABELS } from "@/lib/validators";
import { submitReportAction } from "./actions";
import {
  REPORT_REASONS,
  TARGET_TYPE_META,
  type ReportReasonValue,
  type ReportTargetType,
} from "./reportMeta";

const DETAIL_MAX = 1000;

export function ReportSheet({
  targetType,
  targetId,
  open,
  onClose,
}: {
  targetType: ReportTargetType;
  targetId: string;
  open: boolean;
  onClose: () => void;
}): React.ReactElement {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState<ReportReasonValue | null>(null);
  const [detail, setDetail] = useState("");
  const [error, setError] = useState<string | null>(null);

  // The sheet is usually mounted for the lifetime of its host row, so reset
  // every time it reopens — otherwise the last report's answers stick around.
  useEffect(() => {
    if (!open) return;
    setReason(null);
    setDetail("");
    setError(null);
  }, [open]);

  const noun = TARGET_TYPE_META[targetType].noun;

  function submit() {
    if (!reason) {
      setError("Pick a reason so a moderator knows what to look at.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await submitReportAction({
        targetType,
        targetId,
        reason,
        detail: detail.trim() || undefined,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast(
        result.duplicate
          ? "You already reported this — a moderator is on it."
          : "Thanks. A moderator will take a look."
      );
      onClose();
    });
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Report this ${noun}`}>
      <p className="text-[15px] text-ink-soft">
        Reports are private. A Porchlight moderator reviews every one — the
        person you're reporting isn't told who filed it.
      </p>

      <fieldset className="mt-4" disabled={pending}>
        <legend className="mb-2 text-sm font-semibold">
          What's wrong with it?
        </legend>
        <div className="space-y-2">
          {REPORT_REASONS.map((value) => {
            const active = value === reason;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setReason(value);
                  setError(null);
                }}
                className={`flex min-h-13 w-full items-center gap-3 rounded-card border px-4 text-left text-[15px] font-semibold transition-colors ${
                  active
                    ? "border-porch-600 bg-porch-50 text-porch-800"
                    : "border-line bg-card text-ink active:bg-porch-50"
                }`}
              >
                <span
                  aria-hidden
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[11px] leading-none text-white ${
                    active ? "border-porch-600 bg-porch-600" : "border-line"
                  }`}
                >
                  {active ? "✓" : ""}
                </span>
                {REPORT_REASON_LABELS[value]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-4">
        <Field
          label="Anything else? (optional)"
          hint="Context helps a moderator act faster."
        >
          <Textarea
            value={detail}
            maxLength={DETAIL_MAX}
            disabled={pending}
            onChange={(e) => setDetail(e.target.value)}
            placeholder={`Tell us what you saw in this ${noun}…`}
            className="min-h-24"
          />
          <div className="flex justify-end">
            <CharCount value={detail} max={DETAIL_MAX} />
          </div>
        </Field>
      </div>

      {error && (
        <div className="mt-3">
          <FormError>{error}</FormError>
        </div>
      )}

      <div className="mt-5 space-y-2">
        <Button
          size="lg"
          onClick={submit}
          disabled={pending || !reason}
          aria-busy={pending}
        >
          {pending ? "Sending…" : "Submit report"}
        </Button>
        <Button size="lg" variant="secondary" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
      </div>
    </Sheet>
  );
}

export default ReportSheet;

"use client";

import { useState, useTransition } from "react";
import {
  Button,
  Card,
  CharCount,
  ConfirmSheet,
  Field,
  FormError,
  Textarea,
  useToast,
} from "@/components/ui";
import {
  deleteMyReview,
  upsertReview,
} from "@/app/(app)/services/[id]/actions";

const BODY_MAX = 2000;

export type ExistingReview = {
  rating: number;
  body: string;
  verifiedJob: boolean;
};

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (rating: number) => void;
}) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Star rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star === 1 ? "" : "s"}`}
          onClick={() => onChange(star)}
          className={`flex h-11 w-11 items-center justify-center rounded-xl text-2xl leading-none transition-transform duration-100 active:scale-95 ${
            star <= value ? "text-porch-500" : "text-line"
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

/**
 * Review composer. Because of the one-review-per-neighbor-per-business unique
 * constraint, an existing review is loaded straight into the form and the
 * submit path upserts — so a neighbor edits rather than hits a constraint wall.
 */
export function ReviewComposer({
  businessId,
  businessName,
  existing,
}: {
  businessId: string;
  businessName: string;
  existing: ExistingReview | null;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [body, setBody] = useState(existing?.body ?? "");
  const [verifiedJob, setVerifiedJob] = useState(existing?.verifiedJob ?? false);
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const editing = existing !== null && !removed;

  function submit() {
    if (rating < 1) {
      setError("Pick a star rating first.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await upsertReview({
        businessId,
        rating,
        body,
        verifiedJob,
      });
      if (result.ok) {
        setRemoved(false);
        toast(editing ? "Review updated" : `Thanks for reviewing ${businessName}`);
      } else {
        setError(result.error);
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteMyReview(businessId);
      if (result.ok) {
        setRating(0);
        setBody("");
        setVerifiedJob(false);
        setRemoved(true);
        toast("Review removed");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <Card>
        <h3 className="font-semibold">
          {editing ? "Your review" : `Review ${businessName}`}
        </h3>
        <p className="mt-0.5 text-sm text-ink-soft">
          {editing
            ? "Neighbors can see this. Update it any time."
            : "Honest, first-hand experience helps the whole block."}
        </p>

        <div className="mt-3 space-y-3">
          <Field label="Rating" required>
            <StarPicker value={rating} onChange={setRating} />
          </Field>

          <Field
            label="What happened?"
            hint="Timeliness, price, quality — whatever you'd tell a neighbor."
          >
            <Textarea
              value={body}
              maxLength={BODY_MAX}
              onChange={(e) => setBody(e.target.value)}
              placeholder={`How was working with ${businessName}?`}
            />
            <div className="flex justify-end">
              <CharCount value={body} max={BODY_MAX} />
            </div>
          </Field>

          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-card border border-line px-3">
            <input
              type="checkbox"
              checked={verifiedJob}
              onChange={(e) => setVerifiedJob(e.target.checked)}
              className="h-5 w-5 accent-porch-600"
            />
            <span className="text-[15px]">
              I hired them
              <span className="block text-xs text-ink-soft">
                Marks this as a verified job — neighbors trust these most.
              </span>
            </span>
          </label>

          <FormError>{error}</FormError>

          <Button size="lg" onClick={submit} disabled={pending}>
            {pending
              ? "Saving…"
              : editing
                ? "Update review"
                : "Post review"}
          </Button>

          {editing && (
            <Button
              variant="ghost"
              size="lg"
              onClick={() => setConfirmRemove(true)}
              disabled={pending}
            >
              <span className="text-red-600">Remove my review</span>
            </Button>
          )}
        </div>
      </Card>

      <ConfirmSheet
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={remove}
        title="Remove your review?"
        body={`Neighbors will no longer see it, and it stops counting toward ${businessName}'s rating. You can always write a new one.`}
        confirmLabel="Remove review"
        destructive
      />
    </>
  );
}

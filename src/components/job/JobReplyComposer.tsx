"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Button,
  CharCount,
  Field,
  FormError,
  Input,
  SectionHeading,
  Select,
  Spinner,
  Textarea,
  useToast,
} from "@/components/ui";
import { createJobReplyAction } from "@/app/(app)/jobs/actions";

const MESSAGE_MAX = 1000;
const QUOTE_MAX = 60;

/**
 * The pro's side of the reverse marketplace. There is no plan check here and
 * none in the action behind it — answering a neighbor who asked is free on
 * every plan, and the helper text says so where a business will actually read
 * it.
 */
export function JobReplyComposer({
  jobId,
  requesterName,
  businesses,
}: {
  jobId: string;
  requesterName: string;
  /** The caller's own businesses in this neighborhood; re-verified server-side. */
  businesses: { id: string; name: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [businessId, setBusinessId] = useState(businesses[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [quoteInfo, setQuoteInfo] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Explicitly optional: an empty list is possible in the types even though the
  // page only mounts this for a member who owns at least one local business.
  const active: { id: string; name: string } | undefined =
    businesses.find((b) => b.id === businessId) ?? businesses[0];
  const canSubmit = message.trim().length > 0 && active !== undefined;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending || !canSubmit) return;
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await createJobReplyAction({
        jobId,
        message,
        quoteInfo,
        businessId: active?.id,
      });

      if (result.ok) {
        // Flip to the sent state immediately; the refresh fills in the real row.
        setSent(true);
        toast("Reply sent");
        router.refresh();
        return;
      }

      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
    });
  }

  if (sent) {
    return (
      <div className="animate-pop rounded-card border border-porch-200 bg-porch-50 p-4">
        <p className="text-[15px] font-semibold">
          <span aria-hidden>✅</span> Reply sent
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          {requesterName} has been notified and can message you straight from
          your reply. That cost you nothing — answering a neighbor never does.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <SectionHeading title="Reply to this neighbor" />

      <div className="rounded-card border border-porch-200 bg-porch-50 p-4">
        <p className="text-[15px] font-semibold text-porch-800">
          Replying is free, on every plan.
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          A Porchlight subscription pays for your standing presence in the
          directory. Answering a neighbor who asked for help is never part of
          the bill.
        </p>
      </div>

      {businesses.length > 1 ? (
        <Field label="Reply as" required>
          <Select
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
          >
            {businesses.map((business) => (
              <option key={business.id} value={business.id}>
                {business.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        active && (
          <p className="text-sm text-ink-soft">
            Replying as{" "}
            <span className="font-semibold text-ink">{active.name}</span>
          </p>
        )
      )}

      <Field
        label="Your reply"
        required
        error={fieldErrors.message}
        hint="What you would do, when you could start, and what you need from them."
      >
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={MESSAGE_MAX}
          rows={5}
          placeholder={`Hi ${requesterName} — I can take a look this week. I have done a few of these on the block…`}
        />
        <div className="flex justify-end">
          <CharCount value={message} max={MESSAGE_MAX} />
        </div>
      </Field>

      <Field
        label="Quote"
        error={fieldErrors.quoteInfo}
        hint="Optional and freeform — “$150 flat”, “free estimate”, “$60/hr”."
      >
        <Input
          value={quoteInfo}
          onChange={(e) => setQuoteInfo(e.target.value)}
          maxLength={QUOTE_MAX}
          placeholder="Free estimate"
          autoComplete="off"
        />
      </Field>

      <FormError>{error}</FormError>

      <Button type="submit" size="lg" disabled={pending || !canSubmit}>
        {pending && <Spinner />}
        {pending ? "Sending…" : "Send reply"}
      </Button>
    </form>
  );
}

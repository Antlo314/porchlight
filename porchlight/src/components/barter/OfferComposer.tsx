"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Button,
  Card,
  CharCount,
  CreditPill,
  Field,
  FormError,
  Input,
  SectionHeading,
  SegmentedControl,
  Spinner,
  Textarea,
  useToast,
} from "@/components/ui";
import { createOfferAction } from "@/app/(app)/barter/[id]/actions";
import { CREDITS_PER_HOUR, creditsToHours } from "./meta";

type Mode = "TRADE" | "CREDITS";

export function OfferComposer({
  listingId,
  listingKind,
  ownerName,
  creditValue,
  balance,
}: {
  listingId: string;
  listingKind: string;
  ownerName: string;
  creditValue: number | null;
  balance: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const [mode, setMode] = useState<Mode>(creditValue ? "CREDITS" : "TRADE");
  const [message, setMessage] = useState("");
  const [itemDesc, setItemDesc] = useState("");
  const [amount, setAmount] = useState(creditValue ? String(creditValue) : "");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const parsedAmount = Number.parseInt(amount, 10);
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount >= 1;
  const overBalance = amountValid && parsedAmount > balance;

  const canSubmit =
    message.trim().length > 0 &&
    (mode === "TRADE"
      ? itemDesc.trim().length > 0
      : amountValid && !overBalance);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending || !canSubmit) return;
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await createOfferAction({
        listingId,
        message,
        offeredItemDesc: mode === "TRADE" ? itemDesc : undefined,
        creditAmount: mode === "CREDITS" ? amount : undefined,
      });

      if (result.ok) {
        // Flip to the sent state immediately; the refresh fills in the real row.
        setSent(true);
        toast("Offer sent");
        router.refresh();
        return;
      }

      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
    });
  }

  if (sent) {
    return (
      <Card className="animate-pop border-porch-200 bg-porch-50">
        <p className="text-[15px] font-semibold">
          <span aria-hidden>✅</span> Offer sent
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          {ownerName} has been notified. You&apos;ll hear back here and in your
          notifications.
        </p>
      </Card>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <SectionHeading title="Make an offer" />

      <div className="flex items-center justify-between gap-2 rounded-card border border-line bg-card px-4 py-3">
        <span className="text-sm text-ink-soft">Your balance</span>
        <CreditPill amount={balance} />
      </div>

      <SegmentedControl<Mode>
        options={[
          { value: "TRADE", label: "Trade something", icon: "🔁" },
          { value: "CREDITS", label: "Porch Credits", icon: "🪙" },
        ]}
        value={mode}
        onChange={setMode}
      />

      <Field
        label="Note to the owner"
        required
        error={fieldErrors.message}
        hint="Say hello and when you're available."
      >
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={1000}
          rows={4}
          placeholder={`Hi ${ownerName} — I'd love to work something out…`}
        />
        <div className="flex justify-end">
          <CharCount value={message} max={1000} />
        </div>
      </Field>

      {mode === "TRADE" ? (
        <Field
          label="What are you offering?"
          required
          error={fieldErrors.offeredItemDesc}
          hint="An item, a skill, or an hour of help."
        >
          <Input
            value={itemDesc}
            onChange={(e) => setItemDesc(e.target.value)}
            maxLength={500}
            placeholder="A loaf of sourdough + jar of pickles"
            autoComplete="off"
          />
        </Field>
      ) : (
        <Field
          label="Porch Credits offered"
          required
          error={fieldErrors.creditAmount}
          hint={
            listingKind === "TIME"
              ? `${CREDITS_PER_HOUR} credits buys an hour of a neighbor's time.`
              : "Credits move only when the owner marks the trade complete."
          }
        >
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            inputMode="numeric"
            min={1}
            max={balance || undefined}
            step={1}
            placeholder={creditValue ? String(creditValue) : "20"}
          />
          {listingKind === "TIME" && amountValid && !overBalance && (
            <p className="text-sm text-ink-soft">
              ≈ {creditsToHours(parsedAmount)} hours of help
            </p>
          )}
        </Field>
      )}

      {overBalance && (
        <FormError>
          That&apos;s more than your balance. You have {balance} Porch Credits —
          earn more by completing a trade.
        </FormError>
      )}

      <FormError>{error}</FormError>

      <Button type="submit" size="lg" disabled={isPending || !canSubmit}>
        {isPending && <Spinner />}
        {isPending ? "Sending…" : "Send offer"}
      </Button>
    </form>
  );
}

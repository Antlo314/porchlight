"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Button,
  Card,
  ConfirmSheet,
  CreditPill,
  SectionHeading,
  Spinner,
  useToast,
} from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { decideOfferAction } from "@/app/(app)/barter/[id]/actions";
import { OfferStatusBadge } from "./StatusBadge";

export type MyOffer = {
  id: string;
  message: string;
  offeredItemDesc: string | null;
  creditAmount: number | null;
  status: string;
  createdAt: Date | string;
};

export function MyOfferPanel({
  offer,
  ownerId,
  ownerName,
}: {
  offer: MyOffer;
  ownerId: string;
  ownerName: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(offer.status);
  const [confirming, setConfirming] = useState(false);

  function withdraw() {
    if (isPending) return;
    const previous = status;
    setStatus("CANCELLED");

    startTransition(async () => {
      const result = await decideOfferAction({
        offerId: offer.id,
        decision: "CANCELLED",
      });
      if (!result.ok) {
        setStatus(previous);
        toast(result.error, "error");
        return;
      }
      toast("Offer withdrawn");
      router.refresh();
    });
  }

  const note =
    status === "PENDING"
      ? `Waiting on ${ownerName} to reply.`
      : status === "ACCEPTED"
        ? `${ownerName} accepted. Sort out the handoff — they'll mark it complete${
            offer.creditAmount !== null ? ", and that's when your credits move." : "."
          }`
        : status === "COMPLETED"
          ? offer.creditAmount !== null
            ? `Trade complete. ${offer.creditAmount} Porch Credits went to ${ownerName}, and you earned +2 karma.`
            : `Trade complete. You earned +2 karma.`
          : status === "DECLINED"
            ? `${ownerName} passed on this one. Plenty of other trades on the block.`
            : "You withdrew this offer.";

  return (
    <div>
      <SectionHeading title="Your offer" />

      <Card>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-ink-soft">
            Sent {timeAgo(offer.createdAt)}
          </span>
          <OfferStatusBadge status={status} />
        </div>

        <div className="mt-3 rounded-xl bg-cream p-3">
          {offer.creditAmount !== null ? (
            <p className="flex items-center gap-2 text-sm font-semibold">
              You offered <CreditPill amount={offer.creditAmount} />
            </p>
          ) : (
            <p className="text-sm">
              <span className="font-semibold">You offered:</span>{" "}
              {offer.offeredItemDesc}
            </p>
          )}
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink-soft">
            {offer.message}
          </p>
        </div>

        <p className="mt-3 text-sm text-ink-soft">{note}</p>

        <div className="mt-3 flex items-center gap-2">
          <Link
            href={`/messages/new?to=${ownerId}`}
            className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-porch-700 active:bg-porch-50"
          >
            💬 Message {ownerName}
          </Link>

          {status === "PENDING" && (
            <span className="ml-auto flex items-center gap-2">
              {isPending && <Spinner className="text-ink-soft" />}
              <Button
                variant="secondary"
                size="sm"
                disabled={isPending}
                onClick={() => setConfirming(true)}
              >
                Withdraw
              </Button>
            </span>
          )}
        </div>
      </Card>

      <ConfirmSheet
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={withdraw}
        title="Withdraw this offer?"
        body={`${ownerName} won't see it anymore. You can always make a new one while the listing is open.`}
        confirmLabel="Withdraw offer"
        destructive
      />
    </div>
  );
}

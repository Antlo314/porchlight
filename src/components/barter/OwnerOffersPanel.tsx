"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Avatar,
  Button,
  Card,
  ConfirmSheet,
  CreditPill,
  EmptyState,
  SectionHeading,
  Spinner,
  useToast,
} from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { decideOfferAction } from "@/app/(app)/barter/[id]/actions";
import { OfferStatusBadge } from "./StatusBadge";

export type OwnerOffer = {
  id: string;
  message: string;
  offeredItemDesc: string | null;
  creditAmount: number | null;
  status: string;
  createdAt: Date | string;
  offerer: {
    id: string;
    name: string;
    avatarUrl: string | null;
    karma: number;
  };
};

type Decision = "ACCEPTED" | "DECLINED" | "COMPLETED";

export function OwnerOffersPanel({
  offers,
  listingStatus,
}: {
  offers: OwnerOffer[];
  listingStatus: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  // Optimistic status overrides so a tap lands instantly.
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{
    offer: OwnerOffer;
    decision: Decision;
  } | null>(null);

  const statusOf = (offer: OwnerOffer) => overrides[offer.id] ?? offer.status;
  // Once one offer is accepted (or the listing closed) the rest can only be
  // declined — matches the guard in decideOfferAction.
  const canAccept =
    listingStatus === "OPEN" && !offers.some((o) => statusOf(o) === "ACCEPTED");

  function decide(offer: OwnerOffer, decision: Decision) {
    if (isPending) return;
    setOverrides((prev) => ({ ...prev, [offer.id]: decision }));
    setBusyId(offer.id);

    startTransition(async () => {
      const result = await decideOfferAction({
        offerId: offer.id,
        decision,
      });
      setBusyId(null);

      if (!result.ok) {
        // Roll the optimistic status back and say why.
        setOverrides((prev) => {
          const next = { ...prev };
          delete next[offer.id];
          return next;
        });
        toast(result.error, "error");
        return;
      }

      toast(
        decision === "ACCEPTED"
          ? "Offer accepted"
          : decision === "DECLINED"
            ? "Offer declined"
            : "Trade complete 🎉"
      );
      router.refresh();
    });
  }

  if (offers.length === 0) {
    return (
      <>
        <SectionHeading title="Offers" />
        <EmptyState
          icon="📭"
          title="No offers yet"
          body="Neighbors will see this on the Barter tab. Sharing it in a post helps too."
        />
      </>
    );
  }

  return (
    <div>
      <SectionHeading title={`Offers (${offers.length})`} />

      <div className="space-y-3">
        {offers.map((offer) => {
          const status = statusOf(offer);
          const busy = busyId === offer.id;

          return (
            <Card key={offer.id}>
              <div className="flex items-center gap-2">
                <Avatar
                  name={offer.offerer.name}
                  src={offer.offerer.avatarUrl}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {offer.offerer.name}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {offer.offerer.karma} karma · {timeAgo(offer.createdAt)}
                  </p>
                </div>
                <OfferStatusBadge status={status} />
              </div>

              <div className="mt-3 rounded-xl bg-cream p-3">
                {offer.creditAmount !== null ? (
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    Offering <CreditPill amount={offer.creditAmount} />
                  </p>
                ) : (
                  <p className="text-sm">
                    <span className="font-semibold">Offering:</span>{" "}
                    {offer.offeredItemDesc}
                  </p>
                )}
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink-soft">
                  {offer.message}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link
                  href={`/messages/new?to=${offer.offerer.id}`}
                  className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-porch-700 active:bg-porch-50"
                >
                  💬 Message
                </Link>

                <span className="ml-auto flex items-center gap-2">
                  {busy && <Spinner className="text-ink-soft" />}

                  {status === "PENDING" && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={isPending}
                        onClick={() =>
                          setConfirming({ offer, decision: "DECLINED" })
                        }
                      >
                        Decline
                      </Button>
                      {canAccept && (
                        <Button
                          size="sm"
                          disabled={isPending}
                          onClick={() => decide(offer, "ACCEPTED")}
                        >
                          Accept
                        </Button>
                      )}
                    </>
                  )}

                  {status === "ACCEPTED" && (
                    <Button
                      size="sm"
                      disabled={isPending}
                      onClick={() =>
                        setConfirming({ offer, decision: "COMPLETED" })
                      }
                    >
                      Mark complete
                    </Button>
                  )}
                </span>
              </div>

              {status === "ACCEPTED" && (
                <p className="mt-2 text-xs text-ink-soft">
                  Sort out the handoff, then mark it complete
                  {offer.creditAmount !== null
                    ? " — that's when the credits move."
                    : "."}
                </p>
              )}
            </Card>
          );
        })}
      </div>

      <ConfirmSheet
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        onConfirm={() => {
          if (confirming) decide(confirming.offer, confirming.decision);
        }}
        title={
          confirming?.decision === "COMPLETED"
            ? "Mark this trade complete?"
            : "Decline this offer?"
        }
        body={
          confirming?.decision === "COMPLETED"
            ? confirming.offer.creditAmount !== null
              ? `${confirming.offer.creditAmount} Porch Credits move from ${confirming.offer.offerer.name} to you, the listing closes, and you both earn +2 karma.`
              : `The listing closes and you both earn +2 karma.`
            : `${confirming?.offer.offerer.name ?? "This neighbor"} will be told you passed. Your listing stays open.`
        }
        confirmLabel={
          confirming?.decision === "COMPLETED" ? "Complete trade" : "Decline"
        }
        destructive={confirming?.decision === "DECLINED"}
      />
    </div>
  );
}

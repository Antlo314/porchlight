"use client";

import { useState } from "react";
import { CardLink, CreditPill, EmptyState, SegmentedControl } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { kindMeta } from "./meta";
import { OfferStatusBadge } from "./StatusBadge";

export type OfferRow = {
  id: string;
  status: string;
  message: string;
  offeredItemDesc: string | null;
  creditAmount: number | null;
  createdAt: Date | string;
  listing: { id: string; title: string; kind: string; status: string };
  counterpartName: string;
};

type Tab = "MADE" | "RECEIVED";

export function OffersTabs({
  made,
  received,
}: {
  made: OfferRow[];
  received: OfferRow[];
}) {
  const [tab, setTab] = useState<Tab>(
    received.some((o) => o.status === "PENDING") ? "RECEIVED" : "MADE"
  );

  const rows = tab === "MADE" ? made : received;

  return (
    <div className="space-y-3">
      <SegmentedControl<Tab>
        options={[
          { value: "MADE", label: `Offers I made (${made.length})` },
          { value: "RECEIVED", label: `On my listings (${received.length})` },
        ]}
        value={tab}
        onChange={setTab}
      />

      {rows.length === 0 ? (
        tab === "MADE" ? (
          <EmptyState
            icon="🤝"
            title="No offers yet"
            body="Find something a neighbor is offering and make your first trade."
            actionLabel="Browse trades"
            actionHref="/barter"
          />
        ) : (
          <EmptyState
            icon="📭"
            title="No one's offered yet"
            body="Post something you can share — tools, a skill, or an hour of help."
            actionLabel="Post a trade"
            actionHref="/barter/new"
          />
        )
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const meta = kindMeta(row.listing.kind);
            return (
              <CardLink key={row.id} href={`/barter/${row.listing.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[15px] font-semibold leading-snug">
                    {row.listing.title}
                  </h3>
                  <OfferStatusBadge status={row.status} />
                </div>

                <p className="mt-1 text-xs text-ink-soft">
                  <span aria-hidden>{meta.icon}</span> {meta.label} ·{" "}
                  {tab === "MADE" ? "to" : "from"} {row.counterpartName} ·{" "}
                  {timeAgo(row.createdAt)}
                </p>

                <div className="mt-2 flex items-center gap-2 text-sm">
                  {row.creditAmount !== null ? (
                    <CreditPill amount={row.creditAmount} />
                  ) : (
                    <span className="line-clamp-1 text-ink-soft">
                      <span className="font-semibold">Offered:</span>{" "}
                      {row.offeredItemDesc}
                    </span>
                  )}
                </div>

                {row.status === "PENDING" && tab === "RECEIVED" && (
                  <p className="mt-2 text-sm font-semibold text-porch-700">
                    Tap to accept or decline →
                  </p>
                )}
              </CardLink>
            );
          })}
        </div>
      )}
    </div>
  );
}

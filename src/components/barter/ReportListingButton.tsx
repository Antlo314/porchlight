"use client";

import { useState } from "react";
import { ReportSheet } from "@/components/report/ReportSheet";

/** Opens the shared trust-and-safety report sheet for this listing. */
export function ReportListingButton({ listingId }: { listingId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-ink-soft active:bg-line/60"
      >
        Report listing
      </button>
      <ReportSheet
        targetType="LISTING"
        targetId={listingId}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

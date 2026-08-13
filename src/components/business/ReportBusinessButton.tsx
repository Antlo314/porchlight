"use client";

import { useState } from "react";
import { ReportSheet } from "@/components/report/ReportSheet";

/**
 * Thin wrapper so the services vertical only touches the shared ReportSheet
 * through one file (it is owned by the trust-and-safety vertical).
 */
export function ReportBusinessButton({ businessId }: { businessId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 w-full text-sm font-semibold text-ink-soft active:text-ink"
      >
        Report this business
      </button>
      <ReportSheet
        targetType="BUSINESS"
        targetId={businessId}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

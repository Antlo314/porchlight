"use client";

import { useState, useTransition } from "react";
import { Button, useToast } from "@/components/ui";
import { openBillingPortal } from "@/app/(app)/business/pricing/actions";

export function ManageBillingButton() {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  function open() {
    setBusy(true);
    startTransition(async () => {
      const result = await openBillingPortal();
      setBusy(false);
      if (result.ok && result.portalUrl) {
        window.location.assign(result.portalUrl);
        return;
      }
      toast(result.ok ? "No portal URL." : result.error, "error");
    });
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="lg"
      className="mt-2 w-full"
      busy={busy || pending}
      onClick={open}
    >
      {busy || pending ? "Opening…" : "Manage card & cancel"}
    </Button>
  );
}

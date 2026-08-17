"use client";

import { useState, useTransition } from "react";
import { Button, FormError } from "@/components/ui";

export function StormToggle({
  active,
  setStorm,
}: {
  active: boolean;
  setStorm: (input: { active: boolean }) => Promise<{ error?: string } | undefined>;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    start(async () => {
      const result = await setStorm({ active: !active });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-sm leading-relaxed text-ink-soft">
        {active
          ? "The neighborhood is in Storm Mode. The feed shows the roster first."
          : "When ice or wind hits, turn this on. Neighbors check in safe, list what they have, and see who needs help."}
      </p>
      <Button
        type="button"
        variant={active ? "danger" : "primary"}
        disabled={pending}
        onClick={toggle}
      >
        {pending
          ? "Updating…"
          : active
            ? "End Storm Mode"
            : "Turn on Storm Mode"}
      </Button>
      <FormError>{error}</FormError>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Button, Field, FormError, Textarea } from "@/components/ui";
import {
  STORM_RESOURCES,
  STORM_STATUS,
  type StormResource,
  type StormStatus,
} from "@/lib/storm";

export function StormDesk({
  mine,
  checkIn,
}: {
  mine: {
    status: string;
    resource: string | null;
    note: string | null;
  } | null;
  checkIn: (input: {
    status: string;
    resource?: string | null;
    note?: string;
  }) => Promise<{ error?: string } | undefined>;
}) {
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<StormStatus>(
    mine?.status === "NEED_HELP" ? "NEED_HELP" : "SAFE",
  );
  const [resource, setResource] = useState<StormResource | "">(
    (mine?.resource as StormResource) ?? "",
  );
  const [note, setNote] = useState(mine?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    start(async () => {
      const result = await checkIn({
        status,
        resource: resource || null,
        note,
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(STORM_STATUS) as StormStatus[]).map((key) => {
          const active = status === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => setStatus(key)}
              className={`min-h-16 rounded-card border p-3 text-left ${
                active
                  ? key === "NEED_HELP"
                    ? "border-porch-600 bg-porch-50"
                    : "border-pine-600 bg-pine-50"
                  : "border-line bg-card"
              }`}
            >
              <span className="block text-sm font-semibold">
                {STORM_STATUS[key].label}
              </span>
              <span className="mt-0.5 block text-xs text-ink-soft">
                {STORM_STATUS[key].hint}
              </span>
            </button>
          );
        })}
      </div>

      <Field label="I can share" hint="Optional. Only if you have it now.">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(STORM_RESOURCES) as StormResource[]).map((key) => {
            const active = resource === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => setResource(active ? "" : key)}
                className={`min-h-10 rounded-full border px-3 text-sm font-semibold ${
                  active
                    ? "border-pine-700 bg-pine-800 text-cream"
                    : "border-line bg-card text-ink-soft"
                }`}
              >
                {STORM_RESOURCES[key].icon} {STORM_RESOURCES[key].label}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Note" hint="A street, a need, a spare freezer. Short.">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 240))}
          maxLength={240}
          placeholder="Ice on Hosea Williams. Can take two phones to charge."
        />
      </Field>

      <FormError>{error}</FormError>
      <Button type="button" size="lg" disabled={pending} onClick={submit}>
        {pending ? "Saving…" : mine ? "Update check-in" : "Check in"}
      </Button>
    </div>
  );
}

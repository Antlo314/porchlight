"use client";

import { useState, useTransition } from "react";

export function VerifySwitch({
  userId,
  verified,
  setVerified,
}: {
  userId: string;
  verified: boolean;
  setVerified: (input: {
    userId: string;
    verified: boolean;
  }) => Promise<{ error?: string } | undefined>;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="shrink-0 text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const result = await setVerified({
              userId,
              verified: !verified,
            });
            if (result?.error) setError(result.error);
          });
        }}
        className={`min-h-10 rounded-full px-3 text-sm font-semibold ${
          verified
            ? "border border-pine-200 bg-pine-50 text-pine-800"
            : "border border-line bg-card text-porch-800"
        }`}
      >
        {pending ? "Saving…" : verified ? "Verified" : "Verify"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

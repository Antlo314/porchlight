"use client";

import { useState, useTransition } from "react";

export function RoleSwitch({
  userId,
  role,
  setRole,
}: {
  userId: string;
  role: "MEMBER" | "MODERATOR";
  setRole: (input: {
    userId: string;
    role: "MEMBER" | "MODERATOR";
  }) => Promise<{ error?: string } | undefined>;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const next = role === "MODERATOR" ? "MEMBER" : "MODERATOR";

  return (
    <div className="shrink-0 text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const result = await setRole({ userId, role: next });
            if (result?.error) setError(result.error);
          });
        }}
        className={`min-h-10 rounded-full px-3 text-sm font-semibold ${
          role === "MODERATOR"
            ? "bg-pine-800 text-cream"
            : "border border-line bg-card text-porch-800"
        }`}
      >
        {pending
          ? "Saving…"
          : role === "MODERATOR"
            ? "Remove mod"
            : "Make mod"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

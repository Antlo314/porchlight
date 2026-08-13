"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button, Field, FormError, Input } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(form.get("email") ?? "").trim().toLowerCase(),
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;
      if (!res.ok) {
        setError(data?.error ?? "Couldn't send the email.");
        setBusy(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Couldn't reach Porchlight. Check your connection.");
    }
    setBusy(false);
  }

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter the email on the account. If it's on Porchlight, we'll send a reset link that works for 30 minutes."
      footer={
        <Link href="/login" className="font-semibold text-porch-700">
          Back to log in
        </Link>
      }
    >
      {done ? (
        <div className="surface p-4">
          <p className="font-display text-[17px] font-semibold">
            Check your inbox
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            If that email is on Porchlight, we sent a reset link. It expires in
            30 minutes.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Email" required>
            <Input
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              autoComplete="email"
            />
          </Field>
          <FormError>{error}</FormError>
          <Button type="submit" size="lg" busy={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

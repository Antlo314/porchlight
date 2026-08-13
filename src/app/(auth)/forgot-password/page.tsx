"use client";

import Link from "next/link";
import { useState } from "react";
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
    <main className="mx-auto max-w-md px-6 py-12">
      <Link href="/" className="text-2xl" aria-label="Porchlight home">
        🏮
      </Link>
      <h1 className="mt-4 text-2xl font-bold">Forgot your password?</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Enter the email on the account. If it&apos;s on Porchlight, we&apos;ll
        send a reset link that works for 30 minutes.
      </p>

      {done ? (
        <div className="mt-6 rounded-card border border-porch-200 bg-porch-50 p-4">
          <p className="text-[15px] font-semibold">Check your inbox</p>
          <p className="mt-1 text-sm text-ink-soft">
            If that email is on Porchlight, we sent a reset link. It expires in
            30 minutes.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
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
          <Button type="submit" size="lg" disabled={busy} aria-busy={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-ink-soft">
        <Link href="/login" className="font-semibold text-porch-700">
          Back to log in
        </Link>
      </p>
    </main>
  );
}

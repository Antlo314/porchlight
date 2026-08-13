"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button, Field, FormError, Input } from "@/components/ui";

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    if (password !== confirm) {
      setError("Those passwords don't match.");
      setBusy(false);
      return;
    }
    if (!token) {
      setError("This reset link is missing its token. Request a new one.");
      setBusy(false);
      return;
    }
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? "Couldn't update the password.");
        setBusy(false);
        return;
      }
      router.push("/feed");
      router.refresh();
    } catch {
      setError("Couldn't reach Porchlight. Check your connection.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <Link href="/" className="text-2xl" aria-label="Porchlight home">
        🏮
      </Link>
      <h1 className="mt-4 text-2xl font-bold">Choose a new password</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="New password" hint="8 characters or more" required>
          <Input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </Field>
        <Field label="Confirm password" required>
          <Input
            name="confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </Field>
        <FormError>{error}</FormError>
        <Button type="submit" size="lg" disabled={busy || !token} aria-busy={busy}>
          {busy ? "Saving…" : "Save password and log in"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-soft">
        <Link href="/forgot-password" className="font-semibold text-porch-700">
          Request a new link
        </Link>
      </p>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}

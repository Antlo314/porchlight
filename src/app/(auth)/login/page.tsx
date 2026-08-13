"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button, ButtonLink, Field, FormError, Input } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOffline(false);
    const form = new FormData(e.currentTarget);

    let res: Response;
    try {
      res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(form.get("email") ?? "").trim().toLowerCase(),
          password: form.get("password"),
        }),
      });
    } catch {
      setOffline(true);
      setError("Couldn't reach Porchlight. Check your connection.");
      setBusy(false);
      return;
    }

    if (res.ok) {
      router.push(params.get("next") ?? "/feed");
      router.refresh();
      return;
    }

    const data = (await res.json().catch(() => null)) as {
      error?: string;
      offline?: boolean;
    } | null;
    if (data?.offline) setOffline(true);
    setError(data?.error ?? "Something went wrong");
    setBusy(false);
  }

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <Link href="/" className="text-2xl" aria-label="Porchlight home">
        🏮
      </Link>
      <h1 className="mt-4 text-2xl font-bold">Welcome back</h1>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Field label="Email" required>
          <Input
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            autoComplete="email"
          />
        </Field>
        <Field label="Password" required>
          <Input
            name="password"
            type="password"
            required
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </Field>
        <FormError>{error}</FormError>
        <Button type="submit" size="lg" disabled={busy} aria-busy={busy}>
          {busy ? "Logging in…" : "Log in"}
        </Button>
      </form>

      {offline && (
        <div className="mt-5 rounded-card border border-porch-200 bg-porch-50 p-4">
          <p className="text-[15px] font-semibold">The ledger is offline</p>
          <p className="mt-1 text-sm text-ink-soft">
            Signup and login need a Neon database. You can still play Light the
            Block as a guest right now.
          </p>
          <ButtonLink href="/games" className="mt-3" size="md">
            Play Light the Block
          </ButtonLink>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-ink-soft">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-porch-700">
          Join your neighborhood
        </Link>
        {" · "}
        <Link href="/games" className="font-semibold text-porch-700">
          Play as a guest
        </Link>
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

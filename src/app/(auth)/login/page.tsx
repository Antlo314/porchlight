"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import {
  Button,
  ButtonLink,
  Field,
  FormError,
  Input,
  PasswordInput,
} from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/feed";
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
      router.push(next);
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

  const signupHref =
    next && next !== "/feed"
      ? `/signup?next=${encodeURIComponent(next)}`
      : "/signup";
  const forgotHref =
    next && next !== "/feed"
      ? `/forgot-password?next=${encodeURIComponent(next)}`
      : "/forgot-password";

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Your block is right where you left it."
      footer={
        <>
          New here?{" "}
          <Link href={signupHref} className="font-semibold text-porch-700">
            Join your neighborhood
          </Link>
          {" · "}
          <Link href="/games" className="font-semibold text-porch-700">
            Play as a guest
          </Link>
        </>
      }
    >
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
        <Field label="Password" required>
          <PasswordInput
            name="password"
            required
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </Field>
        <FormError>{error}</FormError>
        <p className="-mt-1 text-right">
          <Link
            href={forgotHref}
            className="text-sm font-semibold text-porch-700"
          >
            Forgot password?
          </Link>
        </p>
        <Button type="submit" size="lg" busy={busy}>
          {busy ? "Logging in…" : "Log in"}
        </Button>
      </form>

      {offline && (
        <div className="mt-5 rounded-card border border-porch-200 bg-porch-50 p-4">
          <p className="text-[15px] font-semibold">The ledger is offline</p>
          <p className="mt-1 text-sm text-ink-soft">
            Signup and login need the database. You can still play Ember&apos;s
            Quilt as a guest right now.
          </p>
          <ButtonLink href="/games" className="mt-3" size="md">
            Play Ember&apos;s Quilt
          </ButtonLink>
        </div>
      )}
    </AuthShell>
  );
}

function AuthFallback() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Your block is right where you left it."
    >
      <div className="space-y-4" aria-hidden>
        <div className="h-12 animate-shimmer rounded-card bg-line/70" />
        <div className="h-12 animate-shimmer rounded-card bg-line/70" />
        <div className="h-13 animate-shimmer rounded-card bg-line/70" />
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <LoginForm />
    </Suspense>
  );
}

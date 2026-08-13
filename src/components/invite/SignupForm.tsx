"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button, ButtonLink, Field, FormError, Input, Select } from "@/components/ui";

// Lives under components/invite because the invite flow is what made signup
// need a server component in front of it: the code has to be resolved on the
// server (see app/(auth)/signup/page.tsx) before this form ever renders.

type Neighborhood = { id: string; name: string; city: string; county: string };

export type SignupInvite = {
  code: string;
  inviterName: string;
  neighborhoodName: string;
  city: string;
};

export function SignupForm({
  invite,
  inviteAttempted,
  signupBonus,
  inviteBonus,
}: {
  /** Resolved server-side from ?invite=CODE; null means the normal signup. */
  invite: SignupInvite | null;
  /** A code was in the URL, whether or not it resolved. */
  inviteAttempted: boolean;
  signupBonus: number;
  inviteBonus: number;
}) {
  const router = useRouter();
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [hoodStatus, setHoodStatus] = useState<"loading" | "ready" | "empty" | "offline">(
    invite ? "ready" : "loading"
  );
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  // Cleared if the server rejects the code at submit time — for instance the
  // inviter left between page load and submit — which brings the picker back
  // instead of trapping someone on a form they can't complete.
  const [activeInvite, setActiveInvite] = useState<SignupInvite | null>(invite);

  const loadNeighborhoods = useCallback(async () => {
    if (activeInvite) return;
    setHoodStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/neighborhoods");
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(data)) {
        setNeighborhoods([]);
        setHoodStatus("offline");
        setError(
          (data &&
          typeof data === "object" &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "Couldn't load neighborhoods. The database isn't connected.")
        );
        return;
      }
      setNeighborhoods(data);
      setHoodStatus(data.length === 0 ? "empty" : "ready");
    } catch {
      setNeighborhoods([]);
      setHoodStatus("offline");
      setError("Couldn't load neighborhoods. Check your connection and try again.");
    }
  }, [activeInvite]);

  useEffect(() => {
    void loadNeighborhoods();
  }, [loadNeighborhoods]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeInvite && hoodStatus !== "ready") return;
    setBusy(true);
    setError(null);
    setOffline(false);

    const form = new FormData(e.currentTarget);
    const payload: Record<string, string> = {
      name: String(form.get("name") ?? "").trim(),
      email: String(form.get("email") ?? "").trim().toLowerCase(),
      password: String(form.get("password") ?? ""),
    };
    if (activeInvite) payload.inviteCode = activeInvite.code;
    else payload.neighborhoodId = String(form.get("neighborhoodId") ?? "");

    let res: Response;
    try {
      res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      setOffline(true);
      setError("Couldn't reach Porchlight. Check your connection.");
      setBusy(false);
      return;
    }

    if (res.ok) {
      const payload = (await res.json().catch(() => null)) as {
        needsLogin?: boolean;
      } | null;
      router.push(payload?.needsLogin ? "/login?next=/feed" : "/feed");
      router.refresh();
      return;
    }

    const data = (await res.json().catch(() => null)) as {
      error?: string;
      inviteInvalid?: boolean;
      offline?: boolean;
    } | null;
    if (data?.inviteInvalid) setActiveInvite(null);
    if (data?.offline) setOffline(true);
    setError(data?.error ?? "Something went wrong creating the account.");
    setBusy(false);
  }

  const startingCredits = signupBonus + (activeInvite ? inviteBonus : 0);
  const canSubmit = Boolean(activeInvite) || hoodStatus === "ready";

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <Link href="/" className="text-2xl" aria-label="Porchlight home">
        🏮
      </Link>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">
        {activeInvite
          ? `Join ${activeInvite.neighborhoodName}`
          : "Join your neighborhood"}
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        You&apos;ll start with {startingCredits} Porch Credits to trade with.
      </p>

      {activeInvite && (
        <div className="mt-5 rounded-card border border-porch-200 bg-porch-50 p-4">
          <p className="text-[15px] font-semibold">
            {activeInvite.neighborhoodName}, {activeInvite.city}
          </p>
          <p className="mt-0.5 text-sm text-ink-soft">
            Invited by {activeInvite.inviterName} — your neighborhood is set by
            their invite, so there&apos;s nothing to pick.
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            🪙 {signupBonus} welcome credits + {inviteBonus} invite bonus.
          </p>
        </div>
      )}

      {inviteAttempted && !activeInvite && (
        <div className="mt-5 rounded-card border border-line bg-card p-4">
          <p className="text-[15px] font-semibold">
            That invite link didn&apos;t work
          </p>
          <p className="mt-0.5 text-sm text-ink-soft">
            No problem — pick your neighborhood below. You still start with{" "}
            {signupBonus} Porch Credits.
          </p>
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="Your name" required>
          <Input
            name="name"
            required
            minLength={2}
            maxLength={60}
            placeholder="Jordan Ellis"
            autoComplete="name"
          />
        </Field>

        <Field label="Email" required>
          <Input
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            autoComplete="email"
          />
        </Field>

        <Field label="Password" hint="8 characters or more" required>
          <Input
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="••••••••"
            autoComplete="new-password"
          />
        </Field>

        {!activeInvite && (
          <Field label="Neighborhood" required>
            <Select
              name="neighborhoodId"
              required={hoodStatus === "ready"}
              defaultValue=""
              disabled={hoodStatus !== "ready"}
            >
              <option value="" disabled>
                {hoodStatus === "loading"
                  ? "Loading neighborhoods…"
                  : hoodStatus === "offline"
                    ? "Neighborhoods unavailable"
                    : hoodStatus === "empty"
                      ? "No neighborhoods yet"
                      : "Pick your neighborhood"}
              </option>
              {neighborhoods.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} — {n.city}
                </option>
              ))}
            </Select>
            {hoodStatus === "offline" && (
              <button
                type="button"
                onClick={() => void loadNeighborhoods()}
                className="mt-2 text-sm font-semibold text-porch-700"
              >
                Try loading neighborhoods again
              </button>
            )}
            {hoodStatus === "empty" && (
              <p className="mt-2 text-sm text-ink-soft">
                The block list hasn&apos;t been seeded yet. Run{" "}
                <code className="rounded bg-line px-1">npm run db:seed</code>{" "}
                against your Neon database.
              </p>
            )}
          </Field>
        )}

        <FormError>{error}</FormError>

        <Button
          type="submit"
          size="lg"
          disabled={busy || !canSubmit}
          aria-busy={busy}
        >
          {busy ? "Creating account…" : "Create account"}
        </Button>
      </form>

      {(offline || hoodStatus === "offline") && (
        <div className="mt-5 rounded-card border border-porch-200 bg-porch-50 p-4">
          <p className="text-[15px] font-semibold">Play while the ledger is offline</p>
          <p className="mt-1 text-sm text-ink-soft">
            Light the Block works as a guest. Sign up later, once the database
            is connected, to keep Porch Credits.
          </p>
          <ButtonLink href="/games" className="mt-3" size="md">
            Play Light the Block
          </ButtonLink>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-ink-soft">
        Already a member?{" "}
        <Link href="/login" className="font-semibold text-porch-700">
          Log in
        </Link>
        {" · "}
        <Link href="/games" className="font-semibold text-porch-700">
          Play as a guest
        </Link>
      </p>
    </main>
  );
}

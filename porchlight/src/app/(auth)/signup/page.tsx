"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Neighborhood = { id: string; name: string; city: string; county: string };

export default function SignupPage() {
  const router = useRouter();
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/neighborhoods")
      .then((r) => r.json())
      .then(setNeighborhoods)
      .catch(() => setError("Couldn't load neighborhoods"));
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
        neighborhoodId: form.get("neighborhoodId"),
      }),
    });
    if (res.ok) {
      router.push("/feed");
      router.refresh();
    } else {
      setError((await res.json()).error ?? "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <Link href="/" className="text-2xl">🏮</Link>
      <h1 className="mt-4 text-2xl font-bold">Join your neighborhood</h1>
      <p className="mt-2 text-sm text-ink-soft">
        You&apos;ll start with 25 Porch Credits to trade with.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <input
          name="name"
          required
          placeholder="Your name"
          autoComplete="name"
          className="w-full rounded-card border border-line bg-card px-4 py-3.5 outline-none focus:border-porch-500"
        />
        <input
          name="email"
          type="email"
          required
          placeholder="Email"
          autoComplete="email"
          className="w-full rounded-card border border-line bg-card px-4 py-3.5 outline-none focus:border-porch-500"
        />
        <input
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="Password (8+ characters)"
          autoComplete="new-password"
          className="w-full rounded-card border border-line bg-card px-4 py-3.5 outline-none focus:border-porch-500"
        />
        <select
          name="neighborhoodId"
          required
          defaultValue=""
          className="w-full rounded-card border border-line bg-card px-4 py-3.5 outline-none focus:border-porch-500"
        >
          <option value="" disabled>
            Pick your neighborhood
          </option>
          {neighborhoods.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name} — {n.city}
            </option>
          ))}
        </select>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          disabled={busy}
          className="w-full rounded-card bg-porch-600 py-3.5 font-semibold text-white active:bg-porch-700 disabled:opacity-60"
        >
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-soft">
        Already a member?{" "}
        <Link href="/login" className="font-semibold text-porch-700">
          Log in
        </Link>
      </p>
    </main>
  );
}

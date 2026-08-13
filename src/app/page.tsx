import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function LandingPage() {
  const session = await getSession();
  if (session) redirect("/feed");

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col">
      {/* Hero — the porch at golden hour, fading into the cream page. */}
      <div className="relative h-[52dvh] w-full overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element -- static hero,
            full-viewport-width in a fixed box; next/image adds nothing here */}
        <img
          src="/images/hero.jpg"
          alt=""
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/10 via-transparent to-cream" />
      </div>

      <div className="flex flex-1 flex-col justify-between px-6 pb-6">
        <div className="-mt-10 relative">
          <h1 className="text-4xl font-bold tracking-tight">
            <span aria-hidden>🏮</span> Porchlight
          </h1>
          <p className="mt-3 text-lg text-ink-soft">
            Your Georgia neighborhood, together. News, trades, local pros, and
            neighbors you can actually reach.
          </p>
          <ul className="mt-6 space-y-3 text-[15px] text-ink-soft">
            <li>🤝 Barter goods, skills, and time with Porch Credits</li>
            <li>🏮 Play Ember&apos;s Quilt — match, rank, win weekly coins</li>
            <li>🛠️ Local pros listed free — no pay-to-be-seen</li>
          </ul>
        </div>

        <div className="mt-8 space-y-3">
          <Link
            href="/signup"
            className="block rounded-card bg-porch-600 py-3.5 text-center font-semibold text-white active:bg-porch-700"
          >
            Join your neighborhood
          </Link>
          <Link
            href="/login"
            className="block rounded-card border border-line bg-card py-3.5 text-center font-semibold active:bg-porch-50"
          >
            Log in
          </Link>
          <Link
            href="/games"
            className="block rounded-card border border-porch-200 bg-porch-50 py-3.5 text-center font-semibold text-porch-800 active:bg-porch-100"
          >
            Play Ember&apos;s Quilt — no account needed
          </Link>
          <p className="pt-1 text-center text-xs text-ink-soft">
            Free for neighbors. Forever.
          </p>
        </div>
      </div>
    </main>
  );
}

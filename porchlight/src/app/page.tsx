import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function LandingPage() {
  const session = await getSession();
  if (session) redirect("/feed");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-between px-6 py-10">
      <div className="pt-16">
        <p className="text-4xl">🏮</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">Porchlight</h1>
        <p className="mt-3 text-lg text-ink-soft">
          Your Georgia neighborhood, together. News, trades, local pros, and
          neighbors you can actually reach.
        </p>
        <ul className="mt-8 space-y-3 text-sm text-ink-soft">
          <li>🤝 Barter goods, skills, and time with Porch Credits</li>
          <li>🛠️ Local services without the $170 gatekeeping fee</li>
          <li>💬 Real chats and DMs, built for your block</li>
        </ul>
      </div>
      <div className="space-y-3 pb-4">
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
      </div>
    </main>
  );
}

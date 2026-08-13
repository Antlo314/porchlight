import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { creditBalance } from "@/lib/credits";
import { CreditPill } from "@/components/ui";

export default async function GamesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser().catch(() => null);
  const balance = user ? await creditBalance(user.id).catch(() => null) : null;

  return (
    <div className="min-h-dvh bg-cream">
      <header className="sticky top-0 z-30 border-b border-line bg-cream/90 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <Link
            href={user ? "/feed" : "/"}
            className="flex min-h-11 items-center gap-2 text-sm font-semibold text-porch-700"
          >
            ← {user ? "Feed" : "Porchlight"}
          </Link>
          <Link href="/games" className="text-sm font-bold">
            <span aria-hidden>🏮</span> Games
          </Link>
          {balance !== null ? (
            <Link href="/barter/credits" className="min-h-11 content-center">
              <CreditPill amount={balance} />
            </Link>
          ) : (
            <Link href="/login?next=/games" className="text-sm font-semibold text-porch-700">
              Log in
            </Link>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}

import Link from "next/link";
import { BrandMark, CreditPill, Icon } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { creditBalance } from "@/lib/credits";

export default async function GamesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser().catch(() => null);
  const balance = user ? await creditBalance(user.id).catch(() => null) : null;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-cream/75 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-2.5">
          <Link
            href={user ? "/feed" : "/"}
            className="flex min-h-11 items-center gap-1.5 text-sm font-semibold text-porch-800"
          >
            <Icon name="arrowLeft" className="h-4 w-4" />
            {user ? "Feed" : "Home"}
          </Link>
          <BrandMark href="/games" size="sm" />
          {balance !== null ? (
            <Link href="/barter/credits" className="min-h-11 content-center">
              <CreditPill amount={balance} />
            </Link>
          ) : (
            <Link
              href="/login?next=/games"
              className="text-sm font-semibold text-porch-700"
            >
              Log in
            </Link>
          )}
        </div>
      </header>
      <div className="mx-auto max-w-md px-4 pt-4 lg:max-w-2xl">{children}</div>
    </div>
  );
}

import Link from "next/link";
import { ButtonLink, Card, CoinIcon } from "@/components/ui";
import { creditBalance } from "@/lib/credits";

export async function DesktopRail({
  userId,
  neighborhoodName,
}: {
  userId: string;
  neighborhoodName: string;
}) {
  const balance = await creditBalance(userId).catch(() => 0);

  return (
    <aside className="sticky top-20 hidden self-start space-y-3 lg:block">
      <div className="surface-ink p-4">
        <p className="text-sm font-semibold text-porch-200">Porch Credits</p>
        <p className="mt-1 flex items-center gap-2 font-display text-3xl font-semibold tabular-nums">
          <CoinIcon className="h-8 w-8" />
          {balance}
        </p>
        <p className="mt-1 text-sm text-porch-200">
          Earned from neighbors — never bought.
        </p>
        <Link
          href="/barter/credits"
          className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-cream"
        >
          Ledger →
        </Link>
      </div>

      <Card>
        <p className="font-display text-[15px] font-semibold">
          Keep {neighborhoodName} talking
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          Reply on a post. Message a neighbor. That&apos;s how the porch stays
          lit.
        </p>
        <div className="mt-3 space-y-2">
          <ButtonLink href="/feed/new" size="sm" className="w-full">
            Write a post
          </ButtonLink>
          <ButtonLink href="/messages/new" variant="secondary" size="sm" className="w-full">
            Start a DM
          </ButtonLink>
        </div>
      </Card>

      <Card className="border-porch-200 bg-porch-50">
        <p className="font-display text-[15px] font-semibold">Ember&apos;s Quilt</p>
        <p className="mt-1 text-sm text-ink-soft">
          Match, rank, win weekly coins. Guests can play; neighbors rank.
        </p>
        <Link
          href="/games"
          className="mt-2 inline-flex min-h-10 items-center font-semibold text-porch-700"
        >
          Play this week →
        </Link>
      </Card>

      <Card>
        <p className="font-display text-[15px] font-semibold">
          Invite a neighbor
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          You both earn Porch Credits when they join.
        </p>
        <Link
          href="/invite"
          className="mt-2 inline-flex min-h-10 items-center font-semibold text-porch-700"
        >
          Share your link →
        </Link>
      </Card>

      <Card>
        <p className="font-display text-[15px] font-semibold">
          Local pro? List free.
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          A profile, neighbor reviews, and one service — no listing fee. Upgrade
          only when it&apos;s earning you work.
        </p>
        <Link
          href="/business/new"
          className="mt-2 inline-flex min-h-10 items-center font-semibold text-porch-700"
        >
          List your business →
        </Link>
      </Card>
    </aside>
  );
}

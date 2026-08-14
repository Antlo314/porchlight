import Link from "next/link";
import { Card, EmptyState, SectionHeading } from "@/components/ui";
import { BackLink } from "@/components/barter/BackLink";
import { CreditBalanceCard } from "@/components/barter/CreditBalanceCard";
import { creditReasonLabel } from "@/components/barter/meta";
import { requireUser } from "@/lib/auth";
import { creditBalance } from "@/lib/credits";
import { db } from "@/lib/db";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "Porch Credits" };

export default async function CreditsPage() {
  const user = await requireUser();

  const [balance, entries, earnedAgg, spentAgg] = await Promise.all([
    creditBalance(user.id),
    db.tradeCreditEntry.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        offer: {
          select: {
            listing: { select: { id: true, title: true } },
          },
        },
      },
    }),
    db.tradeCreditEntry.aggregate({
      where: { userId: user.id, delta: { gt: 0 } },
      _sum: { delta: true },
    }),
    db.tradeCreditEntry.aggregate({
      where: { userId: user.id, delta: { lt: 0 } },
      _sum: { delta: true },
    }),
  ]);

  const earned = earnedAgg._sum.delta ?? 0;
  const spent = Math.abs(spentAgg._sum.delta ?? 0);

  return (
    <div className="space-y-4">
      <BackLink />

      <CreditBalanceCard
        balance={balance}
        caption="Every credit here came from a neighbor."
      />

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Earned
          </p>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-emerald-700">
            +{earned}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Spent
          </p>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-ink">
            −{spent}
          </p>
        </Card>
      </div>

      <Card className="border-porch-200 bg-porch-50">
        <p className="text-[15px] font-semibold">How Porch Credits work</p>
        <ul className="mt-2 space-y-1.5 text-sm text-ink-soft">
          <li>
            <span aria-hidden>🤝</span> You earn them by helping neighbors —
            completing a trade moves credits from them to you.
          </li>
          <li>
            <span aria-hidden>⏱️</span> An hour of anyone&apos;s time is worth
            10 credits. A tutor&apos;s hour and a dog-walker&apos;s hour count
            the same.
          </li>
          <li>
            <span aria-hidden>🏮</span> Playing games earns about 10 credits
            an hour. No daily wall — just a neighborly pace.
          </li>
          <li>
            <span aria-hidden>🚫</span> They can&apos;t be bought and they
            can&apos;t be cashed out. Porch Credits are a neighborhood
            currency, not money.
          </li>
        </ul>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          <Link
            href="/barter/new"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-porch-700"
          >
            Post something to earn credits →
          </Link>
          <Link
            href="/games"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-porch-700"
          >
            Play games →
          </Link>
        </div>
      </Card>

      <SectionHeading title="History" />

      {entries.length === 0 ? (
        <EmptyState
          icon="🪙"
          title="No credit activity yet"
          body="Complete a trade with a neighbor and it'll show up here."
          actionLabel="Browse trades"
          actionHref="/barter"
        />
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => {
            const listing = entry.offer?.listing;
            return (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 rounded-card border border-line bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold">
                    {creditReasonLabel(entry.reason)}
                  </p>
                  <p className="truncate text-sm text-ink-soft">
                    {listing ? (
                      <Link
                        href={`/barter/${listing.id}`}
                        className="text-porch-700"
                      >
                        {listing.title}
                      </Link>
                    ) : (
                      "Porchlight"
                    )}{" "}
                    · {timeAgo(entry.createdAt)}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-base font-bold tabular-nums ${
                    entry.delta > 0 ? "text-emerald-700" : "text-red-600"
                  }`}
                >
                  {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

import Link from "next/link";

/**
 * The three ways into barter. Kept as a row of equal tiles rather than a list
 * of links so the whole thing fits above the fold on a phone — a member should
 * be able to reach wants or matches without scrolling past the listings.
 */
const TILE =
  "flex min-h-20 flex-1 flex-col items-center justify-center gap-0.5 rounded-card border border-line bg-card px-2 text-center transition-transform duration-100 active:scale-[0.97] active:bg-porch-50/60";

function Count({ n, tone }: { n: number; tone: "porch" | "pine" }) {
  if (n <= 0) return <span className="text-xs text-ink-soft">None yet</span>;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-bold text-white ${
        tone === "porch" ? "bg-porch-600" : "bg-pine-600"
      }`}
    >
      {n}
    </span>
  );
}

export function BarterNav({
  openWants,
  pendingOffers,
  matchCount,
}: {
  openWants: number;
  pendingOffers: number;
  matchCount: number;
}) {
  return (
    <div className="flex gap-2">
      <Link href="/barter/wants" className={TILE}>
        <span className="text-xl leading-none" aria-hidden>
          🙋
        </span>
        <span className="text-[13px] font-semibold leading-tight">
          Wanted
        </span>
        <Count n={openWants} tone="pine" />
      </Link>

      <Link href="/barter/matches" className={TILE}>
        <span className="text-xl leading-none" aria-hidden>
          🎯
        </span>
        <span className="text-[13px] font-semibold leading-tight">Matches</span>
        <Count n={matchCount} tone="porch" />
      </Link>

      <Link href="/barter/offers" className={TILE}>
        <span className="text-xl leading-none" aria-hidden>
          📨
        </span>
        <span className="text-[13px] font-semibold leading-tight">Offers</span>
        <Count n={pendingOffers} tone="porch" />
      </Link>
    </div>
  );
}

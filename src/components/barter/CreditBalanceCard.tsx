import Link from "next/link";

/**
 * The Porch Credits header. Tapping it opens the ledger — the balance is
 * always derived from TradeCreditEntry rows, never stored.
 */
export function CreditBalanceCard({
  balance,
  href,
  caption = "Earned by helping neighbors",
}: {
  balance: number;
  href?: string;
  caption?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-porch-100">
            Your Porch Credits
          </p>
          <p className="font-display text-3xl font-semibold tabular-nums">
            <span aria-hidden>🪙 </span>
            {balance}
          </p>
        </div>
        {href && (
          <span className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold">
            History →
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-porch-100">{caption}</p>
    </>
  );

  const className =
    "block rounded-card bg-porch-600 p-4 text-white shadow-glow";

  if (!href) return <div className={className}>{body}</div>;

  return (
    <Link
      href={href}
      className={`${className} transition-transform duration-150 active:scale-[0.99] active:bg-porch-700`}
    >
      {body}
    </Link>
  );
}

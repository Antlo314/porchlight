export function Badge({
  children,
  className = "bg-line text-ink-soft",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

export function CreditPill({
  amount,
  className = "",
}: {
  amount: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-porch-100 px-2 py-0.5 text-sm font-bold tabular-nums text-porch-800 ${className}`}
    >
      🪙 {amount}
    </span>
  );
}

export function VerifiedMark({ label = "Verified" }: { label?: string }) {
  return (
    <span title={label} aria-label={label} className="text-porch-600">
      ✓
    </span>
  );
}

/** Small count bubble for tab bars and the notification bell. */
export function CountDot({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-1.5 -top-1 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] font-bold leading-4 text-white">
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function Stars({
  rating,
  count,
}: {
  rating: number | null;
  count?: number;
}) {
  if (rating === null) {
    return <span className="text-sm text-ink-soft">No reviews yet</span>;
  }
  const rounded = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span className="text-porch-500" aria-hidden>
        {"★".repeat(rounded)}
        <span className="text-line">{"★".repeat(5 - rounded)}</span>
      </span>
      <span className="font-semibold tabular-nums">{rating.toFixed(1)}</span>
      {count !== undefined && (
        <span className="text-ink-soft">({count})</span>
      )}
    </span>
  );
}

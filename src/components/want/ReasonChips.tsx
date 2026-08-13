/**
 * The "why" under every match. Rendered as separate chips rather than one
 * sentence so the strongest reason (a shared word) reads first and stays
 * scannable on a 375px screen.
 */
export function ReasonChips({
  reasons,
  className = "",
}: {
  reasons: string[];
  className?: string;
}) {
  if (reasons.length === 0) return null;

  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`.trim()}>
      {reasons.map((reason) => (
        <li
          key={reason}
          className="rounded-full bg-pine-500/10 px-2 py-0.5 text-[11px] font-semibold text-pine-700"
        >
          {reason}
        </li>
      ))}
    </ul>
  );
}

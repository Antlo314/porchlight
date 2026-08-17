import Link from "next/link";

export function StormBanner({
  neighborhoodName,
  safe,
  needHelp,
}: {
  neighborhoodName: string;
  safe: number;
  needHelp: number;
}) {
  return (
    <Link
      href="/storm"
      className="block overflow-hidden rounded-card border border-pine-800 bg-pine-900 text-cream shadow-lift transition-transform duration-150 active:scale-[0.99]"
    >
      <div className="relative px-4 py-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-porch-300">
          Storm Mode · {neighborhoodName}
        </p>
        <p className="mt-1 font-display text-[1.2rem] font-semibold leading-snug">
          Check in. Share what you have. Find who needs you.
        </p>
        <p className="mt-2 text-sm text-cream/80">
          <span className="font-semibold tabular-nums text-cream">{safe}</span>{" "}
          safe
          <span className="mx-2 text-cream/40">·</span>
          <span className="font-semibold tabular-nums text-porch-200">
            {needHelp}
          </span>{" "}
          need help
          <span className="ml-2">→</span>
        </p>
      </div>
    </Link>
  );
}

import { Card } from "@/components/ui";
import { pluralize } from "@/lib/format";

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-card border border-line bg-card p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}

/**
 * Owner-facing performance. Impressions and clicks are the real counters
 * incremented when the featured rail renders and gets tapped, so a business
 * paying for placement (or receiving a pool-funded boost) can check delivery.
 */
export function BusinessAnalytics({
  reviewCount,
  avgRating,
  verifiedJobCount,
  impressions,
  clicks,
  liveBoosts,
  poolFundedBoosts,
}: {
  reviewCount: number;
  avgRating: number | null;
  verifiedJobCount: number;
  impressions: number;
  clicks: number;
  liveBoosts: number;
  poolFundedBoosts: number;
}) {
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          label="Reviews"
          value={String(reviewCount)}
          hint={
            verifiedJobCount > 0
              ? `${verifiedJobCount} from verified jobs`
              : "No verified jobs yet"
          }
        />
        <StatTile
          label="Rating"
          value={avgRating === null ? "—" : avgRating.toFixed(1)}
          hint={avgRating === null ? "Waiting on your first" : "out of 5"}
        />
        <StatTile
          label="Boost views"
          value={impressions.toLocaleString("en-US")}
          hint="Times you appeared featured"
        />
        <StatTile
          label="Boost taps"
          value={clicks.toLocaleString("en-US")}
          hint={ctr === null ? "No boosts served yet" : `${ctr.toFixed(1)}% tap rate`}
        />
      </div>

      <Card className={liveBoosts > 0 ? "ring-1 ring-pine-500/40" : undefined}>
        {liveBoosts > 0 ? (
          <p className="text-sm">
            <span className="font-semibold text-pine-700">
              {pluralize(liveBoosts, "boost")} running right now
            </span>
            {poolFundedBoosts > 0 && (
              <>
                {" — "}
                {pluralize(poolFundedBoosts, "of them is", "of them are")} paid
                for by the Ad-Boost Pool, not by you.
              </>
            )}
          </p>
        ) : (
          <p className="text-sm text-ink-soft">
            No boosts running. Verified businesses rated 4.5★ and up get free
            placement from the Ad-Boost Pool.
          </p>
        )}
      </Card>
    </div>
  );
}

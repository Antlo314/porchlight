import Link from "next/link";
import { StormDesk } from "@/components/storm/StormDesk";
import { Card, EmptyState } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { STORM_RESOURCES, STORM_STATUS } from "@/lib/storm";
import { stormCheckInAction } from "./actions";

export const metadata = { title: "Storm Mode" };

export default async function StormPage() {
  const user = await requireUser();
  const neighborhood = user.neighborhood;

  if (!neighborhood.stormActive) {
    return (
      <EmptyState
        icon="🏮"
        title="The block is quiet"
        body={`${neighborhood.name} is not in Storm Mode. When a storm hits, a mod turns it on and this page becomes the roster.`}
        actionLabel="Back to the feed"
        actionHref="/feed"
      />
    );
  }

  const roster = await db.stormCheckIn.findMany({
    where: { neighborhoodId: user.neighborhoodId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: [{ status: "desc" }, { updatedAt: "desc" }],
  });

  const mine = roster.find((r) => r.userId === user.id) ?? null;
  const safe = roster.filter((r) => r.status === "SAFE");
  const need = roster.filter((r) => r.status === "NEED_HELP");
  const resources = roster.filter((r) => r.resource);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-porch-700">
          Storm Mode · {neighborhood.name}
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold leading-tight">
          Who is safe. Who needs you. What we have.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          The feed can wait. Check in, then look at the roster.
        </p>
      </div>

      <Card>
        <StormDesk
          mine={
            mine
              ? {
                  status: mine.status,
                  resource: mine.resource,
                  note: mine.note,
                }
              : null
          }
          checkIn={stormCheckInAction}
        />
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Card className="bg-pine-50">
          <p className="text-2xl font-semibold tabular-nums">{safe.length}</p>
          <p className="text-sm text-ink-soft">checked in safe</p>
        </Card>
        <Card className="bg-porch-50">
          <p className="text-2xl font-semibold tabular-nums">{need.length}</p>
          <p className="text-sm text-ink-soft">need help</p>
        </Card>
      </div>

      {need.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display text-lg font-semibold">Need help</h2>
          <ul className="space-y-2">
            {need.map((row) => (
              <li key={row.id}>
                <Card className="border-porch-200">
                  <p className="font-semibold">{row.user.name}</p>
                  <p className="text-sm text-ink-soft">
                    {STORM_STATUS.NEED_HELP.label}
                    {row.note ? ` · ${row.note}` : ""}
                  </p>
                  <Link
                    href={`/messages/new?to=${row.user.id}`}
                    className="mt-2 inline-flex min-h-10 items-center text-sm font-semibold text-porch-800"
                  >
                    Message →
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      {resources.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display text-lg font-semibold">On the block</h2>
          <ul className="space-y-2">
            {resources.map((row) => {
              const meta = row.resource
                ? STORM_RESOURCES[row.resource as keyof typeof STORM_RESOURCES]
                : null;
              return (
                <li key={row.id}>
                  <Card>
                    <p className="font-semibold">
                      {meta ? `${meta.icon} ${meta.label}` : "Help"}
                    </p>
                    <p className="text-sm text-ink-soft">
                      {row.user.name}
                      {row.note ? ` · ${row.note}` : ""}
                    </p>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {safe.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display text-lg font-semibold">Safe</h2>
          <ul className="divide-y divide-line rounded-card border border-line bg-card">
            {safe.map((row) => (
              <li key={row.id} className="px-4 py-2.5 text-sm">
                <span className="font-semibold">{row.user.name}</span>
                {row.note ? (
                  <span className="text-ink-soft"> · {row.note}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

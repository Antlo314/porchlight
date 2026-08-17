import Link from "next/link";
import { VerifySwitch } from "@/components/hub/VerifySwitch";
import { StormToggle } from "@/components/storm/StormToggle";
import { Card } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { setStormModeAction } from "../../storm/actions";
import { setVerifiedAction } from "../actions";

export const metadata = { title: "Block Hub" };

export default async function BlockHubPage() {
  const user = await requireStaff();

  const [openReports, neighbors] = await Promise.all([
    db.report.count({ where: { status: "OPEN" } }),
    db.user.findMany({
      where: { neighborhoodId: user.neighborhoodId },
      orderBy: [{ verifiedAt: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        role: true,
        verifiedAt: true,
        email: true,
      },
    }),
  ]);

  const unverified = neighbors.filter((n) => !n.verifiedAt);
  const verified = neighbors.filter((n) => n.verifiedAt);

  return (
    <div className="space-y-4">
      <header>
        <Link href="/hub" className="text-sm font-semibold text-ink-soft">
          ← Hubs
        </Link>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-pine-700">
          Block Hub · {user.neighborhood.name}
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold leading-tight">
          Maintain the page
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Reports, Storm Mode, and who is actually on this block. The Steward
          named you for this desk.
        </p>
      </header>

      <Link href="/moderation" className="block">
        <Card className="border-pine-200 bg-pine-50/70 transition-transform duration-150 active:scale-[0.99]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-pine-700">
            Reports
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold">
            {openReports === 0
              ? "Queue is clear"
              : `${openReports} open ${openReports === 1 ? "report" : "reports"}`}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Resolve or dismiss. The neighborhood sees a clean porch, not a
            pile.
          </p>
          <p className="mt-3 text-sm font-semibold text-pine-800">
            Open the queue →
          </p>
        </Card>
      </Link>

      <Card className="border-pine-200 bg-pine-50/50">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-pine-700">
          Storm Mode
        </p>
        <h2 className="mt-1 font-display text-lg font-semibold">
          {user.neighborhood.stormActive
            ? "The roster is live"
            : "Quiet unless the weather is not"}
        </h2>
        <div className="mt-2">
          <StormToggle
            active={user.neighborhood.stormActive}
            setStorm={setStormModeAction}
          />
        </div>
        {user.neighborhood.stormActive && (
          <Link
            href="/storm"
            className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-pine-800"
          >
            Open the roster →
          </Link>
        )}
      </Card>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold">
          Need a check ({unverified.length})
        </h2>
        {unverified.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-soft">
              Everyone on this block is address-verified.
            </p>
          </Card>
        ) : (
          <ul className="space-y-2">
            {unverified.map((person) => (
              <li key={person.id}>
                <Card className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{person.name}</p>
                    <p className="truncate text-sm text-ink-soft">
                      {person.role === "MODERATOR" ? "Moderator · " : ""}
                      not verified
                    </p>
                  </div>
                  <VerifySwitch
                    userId={person.id}
                    verified={false}
                    setVerified={setVerifiedAction}
                  />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold">
          Verified ({verified.length})
        </h2>
        <ul className="space-y-2">
          {verified.map((person) => (
            <li key={person.id}>
              <Card className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{person.name}</p>
                  <p className="truncate text-sm text-ink-soft">On the block</p>
                </div>
                <VerifySwitch
                  userId={person.id}
                  verified
                  setVerified={setVerifiedAction}
                />
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

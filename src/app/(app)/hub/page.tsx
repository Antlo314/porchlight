import Link from "next/link";
import { Card } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { isOwner, staffLabel } from "@/lib/staff";
import { db } from "@/lib/db";

export const metadata = { title: "Hubs" };

export default async function HubsPage() {
  const user = await requireStaff();
  const owner = isOwner(user);

  const [openReports, mods] = await Promise.all([
    db.report.count({ where: { status: "OPEN" } }),
    db.user.count({
      where: { role: { in: ["MODERATOR", "ADMIN"] } },
    }),
  ]);

  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-porch-700">
          {staffLabel(user)}
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold leading-tight">
          Two hubs. One block.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          The Steward names who keeps the porch. The Block Hub is the desk
          those mods sit at — reports, Storm Mode, and verifying neighbors.
        </p>
      </header>

      {owner && (
        <Link href="/hub/steward" className="block">
          <Card className="border-porch-200 bg-porch-50 transition-transform duration-150 active:scale-[0.99]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-porch-700">
              Steward Hub
            </p>
            <h2 className="mt-1 font-display text-xl font-semibold">
              Appoint the mods
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              Pick from people already on Porchlight. They get the Block Hub
              the moment you make them a mod. {mods} staff{" "}
              {mods === 1 ? "seat" : "seats"} right now.
            </p>
            <p className="mt-3 text-sm font-semibold text-porch-800">
              Open Steward Hub →
            </p>
          </Card>
        </Link>
      )}

      <Link href="/hub/block" className="block">
        <Card className="border-pine-200 bg-pine-50/70 transition-transform duration-150 active:scale-[0.99]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-pine-700">
            Block Hub
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold">
            Maintain the page
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            Reports, Storm Mode, and residency checks for{" "}
            {user.neighborhood.name}.{" "}
            {openReports === 0
              ? "Queue is clear."
              : `${openReports} open ${openReports === 1 ? "report" : "reports"}.`}
          </p>
          <p className="mt-3 text-sm font-semibold text-pine-800">
            Open Block Hub →
          </p>
        </Card>
      </Link>
    </div>
  );
}

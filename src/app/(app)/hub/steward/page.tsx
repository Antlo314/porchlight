import Link from "next/link";
import { RoleSwitch } from "@/components/hub/RoleSwitch";
import { Card, Input } from "@/components/ui";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { isOwnerEmail, staffLabel } from "@/lib/staff";
import { setModeratorAction } from "../actions";

export const metadata = { title: "Steward Hub" };

export default async function StewardHubPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  await requireOwner();
  const raw = await searchParams;
  const q = (Array.isArray(raw.q) ? raw.q[0] : raw.q)?.trim() ?? "";

  const people = await db.user.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: [{ role: "asc" }, { name: "asc" }],
    take: 80,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      verifiedAt: true,
      neighborhood: { select: { name: true, city: true } },
    },
  });

  const mods = people.filter(
    (p) =>
      !isOwnerEmail(p.email) &&
      (p.role === "MODERATOR" || p.role === "ADMIN"),
  );
  const neighbors = people.filter(
    (p) => !isOwnerEmail(p.email) && p.role === "MEMBER",
  );

  return (
    <div className="space-y-4">
      <header>
        <Link
          href="/hub"
          className="text-sm font-semibold text-ink-soft"
        >
          ← Hubs
        </Link>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-porch-700">
          Steward Hub
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold leading-tight">
          Name who keeps the porch
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Only current members. Make them a mod and the Block Hub opens for
          them — reports, Storm Mode, verify. You stay the only Steward.
        </p>
      </header>

      <form className="flex gap-2">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search a name or email"
          aria-label="Search neighbors"
        />
        <button
          type="submit"
          className="min-h-11 shrink-0 rounded-card bg-porch-600 px-4 text-sm font-semibold text-white"
        >
          Search
        </button>
      </form>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold">
          Mods ({mods.length})
        </h2>
        {mods.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-soft">
              No lesser mods yet. Promote someone from the list below.
            </p>
          </Card>
        ) : (
          <ul className="space-y-2">
            {mods.map((person) => (
              <li key={person.id}>
                <Card className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{person.name}</p>
                    <p className="truncate text-sm text-ink-soft">
                      {staffLabel(person)} · {person.neighborhood.name}
                    </p>
                  </div>
                  <RoleSwitch
                    userId={person.id}
                    role="MODERATOR"
                    setRole={setModeratorAction}
                  />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold">
          Neighbors ({neighbors.length})
        </h2>
        {neighbors.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-soft">
              {q
                ? "No neighbors match that search."
                : "Nobody else on the ledger yet."}
            </p>
          </Card>
        ) : (
          <ul className="space-y-2">
            {neighbors.map((person) => (
              <li key={person.id}>
                <Card className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{person.name}</p>
                    <p className="truncate text-sm text-ink-soft">
                      {person.neighborhood.name}, {person.neighborhood.city}
                    </p>
                  </div>
                  <RoleSwitch
                    userId={person.id}
                    role="MEMBER"
                    setRole={setModeratorAction}
                  />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

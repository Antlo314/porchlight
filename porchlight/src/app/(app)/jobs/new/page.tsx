import { BackLink } from "@/components/job/BackLink";
import { NewJobForm } from "@/components/job/NewJobForm";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = { title: "Post a job" };

export default async function NewJobPage() {
  const user = await requireUser();

  // One grouped query gives the composer a live "who will hear about this"
  // count for every category, instead of a lookup per keystroke.
  const counts = await db.business.groupBy({
    by: ["category"],
    where: { neighborhoodId: user.neighborhoodId },
    _count: { _all: true },
  });

  const proCounts: Record<string, number> = {};
  for (const row of counts) proCounts[row.category] = row._count._all;

  return (
    <div className="space-y-4">
      <BackLink />

      <header>
        <h1 className="text-2xl font-bold">Post a job</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Describe what you need done in {user.neighborhood.name}. Matching local
          pros get a notification and reply here — free, on every plan, so the
          ones who answer are the ones who want the work.
        </p>
      </header>

      <NewJobForm
        neighborhoodName={user.neighborhood.name}
        proCounts={proCounts}
      />
    </div>
  );
}

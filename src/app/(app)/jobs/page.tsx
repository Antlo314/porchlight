import Link from "next/link";
import { Fab } from "@/components/ui";
import { JobBoard } from "@/components/job/JobBoard";
import type { JobCardData } from "@/components/job/JobCard";
import { jobCategoryMeta } from "@/components/job/meta";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { pluralize } from "@/lib/format";
import { visibleNeighborhoodIds } from "@/lib/visibility";

export const metadata = { title: "Job board" };

const PAGE_SIZE = 60;

export default async function JobsPage() {
  const user = await requireUser();
  const neighborhoodIds = await visibleNeighborhoodIds(user);

  const [rows, myBusinesses] = await Promise.all([
    db.jobRequest.findMany({
      where: { neighborhoodId: { in: neighborhoodIds }, status: "OPEN" },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      include: {
        requester: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { replies: true } },
      },
    }),
    db.business.findMany({
      where: { ownerId: user.id },
      select: { id: true, name: true, category: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const jobs: JobCardData[] = rows.map((job) => ({
    id: job.id,
    title: job.title,
    description: job.description,
    category: job.category,
    budgetInfo: job.budgetInfo,
    images: job.images,
    status: job.status,
    createdAt: job.createdAt,
    requester: job.requester,
    replyCount: job._count.replies,
  }));

  // One business per owner today, but the list query keeps that assumption out
  // of the type: an owner with none simply gets the "list your business" card.
  const myBusiness: { id: string; name: string; category: string } | undefined =
    myBusinesses[0];
  const matchingForMe = myBusiness
    ? jobs.filter((job) => job.category === myBusiness.category).length
    : 0;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Job board</h1>
        <p className="text-sm text-ink-soft">
          Neighbors post what they need. Local pros answer.
        </p>
      </header>

      {/* The fairness story, stated as what we do. A subscription buys standing
          presence in the directory; answering a neighbor is never billed. */}
      <div className="rounded-card border border-porch-200 bg-porch-50 p-4">
        <p className="text-sm font-semibold text-porch-800">
          Pros reply free — on every plan
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          A Porchlight subscription pays for a business&apos;s standing presence
          in the directory. It never pays for the right to answer a neighbor who
          asked for help.
        </p>
      </div>

      {myBusiness ? (
        <Link
          href="/business/manage"
          className="flex min-h-14 items-center justify-between gap-3 rounded-card border border-line bg-card px-4 transition-transform duration-100 active:scale-[0.99] active:bg-porch-50/50"
        >
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold">
              <span aria-hidden>{jobCategoryMeta(myBusiness.category).icon}</span>{" "}
              {myBusiness.name}
            </span>
            <span className="block text-sm text-ink-soft">
              {matchingForMe > 0
                ? `${pluralize(matchingForMe, "open job")} in your category right now`
                : `New ${jobCategoryMeta(myBusiness.category).label.toLowerCase()} jobs land in your notifications`}
            </span>
          </span>
          <span aria-hidden className="shrink-0 text-ink-soft">
            →
          </span>
        </Link>
      ) : (
        <Link
          href="/business/new"
          className="block rounded-card border border-dashed border-porch-300 bg-card p-4 transition-transform duration-100 active:scale-[0.99]"
        >
          <p className="text-sm font-semibold text-porch-800">
            Do this kind of work?
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            List your business free and every matching job in{" "}
            {user.neighborhood.name} arrives in your notifications.
          </p>
        </Link>
      )}

      <JobBoard jobs={jobs} />

      <Fab href="/jobs/new" label="Post a job" />
    </div>
  );
}

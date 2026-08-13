import { Avatar, Badge, CardLink } from "@/components/ui";
import { pluralize, timeAgo } from "@/lib/format";
import { parseImages } from "@/lib/json";
import { JobStatusBadge } from "./JobStatusBadge";
import { jobCategoryMeta } from "./meta";

/** Exactly what a job row needs — keeps the board's query honest. */
export type JobCardData = {
  id: string;
  title: string;
  description: string;
  category: string;
  budgetInfo: string | null;
  /** Raw JSON column; parsed with parseImages. */
  images: string;
  status: string;
  createdAt: Date | string;
  requester: { id: string; name: string; avatarUrl: string | null };
  replyCount: number;
};

export function JobCard({ job }: { job: JobCardData }) {
  const meta = jobCategoryMeta(job.category);
  const cover = parseImages(job.images)[0];

  return (
    <CardLink href={`/jobs/${job.id}`} padded={false}>
      <div className="flex gap-3 p-4">
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element -- job photos are
          // arbitrary user-supplied URLs; next/image needs an allowlist.
          <img
            src={cover}
            alt=""
            className="h-20 w-20 shrink-0 rounded-xl border border-line object-cover"
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[15px] font-semibold leading-snug">
              {job.title}
            </h3>
            {job.budgetInfo && (
              <Badge className="bg-porch-100 text-porch-800">
                {job.budgetInfo}
              </Badge>
            )}
          </div>

          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-soft">
            <span className="font-semibold">
              <span aria-hidden>{meta.icon}</span> {meta.label}
            </span>
            <span aria-hidden>·</span>
            <span>{timeAgo(job.createdAt)}</span>
            <span aria-hidden>·</span>
            <span
              className={
                job.replyCount > 0 ? "font-semibold text-pine-600" : undefined
              }
            >
              {job.replyCount > 0
                ? pluralize(job.replyCount, "reply", "replies")
                : "No replies yet"}
            </span>
          </p>

          <p className="mt-1.5 line-clamp-2 text-sm text-ink-soft">
            {job.description}
          </p>

          <div className="mt-2.5 flex items-center gap-2">
            <Avatar
              name={job.requester.name}
              src={job.requester.avatarUrl}
              size="sm"
            />
            <span className="truncate text-sm text-ink-soft">
              {job.requester.name}
            </span>
            {job.status !== "OPEN" && (
              <span className="ml-auto">
                <JobStatusBadge status={job.status} />
              </span>
            )}
          </div>
        </div>
      </div>
    </CardLink>
  );
}

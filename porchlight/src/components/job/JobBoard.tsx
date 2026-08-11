"use client";

import { useMemo, useState } from "react";
import { Button, ChipRow, EmptyState } from "@/components/ui";
import { pluralize } from "@/lib/format";
import type { BusinessCategoryValue } from "@/lib/validators";
import { JobCard, type JobCardData } from "./JobCard";
import { JOB_CATEGORY_OPTIONS, jobCategoryMeta } from "./meta";

export function JobBoard({ jobs }: { jobs: JobCardData[] }) {
  const [category, setCategory] = useState<BusinessCategoryValue | null>(null);

  // Only offer categories that actually have a job in them, so no tap ever
  // leads to an empty shelf.
  const options = useMemo(() => {
    const present = new Set(jobs.map((job) => job.category));
    return JOB_CATEGORY_OPTIONS.filter((option) =>
      present.has(option.value)
    ).map((option) => ({
      value: option.value,
      label: `${option.icon} ${option.label}`,
    }));
  }, [jobs]);

  const filtered = useMemo(
    () =>
      category === null ? jobs : jobs.filter((job) => job.category === category),
    [jobs, category]
  );

  if (jobs.length === 0) {
    return (
      <EmptyState
        icon="🧰"
        title="Nothing on the board yet"
        body="Post what you need done — a fence panel, a haircut, a tutor — and local pros come to you."
        actionLabel="Post the first job"
        actionHref="/jobs/new"
      />
    );
  }

  return (
    <div className="space-y-3">
      {options.length > 1 && (
        <ChipRow options={options} value={category} onChange={setCategory} />
      )}

      <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
        {pluralize(filtered.length, "open job")}
        {category !== null && ` · ${jobCategoryMeta(category).label}`}
      </p>

      {filtered.length === 0 ? (
        <div>
          <EmptyState
            icon="🔍"
            title="Nothing in that category"
            body="No open jobs match that filter right now. Try another one, or post the job yourself."
          />
          <div className="px-6">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => setCategory(null)}
            >
              Clear filter
            </Button>
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((job) => (
            <li key={job.id}>
              <JobCard job={job} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { Avatar, Badge, Button, ButtonLink, Card } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import {
  REPORT_STATUS_META,
  TARGET_TYPE_META,
  type ReportRowData,
  type ReportStatus,
} from "./reportMeta";

/** One row in the moderation queue: the report, the reported thing, the calls. */
export function ReportCard({
  report,
  status,
  busy,
  onDecide,
}: {
  report: ReportRowData;
  /** Effective status — may be an optimistic value, not the one on the row. */
  status: ReportStatus;
  busy: boolean;
  onDecide: (decision: Exclude<ReportStatus, "OPEN">) => void;
}) {
  const type = TARGET_TYPE_META[report.targetType];
  const statusMeta = REPORT_STATUS_META[status];

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge>
            <span aria-hidden>{type.icon}</span> {type.noun}
          </Badge>
          {status !== "OPEN" && (
            <Badge className={statusMeta.badgeClass}>{statusMeta.label}</Badge>
          )}
        </div>
        <span className="shrink-0 pt-0.5 text-xs text-ink-soft">
          {timeAgo(report.createdAt)}
        </span>
      </div>

      <div>
        <p className="text-[15px] font-bold">
          <span aria-hidden>🚩</span> {report.reasonLabel}
        </p>
        {report.detail && (
          <p className="mt-1.5 whitespace-pre-line break-words rounded-xl bg-cream px-3 py-2 text-sm text-ink-soft">
            “{report.detail}”
          </p>
        )}
      </div>

      <div className="rounded-xl border border-line bg-cream p-3">
        {report.target.found ? (
          <>
            {report.target.authorName && (
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                {report.target.authorName}
              </p>
            )}
            {report.target.heading && (
              <p className="mt-0.5 break-words text-sm font-bold">
                {report.target.heading}
              </p>
            )}
            <p className="mt-0.5 whitespace-pre-line break-words text-sm text-ink-soft">
              {report.target.preview}
            </p>
            {report.target.href && (
              <ButtonLink
                href={report.target.href}
                variant="secondary"
                size="sm"
                className="mt-2"
              >
                Open in context
              </ButtonLink>
            )}
          </>
        ) : (
          // Content can be deleted between the report and the review; the report
          // still needs closing out, so the row stays actionable.
          <p className="text-sm text-ink-soft">
            <span aria-hidden>🗑️</span> {report.target.preview}
          </p>
        )}
      </div>

      <Link
        href={`/profile/${report.reporterId}`}
        className="flex min-h-11 items-center gap-2"
      >
        <Avatar
          name={report.reporterName}
          src={report.reporterAvatarUrl}
          size="sm"
        />
        <span className="truncate text-xs text-ink-soft">
          Reported by{" "}
          <span className="font-semibold text-ink">{report.reporterName}</span>
        </span>
      </Link>

      {status === "OPEN" && (
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            disabled={busy}
            onClick={() => onDecide("DISMISSED")}
          >
            Dismiss
          </Button>
          <Button
            className="flex-1"
            disabled={busy}
            onClick={() => onDecide("RESOLVED")}
          >
            Resolve
          </Button>
        </div>
      )}
    </Card>
  );
}

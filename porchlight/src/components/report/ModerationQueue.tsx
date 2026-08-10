"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import {
  EmptyState,
  SectionHeading,
  SegmentedControl,
  useToast,
} from "@/components/ui";
import { pluralize } from "@/lib/format";
import { ReportCard } from "./ReportCard";
import {
  REPORT_STATUSES,
  REPORT_STATUS_META,
  TARGET_TYPES,
  TARGET_TYPE_META,
  type ReportDecisionInput,
  type ReportDecisionResult,
  type ReportRowData,
  type ReportStatus,
  type ReportTargetType,
} from "./reportMeta";

const EMPTY_COPY: Record<ReportStatus, { icon: string; title: string; body: string }> = {
  OPEN: {
    icon: "🌿",
    title: "Queue's clear",
    body: "No open reports right now. Neighbors are behaving — enjoy it while it lasts.",
  },
  RESOLVED: {
    icon: "✅",
    title: "Nothing resolved yet",
    body: "Reports you act on land here, so there's a record of what was done.",
  },
  DISMISSED: {
    icon: "🫙",
    title: "Nothing dismissed yet",
    body: "Reports you decide need no action end up here.",
  },
};

export function ModerationQueue({
  reports,
  initialTab,
  decide,
}: {
  reports: ReportRowData[];
  initialTab: ReportStatus;
  decide: (input: ReportDecisionInput) => Promise<ReportDecisionResult>;
}) {
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [tab, setTab] = useState<ReportStatus>(initialTab);
  /** Optimistic statuses, keyed by report id, applied over the server rows. */
  const [overrides, setOverrides] = useState<Record<string, ReportStatus>>({});
  const [busyIds, setBusyIds] = useState<string[]>([]);

  const statusOf = useCallback(
    (report: ReportRowData): ReportStatus =>
      overrides[report.id] ?? report.status,
    [overrides]
  );

  const counts = useMemo(() => {
    const tally: Record<ReportStatus, number> = {
      OPEN: 0,
      RESOLVED: 0,
      DISMISSED: 0,
    };
    for (const report of reports) tally[statusOf(report)] += 1;
    return tally;
  }, [reports, statusOf]);

  // Grouped by what was reported, in a stable order, newest first inside each
  // group — a moderator working the queue tends to batch by content type.
  const groups = useMemo(() => {
    const visible = reports
      .filter((report) => statusOf(report) === tab)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const byType = new Map<ReportTargetType, ReportRowData[]>();
    for (const report of visible) {
      const bucket = byType.get(report.targetType);
      if (bucket) bucket.push(report);
      else byType.set(report.targetType, [report]);
    }

    return TARGET_TYPES.filter((type) => byType.has(type)).map((type) => ({
      type,
      rows: byType.get(type) ?? [],
    }));
  }, [reports, statusOf, tab]);

  function onDecide(id: string, decision: Exclude<ReportStatus, "OPEN">) {
    setOverrides((prev) => ({ ...prev, [id]: decision }));
    setBusyIds((prev) => [...prev, id]);

    startTransition(async () => {
      const result = await decide({ reportId: id, decision });
      setBusyIds((prev) => prev.filter((busy) => busy !== id));

      if (!result.ok) {
        setOverrides((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        toast(result.error, "error");
        return;
      }

      toast(
        decision === "RESOLVED"
          ? "Resolved. Thanks for keeping the porch light on."
          : "Dismissed — no action taken."
      );
    });
  }

  const visibleCount = groups.reduce((sum, group) => sum + group.rows.length, 0);
  const empty = EMPTY_COPY[tab];

  return (
    <div className="space-y-4">
      <SegmentedControl<ReportStatus>
        value={tab}
        onChange={setTab}
        options={REPORT_STATUSES.map((status) => ({
          value: status,
          label:
            counts[status] > 0
              ? `${REPORT_STATUS_META[status].label} ${counts[status]}`
              : REPORT_STATUS_META[status].label,
        }))}
      />

      {visibleCount === 0 ? (
        <EmptyState icon={empty.icon} title={empty.title} body={empty.body} />
      ) : (
        <div>
          {groups.map((group) => (
            <section key={group.type}>
              <SectionHeading
                title={`${TARGET_TYPE_META[group.type].icon} ${TARGET_TYPE_META[group.type].plural}`}
                action={
                  <span className="text-xs text-ink-soft">
                    {pluralize(group.rows.length, "report")}
                  </span>
                }
              />
              <ul className="space-y-3">
                {group.rows.map((report) => (
                  <li key={report.id}>
                    <ReportCard
                      report={report}
                      status={statusOf(report)}
                      busy={busyIds.includes(report.id)}
                      onDecide={(decision) => onDecide(report.id, decision)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

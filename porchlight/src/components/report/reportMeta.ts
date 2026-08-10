// Shared vocabulary for the trust-and-safety vertical: report reasons, how each
// target type is labelled, and how a Report row's free-text `reason` column is
// packed and unpacked.
//
// Deliberately dependency-light (types + pure functions, no db/auth imports)
// because both the client <ReportSheet> and the server moderation queue import
// it. The unions are derived from the Zod schemas in @/lib/validators so they
// can never drift from the values the database accepts.
import {
  REPORT_REASON_LABELS,
  ReportReason,
  createReportSchema,
} from "@/lib/validators";

export const TARGET_TYPES = createReportSchema.shape.targetType.options;
export type ReportTargetType = (typeof TARGET_TYPES)[number];

export const REPORT_REASONS = ReportReason.options;
export type ReportReasonValue = (typeof REPORT_REASONS)[number];

// prisma/schema.prisma: Report.status is "OPEN | RESOLVED | DISMISSED".
export const REPORT_STATUSES = ["OPEN", "RESOLVED", "DISMISSED"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const TARGET_TYPE_META: Record<
  ReportTargetType,
  { noun: string; plural: string; icon: string }
> = {
  POST: { noun: "post", plural: "Posts", icon: "📝" },
  COMMENT: { noun: "comment", plural: "Comments", icon: "💬" },
  MESSAGE: { noun: "message", plural: "Messages", icon: "✉️" },
  LISTING: { noun: "listing", plural: "Barter listings", icon: "🔁" },
  BUSINESS: { noun: "business", plural: "Businesses", icon: "🏪" },
  USER: { noun: "neighbor", plural: "Neighbors", icon: "👤" },
};

export const REPORT_STATUS_META: Record<
  ReportStatus,
  { label: string; badgeClass: string }
> = {
  OPEN: { label: "Open", badgeClass: "bg-amber-100 text-amber-800" },
  RESOLVED: {
    label: "Resolved",
    badgeClass: "bg-emerald-100 text-emerald-800",
  },
  DISMISSED: { label: "Dismissed", badgeClass: "bg-line text-ink-soft" },
};

/**
 * The Report table has a single `reason` String column but the report form also
 * collects an optional free-text detail (createReportSchema.detail). Rather than
 * drop what the neighbor typed — it's usually the only context a moderator gets
 * — the detail is stored on the lines after the reason code. The code is always
 * the first line, so filtering/grouping by reason stays a prefix match.
 */
const DETAIL_SEPARATOR = "\n";

export function encodeReason(
  reason: ReportReasonValue,
  detail?: string | null
): string {
  const trimmed = detail?.trim();
  return trimmed ? `${reason}${DETAIL_SEPARATOR}${trimmed}` : reason;
}

export function decodeReason(raw: string): {
  reason: ReportReasonValue | null;
  label: string;
  detail: string | null;
} {
  const separatorAt = raw.indexOf(DETAIL_SEPARATOR);
  const head = (separatorAt === -1 ? raw : raw.slice(0, separatorAt)).trim();
  const tail = separatorAt === -1 ? "" : raw.slice(separatorAt + 1).trim();
  const reason = isReportReason(head) ? head : null;

  return {
    reason,
    // Reasons written before a vocabulary change still render as *something*.
    label: reason ? REPORT_REASON_LABELS[reason] : head || "Reported",
    detail: tail || null,
  };
}

export function isReportReason(value: string): value is ReportReasonValue {
  return (REPORT_REASONS as readonly string[]).includes(value);
}

export function toTargetType(value: string | null | undefined) {
  return value && (TARGET_TYPES as readonly string[]).includes(value)
    ? (value as ReportTargetType)
    : null;
}

export function toReportStatus(value: string | null | undefined) {
  return value && (REPORT_STATUSES as readonly string[]).includes(value)
    ? (value as ReportStatus)
    : null;
}

// ─────────────────────────────────────────────────────────────
// Shapes passed from the moderation server component to its client UI.
// (They live here rather than in a "use server" file, which may only export
// async functions.)
// ─────────────────────────────────────────────────────────────

export type ReportTargetPreview = {
  /** False when the reported row has since been deleted. */
  found: boolean;
  /** Post title / business name / neighbor name, when the target has one. */
  heading: string | null;
  /** Excerpt of the reported content, or an explanation of its absence. */
  preview: string;
  /** Where a moderator can go read it in context. */
  href: string | null;
  /** Who wrote/owns the reported thing. */
  authorName: string | null;
};

export type ReportRowData = {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  status: ReportStatus;
  reasonLabel: string;
  detail: string | null;
  /** ISO string — Dates don't survive the server/client boundary cleanly. */
  createdAt: string;
  reporterId: string;
  reporterName: string;
  reporterAvatarUrl: string | null;
  target: ReportTargetPreview;
};

export type SubmitReportResult =
  | { ok: true; duplicate: boolean }
  | { ok: false; error: string };

export type ReportDecisionInput = {
  reportId: string;
  decision: Exclude<ReportStatus, "OPEN">;
};

export type ReportDecisionResult = { ok: true } | { ok: false; error: string };

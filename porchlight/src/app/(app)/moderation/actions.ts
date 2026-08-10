"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import type {
  ReportDecisionInput,
  ReportDecisionResult,
} from "@/components/report/reportMeta";

// There is no moderation-decision schema in @/lib/validators (that module is
// shared and frozen), so the queue's own contract is declared here. The allowed
// values match the Report.status comment in prisma/schema.prisma.
const reportDecisionSchema = z.object({
  reportId: z.string().min(1),
  decision: z.enum(["RESOLVED", "DISMISSED"]),
});

export async function decideReportAction(
  input: ReportDecisionInput
): Promise<ReportDecisionResult> {
  // Role check first: the report id alone tells you nothing about who may act
  // on it, so authorization is entirely "is this person a moderator".
  await requireRole("MODERATOR");

  const parsed = reportDecisionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "That isn't a valid moderation action." };
  }
  const { reportId, decision } = parsed.data;

  const report = await db.report.findUnique({
    where: { id: reportId },
    select: { id: true, status: true },
  });
  if (!report) return { ok: false, error: "That report is no longer here." };

  // Two moderators can be in the queue at once; whoever gets there second
  // shouldn't silently overwrite the first decision.
  if (report.status !== "OPEN") {
    const already = report.status === "RESOLVED" ? "resolved" : "dismissed";
    return {
      ok: false,
      error: `Another moderator already ${already} that report.`,
    };
  }

  await db.report.update({
    where: { id: report.id },
    data: { status: decision },
  });

  revalidatePath("/moderation");
  return { ok: true };
}

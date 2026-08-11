"use server";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeImages } from "@/lib/json";
import { notify, notifyMany } from "@/lib/notify";
import { visibleNeighborhoodIds } from "@/lib/visibility";
import {
  BUSINESS_CATEGORY_META,
  createJobReplySchema,
  createJobRequestSchema,
  jobStatusSchema,
} from "@/lib/validators";

/**
 * Fan-out ceiling for a single job. Notifying every matching pro is the entire
 * value of a paid listing, but an unbounded loop over a dense neighborhood
 * would turn one form submit into hundreds of writes. Matching pros are ordered
 * verified-first so the cap, when it bites, keeps the most useful recipients.
 */
const MAX_JOB_NOTIFICATIONS = 25;

export type JobActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export type CreateJobResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export type CreateJobInput = {
  title: string;
  description: string;
  category: string;
  budgetInfo?: string;
  /** Already-uploaded URLs from <ImageUploader>. */
  images?: string[];
};

export type CreateJobReplyInput = {
  jobId: string;
  message: string;
  quoteInfo?: string;
  /** Which of the caller's own businesses is answering. Always re-verified. */
  businessId?: string;
};

/**
 * Flattens a Zod error into `{ field: firstMessage }` so the composer can put
 * each message next to the input it belongs to.
 */
function toFieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in out)) out[key] = issue.message;
  }
  return out;
}

/** Empty optional inputs arrive as ""; the schemas want `undefined`. */
function blankToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Prisma's unique-constraint failure, without importing the error class. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function revalidateJob(jobId: string) {
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  // The services screen shows a live count of open jobs.
  revalidatePath("/services");
}

/**
 * Posts a job request and tells every matching pro in the neighborhood.
 *
 * The notification is the product: a business subscribes for standing presence
 * in the directory, and answering a neighbor who asked costs nothing on any
 * plan. So the fan-out is deliberately generous (every matching pro, free tier
 * included) and deliberately bounded.
 */
export async function createJobRequestAction(
  input: CreateJobInput
): Promise<CreateJobResult> {
  const user = await requireUser();

  const parsed = createJobRequestSchema.safeParse({
    title: input.title,
    description: input.description,
    category: input.category,
    budgetInfo: blankToUndefined(input.budgetInfo),
    images: input.images ?? [],
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const data = parsed.data;

  const job = await db.jobRequest.create({
    data: {
      requesterId: user.id,
      // Reads widen to followed neighborhoods, writes never do: a job belongs
      // to the author's own neighborhood, never a client-supplied one.
      neighborhoodId: user.neighborhoodId,
      title: data.title,
      description: data.description,
      category: data.category,
      budgetInfo: data.budgetInfo ? data.budgetInfo : null,
      images: serializeImages(data.images),
    },
    select: { id: true },
  });

  // One query finds every pro who could do this work — not one query per
  // business. Extra headroom above the cap covers owners with more than one
  // listing collapsing to a single recipient below.
  const matching = await db.business.findMany({
    where: { neighborhoodId: user.neighborhoodId, category: data.category },
    orderBy: [{ verifiedAt: "desc" }, { createdAt: "asc" }],
    take: MAX_JOB_NOTIFICATIONS * 2,
    select: { ownerId: true },
  });

  const recipients: string[] = [];
  const seen = new Set<string>([user.id]);
  for (const business of matching) {
    if (seen.has(business.ownerId)) continue;
    seen.add(business.ownerId);
    recipients.push(business.ownerId);
    if (recipients.length >= MAX_JOB_NOTIFICATIONS) break;
  }

  const categoryLabel = BUSINESS_CATEGORY_META[data.category].label;

  // One INSERT for the whole fan-out — a dense neighborhood would otherwise put
  // MAX_JOB_NOTIFICATIONS round trips on the critical path of this submit.
  await notifyMany({
    userIds: recipients,
    actorId: user.id,
    type: "JOB_REQUEST",
    payload: {
      href: `/jobs/${job.id}`,
      text: `${user.name} posted a ${categoryLabel} job in ${user.neighborhood.name}: "${data.title}"`,
      actorName: user.name,
    },
  });

  revalidatePath("/jobs");
  revalidatePath("/services");
  return { ok: true, id: job.id };
}

/**
 * A local pro answers a neighbor. Free on every plan, including FREE — there is
 * no subscription check anywhere in this function, and that is the point.
 */
export async function createJobReplyAction(
  input: CreateJobReplyInput
): Promise<JobActionResult> {
  const user = await requireUser();

  const parsed = createJobReplySchema.safeParse({
    jobId: input.jobId,
    message: input.message,
    quoteInfo: blankToUndefined(input.quoteInfo),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const { jobId, message, quoteInfo } = parsed.data;

  const job = await db.jobRequest.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      requesterId: true,
      title: true,
      status: true,
      neighborhoodId: true,
    },
  });
  if (!job) return { ok: false, error: "That job request is no longer here." };

  if (job.requesterId === user.id) {
    return { ok: false, error: "This is your own job request." };
  }
  if (job.status !== "OPEN") {
    return { ok: false, error: "This job isn't taking replies anymore." };
  }

  const visible = await visibleNeighborhoodIds(user);
  if (!visible.includes(job.neighborhoodId)) {
    return { ok: false, error: "That job is in another neighborhood." };
  }

  // Ownership is resolved from the session, never from the form: the query is
  // scoped to businesses this user owns in the job's own neighborhood, so a
  // forged businessId simply isn't in the result set.
  const owned = await db.business.findMany({
    where: { ownerId: user.id, neighborhoodId: job.neighborhoodId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (owned.length === 0) {
    return {
      ok: false,
      error: "List your business in this neighborhood first — listing is free.",
    };
  }

  const business = input.businessId
    ? owned.find((b) => b.id === input.businessId)
    : owned[0];
  if (!business) {
    return { ok: false, error: "You can only reply as a business you own." };
  }

  try {
    await db.jobReply.create({
      data: {
        jobId: job.id,
        businessId: business.id,
        message,
        quoteInfo: quoteInfo ? quoteInfo : null,
      },
    });
  } catch (error) {
    // @@unique([jobId, businessId]) — one reply per business per job. A double
    // tap or a stale form lands here; say so plainly instead of throwing a 500.
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        error: `${business.name} already replied to this job. Refresh to see it.`,
      };
    }
    throw error;
  }

  await notify({
    userId: job.requesterId,
    actorId: user.id,
    type: "JOB_REPLY",
    payload: {
      href: `/jobs/${job.id}`,
      text: `${business.name} replied to your job "${job.title}"`,
      actorName: business.name,
    },
  });

  revalidateJob(job.id);
  return { ok: true };
}

/**
 * Only the neighbor who posted the job may change its status. Closing or
 * fulfilling it also tells the pros who took the time to reply.
 */
export async function setJobStatusAction(input: {
  jobId: string;
  status: string;
}): Promise<JobActionResult> {
  const user = await requireUser();

  const parsed = jobStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That isn't a valid status." };
  const { jobId, status } = parsed.data;

  const job = await db.jobRequest.findUnique({
    where: { id: jobId },
    select: { id: true, requesterId: true, title: true, status: true },
  });
  if (!job) return { ok: false, error: "That job request is no longer here." };

  if (job.requesterId !== user.id) {
    return {
      ok: false,
      error: "Only the neighbor who posted this job can change it.",
    };
  }
  if (job.status === status) return { ok: true };

  await db.jobRequest.update({ where: { id: job.id }, data: { status } });

  if (status !== "OPEN") {
    const replies = await db.jobReply.findMany({
      where: { jobId: job.id },
      take: MAX_JOB_NOTIFICATIONS,
      orderBy: { createdAt: "asc" },
      select: { business: { select: { ownerId: true } } },
    });

    const text =
      status === "FULFILLED"
        ? `${user.name} marked "${job.title}" as fulfilled. Thanks for answering.`
        : `${user.name} closed the job "${job.title}".`;

    // One owner can hold more than one business, so collapse to distinct people.
    const owners = new Set(replies.map((reply) => reply.business.ownerId));

    await notifyMany({
      userIds: Array.from(owners),
      actorId: user.id,
      type: "SYSTEM",
      payload: {
        href: `/jobs/${job.id}`,
        text,
        actorName: user.name,
      },
    });
  }

  revalidateJob(job.id);
  return { ok: true };
}

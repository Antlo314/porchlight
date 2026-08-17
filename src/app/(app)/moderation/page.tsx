import Link from "next/link";
import { ModerationQueue } from "@/components/report/ModerationQueue";
import {
  decodeReason,
  toReportStatus,
  toTargetType,
  TARGET_TYPE_META,
  type ReportRowData,
  type ReportStatus,
  type ReportTargetPreview,
  type ReportTargetType,
} from "@/components/report/reportMeta";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { truncate } from "@/lib/format";
import { decideReportAction } from "./actions";

export const metadata = { title: "Moderation" };

/** Per-status page size. The queue is a working surface, not an archive. */
const TAKE = 100;
const PREVIEW_CHARS = 220;

type TargetRef = { targetType: ReportTargetType; targetId: string };

const cacheKey = (type: ReportTargetType, id: string) => `${type}:${id}`;

function missing(type: ReportTargetType): ReportTargetPreview {
  return {
    found: false,
    heading: null,
    preview: `This ${TARGET_TYPE_META[type].noun} has since been deleted. You can still close the report out.`,
    href: null,
    authorName: null,
  };
}

/**
 * Resolves every reported row to a preview + a link, batched one query per
 * target type (never one per report). A target that has since been deleted
 * simply has no entry, and the caller falls back to `missing()`.
 */
async function resolveTargets(
  refs: TargetRef[]
): Promise<Map<string, ReportTargetPreview>> {
  const byType = new Map<ReportTargetType, Set<string>>();
  for (const ref of refs) {
    const bucket = byType.get(ref.targetType);
    if (bucket) bucket.add(ref.targetId);
    else byType.set(ref.targetType, new Set([ref.targetId]));
  }

  const ids = (type: ReportTargetType) => Array.from(byType.get(type) ?? []);
  const wanted = (type: ReportTargetType) => ids(type).length > 0;

  const [posts, comments, messages, listings, businesses, people] =
    await Promise.all([
      wanted("POST")
        ? db.post.findMany({
            where: { id: { in: ids("POST") } },
            select: {
              id: true,
              title: true,
              body: true,
              author: { select: { name: true } },
            },
          })
        : [],
      wanted("COMMENT")
        ? db.comment.findMany({
            where: { id: { in: ids("COMMENT") } },
            select: {
              id: true,
              postId: true,
              body: true,
              author: { select: { name: true } },
            },
          })
        : [],
      wanted("MESSAGE")
        ? db.message.findMany({
            where: { id: { in: ids("MESSAGE") } },
            select: {
              id: true,
              conversationId: true,
              body: true,
              imageUrl: true,
              sender: { select: { name: true } },
            },
          })
        : [],
      wanted("LISTING")
        ? db.barterListing.findMany({
            where: { id: { in: ids("LISTING") } },
            select: {
              id: true,
              title: true,
              description: true,
              owner: { select: { name: true } },
            },
          })
        : [],
      wanted("BUSINESS")
        ? db.business.findMany({
            where: { id: { in: ids("BUSINESS") } },
            select: {
              id: true,
              name: true,
              description: true,
              owner: { select: { name: true } },
            },
          })
        : [],
      wanted("USER")
        ? db.user.findMany({
            where: { id: { in: ids("USER") } },
            select: { id: true, name: true, bio: true, karma: true },
          })
        : [],
    ]);

  const out = new Map<string, ReportTargetPreview>();

  for (const post of posts) {
    out.set(cacheKey("POST", post.id), {
      found: true,
      heading: post.title,
      preview: truncate(post.body, PREVIEW_CHARS),
      href: `/feed/${post.id}`,
      authorName: post.author.name,
    });
  }

  for (const comment of comments) {
    out.set(cacheKey("COMMENT", comment.id), {
      found: true,
      heading: null,
      preview: truncate(comment.body, PREVIEW_CHARS),
      // Comments have no page of their own — open the post they sit under.
      href: `/feed/${comment.postId}`,
      authorName: comment.author.name,
    });
  }

  for (const message of messages) {
    const body = message.body.trim();
    out.set(cacheKey("MESSAGE", message.id), {
      found: true,
      heading: null,
      preview: body
        ? truncate(body, PREVIEW_CHARS)
        : message.imageUrl
          ? "(photo, no text)"
          : "(empty message)",
      href: `/messages/${message.conversationId}`,
      authorName: message.sender.name,
    });
  }

  for (const listing of listings) {
    out.set(cacheKey("LISTING", listing.id), {
      found: true,
      heading: listing.title,
      preview: truncate(listing.description, PREVIEW_CHARS),
      href: `/barter/${listing.id}`,
      authorName: listing.owner.name,
    });
  }

  for (const business of businesses) {
    out.set(cacheKey("BUSINESS", business.id), {
      found: true,
      heading: business.name,
      preview: truncate(business.description, PREVIEW_CHARS),
      href: `/services/${business.id}`,
      authorName: business.owner.name,
    });
  }

  for (const person of people) {
    out.set(cacheKey("USER", person.id), {
      found: true,
      heading: person.name,
      preview: person.bio
        ? truncate(person.bio, PREVIEW_CHARS)
        : `No bio yet · ${person.karma} karma`,
      href: `/profile/${person.id}`,
      authorName: null,
    });
  }

  return out;
}

export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const moderator = await requireRole("MODERATOR");
  const { tab } = await searchParams;
  const initialTab =
    toReportStatus(Array.isArray(tab) ? tab[0] : tab) ?? "OPEN";

  // Three capped reads rather than one, so a long tail of settled reports can
  // never crowd the open ones — the open queue is the whole point of the page.
  const [open, resolved, dismissed] = await Promise.all([
    db.report.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "desc" },
      take: TAKE,
      include: {
        reporter: { select: { id: true, name: true, avatarUrl: true } },
      },
    }),
    db.report.findMany({
      where: { status: "RESOLVED" },
      orderBy: { createdAt: "desc" },
      take: TAKE,
      include: {
        reporter: { select: { id: true, name: true, avatarUrl: true } },
      },
    }),
    db.report.findMany({
      where: { status: "DISMISSED" },
      orderBy: { createdAt: "desc" },
      take: TAKE,
      include: {
        reporter: { select: { id: true, name: true, avatarUrl: true } },
      },
    }),
  ]);

  type QueueRow = {
    report: (typeof open)[number];
    targetType: ReportTargetType;
    status: ReportStatus;
  };

  const rows: QueueRow[] = [];
  for (const report of [...open, ...resolved, ...dismissed]) {
    const targetType = toTargetType(report.targetType);
    const status = toReportStatus(report.status);
    // targetType/status are plain strings in SQLite; skip anything written
    // outside the app's vocabulary rather than crashing the whole queue.
    if (!targetType || !status) continue;
    rows.push({ report, targetType, status });
  }

  const targets = await resolveTargets(
    rows.map(({ report, targetType }) => ({
      targetType,
      targetId: report.targetId,
    }))
  );

  const data: ReportRowData[] = rows.map(({ report, targetType, status }) => {
    const { label, detail } = decodeReason(report.reason);

    return {
      id: report.id,
      targetType,
      targetId: report.targetId,
      status,
      reasonLabel: label,
      detail,
      createdAt: report.createdAt.toISOString(),
      reporterId: report.reporter.id,
      reporterName: report.reporter.name,
      reporterAvatarUrl: report.reporter.avatarUrl,
      target:
        targets.get(cacheKey(targetType, report.targetId)) ??
        missing(targetType),
    };
  });

  const openCount = data.filter((row) => row.status === "OPEN").length;

  return (
    <div className="space-y-4">
      <header>
        <Link href="/hub/block" className="text-sm font-semibold text-ink-soft">
          ← Block Hub
        </Link>
        <h1 className="mt-3 text-xl font-bold">Moderation</h1>
        <p className="mt-0.5 text-sm text-ink-soft">
          {openCount > 0
            ? `${openCount} open ${openCount === 1 ? "report" : "reports"} waiting on you, ${moderator.name.split(" ")[0]}.`
            : "Nothing waiting. Reports from every neighborhood land here."}
        </p>
      </header>

      <ModerationQueue
        reports={data}
        initialTab={initialTab}
        decide={decideReportAction}
      />
    </div>
  );
}

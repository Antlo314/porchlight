import { notFound } from "next/navigation";
import {
  Avatar,
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  SectionHeading,
  VerifiedMark,
} from "@/components/ui";
import { BackLink } from "@/components/job/BackLink";
import { JobPhotos } from "@/components/job/JobPhotos";
import { JobReplyCard, type JobReplyRow } from "@/components/job/JobReplyCard";
import { JobReplyComposer } from "@/components/job/JobReplyComposer";
import { JobStatusBadge } from "@/components/job/JobStatusBadge";
import { JobStatusControls } from "@/components/job/JobStatusControls";
import { averageRating, jobCategoryMeta } from "@/components/job/meta";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { pluralize, timeAgo } from "@/lib/format";
import { parseImages } from "@/lib/json";
import { visibleNeighborhoodIds } from "@/lib/visibility";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const job = await db.jobRequest.findUnique({
    where: { id },
    select: { title: true },
  });
  // The root layout's title template already appends "· Porchlight".
  return { title: job ? job.title : "Job request" };
}

export default async function JobDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requireUser();

  const job = await db.jobRequest.findUnique({
    where: { id },
    include: {
      requester: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          bio: true,
          karma: true,
          verifiedAt: true,
        },
      },
      neighborhood: { select: { name: true } },
      replies: {
        orderBy: { createdAt: "asc" },
        include: {
          business: {
            select: {
              id: true,
              ownerId: true,
              name: true,
              category: true,
              logoUrl: true,
              verifiedAt: true,
              reviews: { select: { rating: true } },
            },
          },
        },
      },
    },
  });

  if (!job) notFound();

  // A job is readable only from a neighborhood this member can see — their own,
  // or one they follow. Same rule as the feed.
  const neighborhoodIds = await visibleNeighborhoodIds(user);
  if (!neighborhoodIds.includes(job.neighborhoodId)) notFound();

  const isRequester = job.requesterId === user.id;

  // Every business this member owns, so the page can tell "you can answer this"
  // from "your business is listed somewhere else" without a second round trip.
  const myBusinesses = await db.business.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, neighborhoodId: true },
  });
  const eligible = myBusinesses.filter(
    (business) => business.neighborhoodId === job.neighborhoodId
  );
  const eligibleIds = new Set(eligible.map((business) => business.id));

  const replies: JobReplyRow[] = job.replies.map((reply) => ({
    id: reply.id,
    message: reply.message,
    quoteInfo: reply.quoteInfo,
    createdAt: reply.createdAt,
    business: {
      id: reply.business.id,
      ownerId: reply.business.ownerId,
      name: reply.business.name,
      category: reply.business.category,
      logoUrl: reply.business.logoUrl,
      verified: reply.business.verifiedAt !== null,
      avgRating: averageRating(reply.business.reviews),
      reviewCount: reply.business.reviews.length,
    },
  }));

  const myReply = replies.find((reply) => eligibleIds.has(reply.business.id));
  const meta = jobCategoryMeta(job.category);
  const images = parseImages(job.images);
  const isOpen = job.status === "OPEN";

  return (
    <div className="space-y-4">
      <BackLink />

      <JobPhotos images={images} />

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-porch-100 text-porch-800">
            <span aria-hidden>{meta.icon}</span> {meta.label}
          </Badge>
          <JobStatusBadge status={job.status} />
        </div>

        <div className="mt-2 flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold leading-tight">{job.title}</h1>
          {job.budgetInfo && (
            <Badge className="mt-1 bg-pine-500/10 text-pine-700">
              {job.budgetInfo}
            </Badge>
          )}
        </div>

        <p className="mt-1 text-sm text-ink-soft">
          {job.neighborhood.name} · posted {timeAgo(job.createdAt)} ·{" "}
          {replies.length > 0
            ? pluralize(replies.length, "reply", "replies")
            : "no replies yet"}
        </p>
      </div>

      <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
        {job.description}
      </p>

      <Card>
        <div className="flex items-center gap-3">
          <Avatar
            name={job.requester.name}
            src={job.requester.avatarUrl}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 font-semibold">
              <span className="truncate">{job.requester.name}</span>
              {job.requester.verifiedAt && (
                <VerifiedMark label="Verified resident" />
              )}
            </p>
            <p className="text-sm text-ink-soft">
              {job.requester.karma} karma
              {isRequester ? " · this is your job request" : ""}
            </p>
          </div>
        </div>

        {job.requester.bio && (
          <p className="mt-3 line-clamp-3 text-sm text-ink-soft">
            {job.requester.bio}
          </p>
        )}

        {!isRequester && (
          <ButtonLink
            href={`/messages/new?to=${job.requester.id}`}
            variant="secondary"
            size="md"
            className="mt-3 w-full"
          >
            💬 Message {job.requester.name}
          </ButtonLink>
        )}
      </Card>

      {isRequester && <JobStatusControls jobId={job.id} status={job.status} />}

      <SectionHeading title={`Replies (${replies.length})`} />

      {replies.length === 0 ? (
        <EmptyState
          icon="📬"
          title="No replies yet"
          body={
            isRequester
              ? `Local ${meta.label.toLowerCase()} pros in ${job.neighborhood.name} were notified the moment you posted. Replies land here and in your notifications.`
              : `Nobody has answered yet. If you do this kind of work, you can be first — replying is free on every plan.`
          }
        />
      ) : (
        <ul className="space-y-3">
          {replies.map((reply) => (
            <li key={reply.id}>
              <JobReplyCard
                reply={reply}
                canMessage={isRequester}
                isMine={eligibleIds.has(reply.business.id)}
              />
            </li>
          ))}
        </ul>
      )}

      {!isRequester &&
        (myReply ? (
          <div className="rounded-card border border-line bg-card p-4">
            <p className="text-[15px] font-semibold">
              <span aria-hidden>✅</span> You already replied
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              One reply per business keeps this readable for{" "}
              {job.requester.name}. They can message you straight from your
              reply above.
            </p>
          </div>
        ) : eligible.length > 0 ? (
          isOpen ? (
            <JobReplyComposer
              jobId={job.id}
              requesterName={job.requester.name}
              businesses={eligible.map((business) => ({
                id: business.id,
                name: business.name,
              }))}
            />
          ) : (
            <div className="rounded-card border border-line bg-card p-4">
              <p className="text-[15px] font-semibold">Not taking replies</p>
              <p className="mt-1 text-sm text-ink-soft">
                {job.status === "FULFILLED"
                  ? `${job.requester.name} found someone for this one.`
                  : `${job.requester.name} closed this request.`}{" "}
                Plenty more on the board.
              </p>
              <ButtonLink
                href="/jobs"
                variant="secondary"
                size="md"
                className="mt-3 w-full"
              >
                Browse open jobs
              </ButtonLink>
            </div>
          )
        ) : myBusinesses.length > 0 ? (
          <div className="rounded-card border border-line bg-card p-4">
            <p className="text-[15px] font-semibold">
              Your business is listed in another neighborhood
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              Replies stay inside the neighborhood a business is listed in, so
              the neighbor who asked always hears from someone nearby.
            </p>
          </div>
        ) : (
          <div className="rounded-card border border-dashed border-porch-300 bg-porch-50 p-4">
            <p className="text-[15px] font-semibold text-porch-800">
              Do this kind of work?
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              List your business in {job.neighborhood.name} and you can answer
              this one. Listing is free, and replying to a neighbor is free on
              every plan.
            </p>
            <ButtonLink
              href="/business/new"
              variant="primary"
              size="md"
              className="mt-3 w-full"
            >
              List your business
            </ButtonLink>
          </div>
        ))}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { BusinessLogo } from "@/components/business/BusinessLogo";
import { ReportBusinessButton } from "@/components/business/ReportBusinessButton";
import { ReviewComposer } from "@/components/business/ReviewComposer";
import {
  averageRating,
  telHref,
  toBusinessCategory,
  toPlan,
  websiteLabel,
} from "@/components/business/types";
import {
  Avatar,
  Badge,
  ButtonLink,
  buttonClass,
  Card,
  SectionHeading,
  Stars,
  VerifiedMark,
} from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { pluralize, timeAgo } from "@/lib/format";
import { parseImages } from "@/lib/json";
import { BUSINESS_CATEGORY_META } from "@/lib/validators";

export default async function BusinessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const now = new Date();

  const business = await db.business.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, avatarUrl: true } },
      neighborhood: { select: { name: true, city: true } },
      subscription: { select: { plan: true, status: true } },
      services: { where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" } },
      reviews: {
        orderBy: { createdAt: "desc" },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
      adBoosts: {
        where: { startsAt: { lte: now }, endsAt: { gte: now } },
        select: { poolFunded: true },
      },
    },
  });

  if (!business) notFound();

  const category = toBusinessCategory(business.category);
  const meta = BUSINESS_CATEGORY_META[category];
  const plan = toPlan(business.subscription?.plan);
  const avg = averageRating(business.reviews);
  const isOwner = business.ownerId === user.id;
  const myReview = business.reviews.find((r) => r.authorId === user.id) ?? null;
  const otherReviews = business.reviews.filter((r) => r.authorId !== user.id);
  const liveBoost = business.adBoosts[0] ?? null;

  return (
    <div className="space-y-4">
      <Link
        href="/services"
        className="inline-flex min-h-11 items-center text-sm font-semibold text-ink-soft"
      >
        ← All services
      </Link>

      <Card>
        <div className="flex gap-3">
          <BusinessLogo
            name={business.name}
            category={category}
            logoUrl={business.logoUrl}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-1.5">
              <h1 className="text-xl font-bold leading-tight">
                {business.name}
              </h1>
              {business.verifiedAt && (
                <span className="mt-1">
                  <VerifiedMark label="Verified by Porchlight" />
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-ink-soft">
              <span aria-hidden>{meta.icon}</span> {meta.label} ·{" "}
              {business.neighborhood.name}
            </p>
            <div className="mt-1.5">
              <Stars rating={avg} count={business.reviews.length} />
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {plan === "FEATURED" && business.subscription?.status === "ACTIVE" && (
            <Badge className="bg-porch-100 text-porch-800">Featured</Badge>
          )}
          {liveBoost?.poolFunded && (
            <Badge className="bg-pine-500/10 text-pine-700">
              🔦 Ad-Boost Pool
            </Badge>
          )}
          {business.verifiedAt && (
            <Badge className="bg-pine-500/10 text-pine-700">
              Verified business
            </Badge>
          )}
        </div>

        <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed">
          {business.description}
        </p>

        <div className="mt-4 space-y-2">
          {/* Real anchors (tel: and an external https), so these take the
              shared button styling rather than ButtonLink. */}
          {business.phone && (
            <a
              href={telHref(business.phone)}
              className={buttonClass("primary", "lg")}
            >
              📞 Call {business.phone}
            </a>
          )}
          {business.website && (
            <a
              href={business.website}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className={buttonClass("secondary", "lg")}
            >
              🌐 {websiteLabel(business.website)}
            </a>
          )}
          {isOwner ? (
            <ButtonLink href="/business/manage" variant="secondary" size="lg">
              Manage this business
            </ButtonLink>
          ) : (
            <ButtonLink
              href={`/messages/new?to=${business.ownerId}`}
              variant="secondary"
              size="lg"
            >
              💬 Message {business.owner.name}
            </ButtonLink>
          )}
        </div>
      </Card>

      <section>
        <SectionHeading title="Services" />
        {business.services.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-soft">
              {isOwner
                ? "You haven't published a service listing yet. Add one from your dashboard so neighbors know what you offer."
                : `${business.name} hasn't listed individual services yet — message them to ask.`}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {business.services.map((service) => {
              const images = parseImages(service.images);
              return (
                <Card key={service.id}>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold">{service.title}</h3>
                    {service.priceInfo && (
                      <Badge className="bg-porch-100 text-porch-800">
                        {service.priceInfo}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
                    {service.description}
                  </p>
                  {images.length > 0 && (
                    <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
                      {images.map((src) => (
                        // eslint-disable-next-line @next/next/no-img-element -- owner-supplied hosts
                        <img
                          key={src}
                          src={src}
                          alt=""
                          className="h-24 w-24 shrink-0 rounded-xl border border-line object-cover"
                        />
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <SectionHeading
          title="Reviews"
          action={
            business.reviews.length > 0 ? (
              <span className="text-xs text-ink-soft">
                {pluralize(business.reviews.length, "review")}
              </span>
            ) : undefined
          }
        />

        <div className="space-y-3">
          {!isOwner && (
            <ReviewComposer
              businessId={business.id}
              businessName={business.name}
              existing={
                myReview
                  ? {
                      rating: myReview.rating,
                      body: myReview.body,
                      verifiedJob: myReview.verifiedJob,
                    }
                  : null
              }
            />
          )}

          {business.reviews.length === 0 ? (
            <Card>
              <p className="text-sm text-ink-soft">
                No reviews yet.{" "}
                {isOwner
                  ? "Ask a neighbor you've worked with to leave the first one."
                  : "Be the first neighbor to weigh in."}
              </p>
            </Card>
          ) : (
            (isOwner ? business.reviews : otherReviews).map((review) => (
              <Card key={review.id}>
                <div className="flex items-center gap-2">
                  <Avatar
                    name={review.author.name}
                    src={review.author.avatarUrl}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {review.author.name}
                    </p>
                    <p className="text-xs text-ink-soft">
                      {timeAgo(review.createdAt)}
                    </p>
                  </div>
                  {review.verifiedJob && (
                    <Badge className="bg-pine-500/10 text-pine-700">
                      ✓ Hired
                    </Badge>
                  )}
                </div>
                <div className="mt-2">
                  <Stars rating={review.rating} />
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed">
                  {review.body}
                </p>
              </Card>
            ))
          )}
        </div>
      </section>

      <ReportBusinessButton businessId={business.id} />
    </div>
  );
}

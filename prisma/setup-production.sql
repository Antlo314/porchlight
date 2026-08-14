-- Porchlight production setup
--
-- Paste this whole file into Neon's SQL Editor and press Run.
-- Creates every table, then loads the 22 Georgia neighborhoods.
--
-- Safe to run twice: the neighborhood insert skips rows that already exist.
-- No demo accounts are created here on purpose - the dev seed's demo logins
-- share a password that lives in this repo, so they must not exist in production.

-- ===== 20260810000000_init =====

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "neighborhoodId" TEXT NOT NULL,
    "addressLine" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "karma" INTEGER NOT NULL DEFAULT 0,
    "inviteCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Neighborhood" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "county" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'GA',
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Neighborhood_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NeighborhoodFollow" (
    "userId" TEXT NOT NULL,
    "neighborhoodId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NeighborhoodFollow_pkey" PRIMARY KEY ("userId","neighborhoodId")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "neighborhoodId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'GENERAL',
    "title" TEXT,
    "body" TEXT NOT NULL,
    "images" TEXT NOT NULL DEFAULT '[]',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventDetail" (
    "postId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "location" TEXT NOT NULL,

    CONSTRAINT "EventDetail_pkey" PRIMARY KEY ("postId")
);

-- CreateTable
CREATE TABLE "EventRsvp" (
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GOING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventRsvp_pkey" PRIMARY KEY ("eventId","userId")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "parentId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reaction" (
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'LIKE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reaction_pkey" PRIMARY KEY ("userId","postId")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "isGroup" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("conversationId","userId")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarterListing" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "neighborhoodId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "images" TEXT NOT NULL DEFAULT '[]',
    "wants" TEXT,
    "creditValue" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BarterListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarterOffer" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "offererId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "offeredItemDesc" TEXT,
    "creditAmount" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BarterOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeCreditEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "offerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeCreditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "neighborhoodId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "phone" TEXT,
    "website" TEXT,
    "logoUrl" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceListing" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priceInfo" TEXT,
    "images" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodEnd" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdBoost" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "poolFunded" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdBoost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoostEvent" (
    "id" TEXT NOT NULL,
    "boostId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoostEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "verifiedJob" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRequest" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "neighborhoodId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "budgetInfo" TEXT,
    "images" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobReply" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "quoteInfo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_inviteCode_key" ON "User"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "Neighborhood_slug_key" ON "Neighborhood"("slug");

-- CreateIndex
CREATE INDEX "Post_neighborhoodId_createdAt_idx" ON "Post"("neighborhoodId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_postId_createdAt_idx" ON "Comment"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "BarterListing_neighborhoodId_status_createdAt_idx" ON "BarterListing"("neighborhoodId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "TradeCreditEntry_userId_createdAt_idx" ON "TradeCreditEntry"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_businessId_key" ON "Subscription"("businessId");

-- CreateIndex
CREATE INDEX "AdBoost_endsAt_idx" ON "AdBoost"("endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "BoostEvent_boostId_userId_kind_day_key" ON "BoostEvent"("boostId", "userId", "kind", "day");

-- CreateIndex
CREATE UNIQUE INDEX "Review_businessId_authorId_key" ON "Review"("businessId", "authorId");

-- CreateIndex
CREATE INDEX "JobRequest_neighborhoodId_status_createdAt_idx" ON "JobRequest"("neighborhoodId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobReply_jobId_businessId_key" ON "JobReply"("jobId", "businessId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_neighborhoodId_fkey" FOREIGN KEY ("neighborhoodId") REFERENCES "Neighborhood"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NeighborhoodFollow" ADD CONSTRAINT "NeighborhoodFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NeighborhoodFollow" ADD CONSTRAINT "NeighborhoodFollow_neighborhoodId_fkey" FOREIGN KEY ("neighborhoodId") REFERENCES "Neighborhood"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_neighborhoodId_fkey" FOREIGN KEY ("neighborhoodId") REFERENCES "Neighborhood"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDetail" ADD CONSTRAINT "EventDetail_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRsvp" ADD CONSTRAINT "EventRsvp_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "EventDetail"("postId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRsvp" ADD CONSTRAINT "EventRsvp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarterListing" ADD CONSTRAINT "BarterListing_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarterListing" ADD CONSTRAINT "BarterListing_neighborhoodId_fkey" FOREIGN KEY ("neighborhoodId") REFERENCES "Neighborhood"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarterOffer" ADD CONSTRAINT "BarterOffer_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "BarterListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarterOffer" ADD CONSTRAINT "BarterOffer_offererId_fkey" FOREIGN KEY ("offererId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeCreditEntry" ADD CONSTRAINT "TradeCreditEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeCreditEntry" ADD CONSTRAINT "TradeCreditEntry_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "BarterOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_neighborhoodId_fkey" FOREIGN KEY ("neighborhoodId") REFERENCES "Neighborhood"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceListing" ADD CONSTRAINT "ServiceListing_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdBoost" ADD CONSTRAINT "AdBoost_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoostEvent" ADD CONSTRAINT "BoostEvent_boostId_fkey" FOREIGN KEY ("boostId") REFERENCES "AdBoost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoostEvent" ADD CONSTRAINT "BoostEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRequest" ADD CONSTRAINT "JobRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRequest" ADD CONSTRAINT "JobRequest_neighborhoodId_fkey" FOREIGN KEY ("neighborhoodId") REFERENCES "Neighborhood"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobReply" ADD CONSTRAINT "JobReply_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobReply" ADD CONSTRAINT "JobReply_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- ===== 20260811000000_add_wants =====

-- CreateTable
CREATE TABLE "Want" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "neighborhoodId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "creditOffer" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Want_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Want_neighborhoodId_status_createdAt_idx" ON "Want"("neighborhoodId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "Want" ADD CONSTRAINT "Want_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Want" ADD CONSTRAINT "Want_neighborhoodId_fkey" FOREIGN KEY ("neighborhoodId") REFERENCES "Neighborhood"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ===== 20260811100000_settle_once_per_offer =====

-- One settlement per offer.
--
-- NULL offerId rows (signup bonuses, invite bonuses, adjustments) are exempt:
-- Postgres treats NULLs as distinct in a unique index, so any number of them
-- coexist. Only rows that actually reference an offer are constrained.
CREATE UNIQUE INDEX "TradeCreditEntry_offerId_reason_key"
    ON "TradeCreditEntry"("offerId", "reason");


-- ===== 20260813000000_game_runs =====

CREATE TABLE IF NOT EXISTS "GameRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "game" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "score" INTEGER,
    "porchesLit" INTEGER,
    "coins" INTEGER,
    "deaths" INTEGER,
    "finished" BOOLEAN NOT NULL DEFAULT false,
    "creditsAwarded" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "rejectReason" TEXT,
    "clientMeta" TEXT,
    CONSTRAINT "GameRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GameRun_nonce_key" ON "GameRun"("nonce");
CREATE INDEX IF NOT EXISTS "GameRun_userId_startedAt_idx" ON "GameRun"("userId", "startedAt");
CREATE INDEX IF NOT EXISTS "GameRun_status_startedAt_idx" ON "GameRun"("status", "startedAt");


-- ---------------------------------------------------------------
-- Georgia neighborhoods
-- ---------------------------------------------------------------

INSERT INTO "Neighborhood" ("id", "slug", "name", "city", "county", "state", "lat", "lng")
VALUES
  ('nh_midtown-atl', 'midtown-atl', 'Midtown', 'Atlanta', 'Fulton', 'GA', 33.7838, -84.3831),
  ('nh_old-fourth-ward', 'old-fourth-ward', 'Old Fourth Ward', 'Atlanta', 'Fulton', 'GA', 33.7644, -84.3722),
  ('nh_grant-park', 'grant-park', 'Grant Park', 'Atlanta', 'Fulton', 'GA', 33.7365, -84.3703),
  ('nh_east-atlanta-village', 'east-atlanta-village', 'East Atlanta Village', 'Atlanta', 'DeKalb', 'GA', 33.7407, -84.3438),
  ('nh_kirkwood', 'kirkwood', 'Kirkwood', 'Atlanta', 'DeKalb', 'GA', 33.7534, -84.3269),
  ('nh_buckhead', 'buckhead', 'Buckhead', 'Atlanta', 'Fulton', 'GA', 33.8388, -84.3793),
  ('nh_west-end-atl', 'west-end-atl', 'West End', 'Atlanta', 'Fulton', 'GA', 33.7365, -84.4133),
  ('nh_downtown-decatur', 'downtown-decatur', 'Downtown Decatur', 'Decatur', 'DeKalb', 'GA', 33.7748, -84.2963),
  ('nh_smyrna-market-village', 'smyrna-market-village', 'Market Village', 'Smyrna', 'Cobb', 'GA', 33.884, -84.5144),
  ('nh_marietta-square', 'marietta-square', 'Marietta Square', 'Marietta', 'Cobb', 'GA', 33.9526, -84.5499),
  ('nh_roswell-historic', 'roswell-historic', 'Historic Roswell', 'Roswell', 'Fulton', 'GA', 34.0232, -84.3616),
  ('nh_alpharetta-downtown', 'alpharetta-downtown', 'Downtown Alpharetta', 'Alpharetta', 'Fulton', 'GA', 34.0754, -84.2941),
  ('nh_sandy-springs-city', 'sandy-springs-city', 'City Springs', 'Sandy Springs', 'Fulton', 'GA', 33.9245, -84.3785),
  ('nh_duluth-downtown', 'duluth-downtown', 'Downtown Duluth', 'Duluth', 'Gwinnett', 'GA', 34.0029, -84.1446),
  ('nh_lawrenceville-square', 'lawrenceville-square', 'Lawrenceville Square', 'Lawrenceville', 'Gwinnett', 'GA', 33.9562, -83.988),
  ('nh_savannah-historic', 'savannah-historic', 'Historic District', 'Savannah', 'Chatham', 'GA', 32.0764, -81.0912),
  ('nh_savannah-starland', 'savannah-starland', 'Starland District', 'Savannah', 'Chatham', 'GA', 32.0553, -81.0954),
  ('nh_athens-five-points', 'athens-five-points', 'Five Points', 'Athens', 'Clarke', 'GA', 33.9382, -83.391),
  ('nh_athens-normaltown', 'athens-normaltown', 'Normaltown', 'Athens', 'Clarke', 'GA', 33.9645, -83.4023),
  ('nh_augusta-summerville', 'augusta-summerville', 'Summerville', 'Augusta', 'Richmond', 'GA', 33.4863, -82.0244),
  ('nh_columbus-uptown', 'columbus-uptown', 'Uptown', 'Columbus', 'Muscogee', 'GA', 32.4633, -84.9911),
  ('nh_macon-intown', 'macon-intown', 'InTown', 'Macon', 'Bibb', 'GA', 32.8353, -83.6329)
ON CONFLICT ("slug") DO NOTHING;

-- Confirm it worked: this should report 22.
SELECT COUNT(*) AS neighborhoods_loaded FROM "Neighborhood";

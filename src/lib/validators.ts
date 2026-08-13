// Zod schemas are the single source of truth for the string "enums" in
// prisma/schema.prisma (SQLite has no native enums). Keep the two in sync.
import { z } from "zod";

/**
 * An image reference: either one we stored (`/uploads/…`, relative) or an
 * external link someone pasted. Plain `z.string().url()` rejects the former,
 * so every images field uses this instead.
 */
export const imageUrlSchema = z
  .string()
  .trim()
  .refine(
    (v) =>
      (v.startsWith("/uploads/") && !v.includes("..")) ||
      /^https?:\/\/\S+$/i.test(v),
    "That doesn't look like an image link"
  );

export const imageListSchema = z.array(imageUrlSchema).max(6).default([]);

// ─────────────────────────────────────────────────────────────
// Enum-likes
// ─────────────────────────────────────────────────────────────

export const PostType = z.enum([
  "GENERAL",
  "SAFETY",
  "EVENT",
  "RECOMMENDATION",
  "LOST_FOUND",
  "FREE_STUFF",
]);
export type PostTypeValue = z.infer<typeof PostType>;

export const POST_TYPE_META: Record<
  PostTypeValue,
  { label: string; icon: string; hint: string; badgeClass: string }
> = {
  GENERAL: {
    label: "General",
    icon: "💬",
    hint: "Anything neighborly",
    badgeClass: "bg-line text-ink-soft",
  },
  SAFETY: {
    label: "Safety",
    icon: "🚨",
    hint: "Alert the block",
    badgeClass: "bg-red-100 text-red-800",
  },
  EVENT: {
    label: "Event",
    icon: "📅",
    hint: "Gatherings & meetups",
    badgeClass: "bg-pine-500/10 text-pine-700",
  },
  RECOMMENDATION: {
    label: "Ask",
    icon: "🙋",
    hint: "Ask for a recommendation",
    badgeClass: "bg-porch-100 text-porch-800",
  },
  LOST_FOUND: {
    label: "Lost & Found",
    icon: "🔎",
    hint: "Pets, keys, packages",
    badgeClass: "bg-amber-100 text-amber-800",
  },
  FREE_STUFF: {
    label: "Free",
    icon: "🎁",
    hint: "Curb finds & giveaways",
    badgeClass: "bg-emerald-100 text-emerald-800",
  },
};

export const BarterKind = z.enum(["GOODS", "SERVICE", "TIME"]);
export type BarterKindValue = z.infer<typeof BarterKind>;

export const BARTER_KIND_META: Record<
  BarterKindValue,
  { label: string; icon: string; hint: string }
> = {
  GOODS: { label: "Item", icon: "📦", hint: "Something physical" },
  SERVICE: { label: "Skill", icon: "🛠️", hint: "Something you can do" },
  TIME: { label: "Time", icon: "⏱️", hint: "Hours of help" },
};

export const BarterCategory = z.enum([
  "TOOLS",
  "FURNITURE",
  "ELECTRONICS",
  "CLOTHING",
  "GARDEN",
  "SKILLS",
  "CHILDCARE",
  "TUTORING",
  "REPAIRS",
  "OTHER",
]);
export type BarterCategoryValue = z.infer<typeof BarterCategory>;

export const BARTER_CATEGORY_LABELS: Record<BarterCategoryValue, string> = {
  TOOLS: "Tools",
  FURNITURE: "Furniture",
  ELECTRONICS: "Electronics",
  CLOTHING: "Clothing",
  GARDEN: "Garden",
  SKILLS: "Skills",
  CHILDCARE: "Childcare",
  TUTORING: "Tutoring",
  REPAIRS: "Repairs",
  OTHER: "Other",
};

export const BusinessCategory = z.enum([
  "HOME_SERVICES",
  "FOOD",
  "HEALTH",
  "AUTO",
  "PETS",
  "CLEANING",
  "LANDSCAPING",
  "TUTORING",
  "EVENTS",
  "OTHER",
]);
export type BusinessCategoryValue = z.infer<typeof BusinessCategory>;

export const BUSINESS_CATEGORY_META: Record<
  BusinessCategoryValue,
  { label: string; icon: string }
> = {
  HOME_SERVICES: { label: "Home Services", icon: "🔧" },
  FOOD: { label: "Food & Drink", icon: "🍑" },
  HEALTH: { label: "Health & Wellness", icon: "💚" },
  AUTO: { label: "Auto", icon: "🚗" },
  PETS: { label: "Pets", icon: "🐕" },
  CLEANING: { label: "Cleaning", icon: "🧼" },
  LANDSCAPING: { label: "Lawn & Landscaping", icon: "🌳" },
  TUTORING: { label: "Tutoring", icon: "📚" },
  EVENTS: { label: "Events", icon: "🎉" },
  OTHER: { label: "Other", icon: "🏪" },
};

export const Plan = z.enum(["FREE", "LOCAL_PRO", "FEATURED"]);
export type PlanValue = z.infer<typeof Plan>;

/**
 * Pricing. The free tier is the acquisition wedge — a business can be listed,
 * reviewed, and messaged without paying anything — and AD_BOOST_POOL_SHARE of
 * paid revenue funds free ad boosts for well-reviewed verified businesses.
 *
 * Copy rule: describe OUR prices, never a competitor's. See docs/STRATEGY.md.
 */
export const PLAN_META: Record<
  PlanValue,
  {
    label: string;
    priceMonthly: number;
    tagline: string;
    features: string[];
    listingLimit: number | null;
  }
> = {
  FREE: {
    label: "Free",
    priceMonthly: 0,
    tagline: "Get found by your neighbors",
    features: [
      "Business profile page",
      "Collect verified reviews",
      "1 service listing",
    ],
    listingLimit: 1,
  },
  LOCAL_PRO: {
    label: "Local Pro",
    priceMonthly: 19,
    tagline: "For growing local businesses",
    features: [
      "Unlimited service listings",
      "Reply to neighbor requests",
      "Photo galleries",
      "Business analytics",
    ],
    listingLimit: null,
  },
  FEATURED: {
    label: "Featured",
    priceMonthly: 39,
    tagline: "We run your ads for you",
    features: [
      "Everything in Local Pro",
      "Rotating featured placement",
      "Eligible for the Ad-Boost Pool",
      "Priority support",
    ],
    listingLimit: null,
  },
};

export const AD_BOOST_POOL_SHARE = 0.2;
export const AD_BOOST_MIN_RATING = 4.5;

export const ReportReason = z.enum([
  "SPAM",
  "HARASSMENT",
  "HATE_SPEECH",
  "MISINFORMATION",
  "SCAM",
  "OFF_TOPIC",
  "OTHER",
]);

export const REPORT_REASON_LABELS: Record<
  z.infer<typeof ReportReason>,
  string
> = {
  SPAM: "Spam or advertising",
  HARASSMENT: "Harassment or bullying",
  HATE_SPEECH: "Hate speech",
  MISINFORMATION: "False information",
  SCAM: "Scam or fraud",
  OFF_TOPIC: "Not relevant to the neighborhood",
  OTHER: "Something else",
};

// ─────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────

export const signupSchema = z.object({
  email: z.string().trim().email().transform((v) => v.toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().trim().min(2).max(60),
  neighborhoodId: z.string().min(1, "Pick your neighborhood"),
});

export const loginSchema = z.object({
  email: z.string().trim().email().transform((v) => v.toLowerCase()),
  password: z.string().min(1),
});

// ─────────────────────────────────────────────────────────────
// Feed
// ─────────────────────────────────────────────────────────────

export const createPostSchema = z
  .object({
    type: PostType,
    title: z.string().trim().max(120).optional(),
    body: z.string().trim().min(1, "Say something first").max(5000),
    images: imageListSchema,
    // Event posts only
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().optional(),
    location: z.string().trim().max(200).optional(),
  })
  .refine((d) => d.type !== "EVENT" || (d.startsAt && d.location), {
    message: "Events need a date and a location",
    path: ["startsAt"],
  })
  .refine((d) => !d.endsAt || !d.startsAt || d.endsAt >= d.startsAt, {
    message: "End time must be after the start time",
    path: ["endsAt"],
  });

export const createCommentSchema = z.object({
  postId: z.string().min(1),
  parentId: z.string().optional(),
  body: z.string().trim().min(1).max(2000),
});

export const reactionSchema = z.object({
  postId: z.string().min(1),
  kind: z.enum(["LIKE", "THANKS", "HELPFUL"]).default("LIKE"),
});

export const rsvpSchema = z.object({
  eventId: z.string().min(1),
  status: z.enum(["GOING", "MAYBE"]),
});

// ─────────────────────────────────────────────────────────────
// Barter
// ─────────────────────────────────────────────────────────────

export const createBarterListingSchema = z.object({
  kind: BarterKind,
  title: z.string().trim().min(3, "Give it a short title").max(100),
  description: z.string().trim().min(1, "Add a description").max(3000),
  category: BarterCategory,
  wants: z.string().trim().max(500).optional(),
  creditValue: z.coerce.number().int().min(1).max(10000).optional(),
  images: imageListSchema,
});

export const createBarterOfferSchema = z
  .object({
    listingId: z.string().min(1),
    message: z.string().trim().min(1, "Add a note for the owner").max(1000),
    offeredItemDesc: z.string().trim().max(500).optional(),
    creditAmount: z.coerce.number().int().min(1).max(10000).optional(),
  })
  .refine((d) => d.offeredItemDesc || d.creditAmount, {
    message: "Offer either a trade or Porch Credits",
    path: ["offeredItemDesc"],
  });

/**
 * The other half of a trade. A listing is "what I have"; a Want is "what I
 * need." Recording both is what lets the app match them instead of relying on
 * two people happening to browse at the same moment.
 */
export const createWantSchema = z.object({
  kind: BarterKind,
  title: z.string().trim().min(3, "What are you looking for?").max(100),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  category: BarterCategory,
  creditOffer: z.coerce.number().int().min(1).max(10000).optional(),
});

export const wantStatusSchema = z.object({
  wantId: z.string().min(1),
  status: z.enum(["OPEN", "FULFILLED", "CLOSED"]),
});

export const offerDecisionSchema = z.object({
  offerId: z.string().min(1),
  decision: z.enum(["ACCEPTED", "DECLINED", "COMPLETED", "CANCELLED"]),
});

// ─────────────────────────────────────────────────────────────
// Messaging
// ─────────────────────────────────────────────────────────────

export const sendMessageSchema = z.object({
  conversationId: z.string().min(1),
  body: z.string().trim().min(1).max(4000),
});

export const startConversationSchema = z.object({
  recipientId: z.string().min(1),
  body: z.string().trim().min(1).max(4000),
});

// ─────────────────────────────────────────────────────────────
// Business & monetization
// ─────────────────────────────────────────────────────────────

export const createBusinessSchema = z.object({
  name: z.string().trim().min(2, "Business name is required").max(80),
  category: BusinessCategory,
  description: z.string().trim().min(10, "Tell neighbors what you do").max(2000),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  website: z.string().url("Enter a full URL").optional().or(z.literal("")),
  // imageUrlSchema, not .url(): the logo picker returns a relative /uploads path.
  logoUrl: imageUrlSchema.optional().or(z.literal("")),
});

export const createServiceListingSchema = z.object({
  businessId: z.string().min(1),
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().min(1).max(2000),
  priceInfo: z.string().trim().max(60).optional().or(z.literal("")),
  images: imageListSchema,
});

export const createReviewSchema = z.object({
  businessId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().min(1, "Add a few words").max(2000),
});

// ─────────────────────────────────────────────────────────────
// Job requests — the reverse marketplace
// ─────────────────────────────────────────────────────────────

export const createJobRequestSchema = z.object({
  title: z.string().trim().min(5, "Say what you need in a few words").max(100),
  description: z
    .string()
    .trim()
    .min(10, "A sentence or two helps pros quote accurately")
    .max(2000),
  category: BusinessCategory,
  budgetInfo: z.string().trim().max(60).optional().or(z.literal("")),
  images: imageListSchema,
});

export const createJobReplySchema = z.object({
  jobId: z.string().min(1),
  message: z.string().trim().min(1, "Introduce yourself").max(1000),
  quoteInfo: z.string().trim().max(60).optional().or(z.literal("")),
});

export const jobStatusSchema = z.object({
  jobId: z.string().min(1),
  status: z.enum(["OPEN", "FULFILLED", "CLOSED"]),
});

// ─────────────────────────────────────────────────────────────
// Invites
// ─────────────────────────────────────────────────────────────

export const inviteCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z2-9]{8}$/, "That invite code doesn't look right");

/** Signup arriving through an invite link: neighborhood comes from the code. */
export const invitedSignupSchema = z.object({
  email: z.string().trim().email().transform((v) => v.toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().trim().min(2).max(60),
  inviteCode: inviteCodeSchema,
});

// ─────────────────────────────────────────────────────────────
// Profile & moderation
// ─────────────────────────────────────────────────────────────

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(60),
  bio: z.string().trim().max(500).optional().or(z.literal("")),
  // imageUrlSchema, not .url(): the avatar picker returns a relative /uploads
  // path, which z.string().url() rejects — that made every save fail after a
  // photo was chosen.
  avatarUrl: imageUrlSchema.optional().or(z.literal("")),
});

export const createReportSchema = z.object({
  targetType: z.enum([
    "POST",
    "COMMENT",
    "MESSAGE",
    "LISTING",
    "BUSINESS",
    "USER",
  ]),
  targetId: z.string().min(1),
  reason: ReportReason,
  detail: z.string().trim().max(1000).optional(),
});

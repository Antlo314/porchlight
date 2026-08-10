"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeImages } from "@/lib/json";
import {
  PLAN_META,
  createBusinessSchema,
  createServiceListingSchema,
} from "@/lib/validators";
import { toPlan, type ActionResult } from "@/components/business/types";

function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check the form and try again.";
}

// Derived from the shared create schema so the two can't drift. Images are
// omitted deliberately: the manage form doesn't edit them, and defaulting them
// to [] here would silently wipe an existing gallery.
const updateServiceListingSchema = createServiceListingSchema
  .omit({ businessId: true, images: true })
  .extend({ listingId: z.string().min(1) });

const listingIdSchema = z.string().min(1);

// ACTIVE | PAUSED mirrors the ServiceListing.status comment in schema.prisma.
const listingStatusSchema = z.object({
  listingId: listingIdSchema,
  status: z.enum(["ACTIVE", "PAUSED"]),
});

/** The one ownership check every action in this file goes through. */
async function ownedBusiness(userId: string) {
  return db.business.findFirst({
    where: { ownerId: userId },
    select: { id: true, subscription: { select: { plan: true, status: true } } },
  });
}

/**
 * A listing belongs to the caller only if its business does. Resolved by a
 * single query that joins on ownerId — never by trusting the id from the
 * client.
 */
async function ownedListing(userId: string, listingId: string) {
  return db.serviceListing.findFirst({
    where: { id: listingId, business: { ownerId: userId } },
    select: { id: true, businessId: true },
  });
}

/** Effective plan: a past-due or cancelled subscription drops back to FREE. */
function effectivePlan(sub: { plan: string; status: string } | null) {
  if (!sub || sub.status !== "ACTIVE") return "FREE" as const;
  return toPlan(sub.plan);
}

export async function updateBusiness(input: unknown): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = createBusinessSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const business = await ownedBusiness(user.id);
  if (!business) {
    return { ok: false, error: "You don't have a business to edit." };
  }

  const { name, category, description, phone, website } = parsed.data;

  await db.business.update({
    where: { id: business.id },
    data: {
      name,
      category,
      description,
      phone: phone ? phone : null,
      website: website ? website : null,
    },
  });

  revalidatePath("/business/manage");
  revalidatePath(`/services/${business.id}`);
  revalidatePath("/services");
  return { ok: true };
}

/**
 * Adds a service listing, enforcing the plan's listingLimit server-side.
 * FREE allows 1 (PLAN_META.FREE.listingLimit); the client shows an upgrade
 * prompt, but the limit is real here so a crafted request can't slip past it.
 */
export async function createServiceListing(
  input: unknown
): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = createServiceListingSchema
    .omit({ businessId: true })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const business = await ownedBusiness(user.id);
  if (!business) {
    return { ok: false, error: "Create your business profile first." };
  }

  const plan = effectivePlan(business.subscription ?? null);
  const limit = PLAN_META[plan].listingLimit;

  if (limit !== null) {
    const count = await db.serviceListing.count({
      where: { businessId: business.id },
    });
    if (count >= limit) {
      return {
        ok: false,
        upgradeRequired: true,
        error: `${PLAN_META[plan].label} includes ${limit} service listing${
          limit === 1 ? "" : "s"
        }. Go Local Pro for $19/mo for unlimited listings — or delete one to swap it.`,
      };
    }
  }

  const { title, description, priceInfo, images } = parsed.data;

  await db.serviceListing.create({
    data: {
      businessId: business.id,
      title,
      description,
      priceInfo: priceInfo ? priceInfo : null,
      images: serializeImages(images),
      status: "ACTIVE",
    },
  });

  revalidatePath("/business/manage");
  revalidatePath(`/services/${business.id}`);
  revalidatePath("/services");
  return { ok: true };
}

export async function updateServiceListing(
  input: unknown
): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = updateServiceListingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const { listingId, title, description, priceInfo } = parsed.data;
  const listing = await ownedListing(user.id, listingId);
  if (!listing) return { ok: false, error: "That listing isn't yours." };

  await db.serviceListing.update({
    where: { id: listing.id },
    data: {
      title,
      description,
      priceInfo: priceInfo ? priceInfo : null,
    },
  });

  revalidatePath("/business/manage");
  revalidatePath(`/services/${listing.businessId}`);
  return { ok: true };
}

/** Pause hides a listing from the directory without losing its reviews/history. */
export async function setServiceListingStatus(
  input: unknown
): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = listingStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unknown listing status." };

  const { listingId, status } = parsed.data;
  const listing = await ownedListing(user.id, listingId);
  if (!listing) return { ok: false, error: "That listing isn't yours." };

  await db.serviceListing.update({
    where: { id: listing.id },
    data: { status },
  });

  revalidatePath("/business/manage");
  revalidatePath(`/services/${listing.businessId}`);
  return { ok: true };
}

export async function deleteServiceListing(
  input: unknown
): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = listingIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unknown listing." };

  const listing = await ownedListing(user.id, parsed.data);
  if (!listing) return { ok: false, error: "That listing isn't yours." };

  await db.serviceListing.delete({ where: { id: listing.id } });

  revalidatePath("/business/manage");
  revalidatePath(`/services/${listing.businessId}`);
  return { ok: true };
}

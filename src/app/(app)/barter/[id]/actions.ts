"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { creditBalance, settleCreditTrade } from "@/lib/credits";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import {
  createBarterOfferSchema,
  offerDecisionSchema,
} from "@/lib/validators";
import { blankToUndefined, toFieldErrors } from "../formHelpers";

export type OfferActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export type CreateOfferInput = {
  listingId: string;
  message: string;
  offeredItemDesc?: string;
  /** Raw string from the form; the schema coerces it. */
  creditAmount?: string;
};

/** A member may act on listings in their own neighborhood or ones they follow. */
async function canSeeNeighborhood(
  userId: string,
  userNeighborhoodId: string,
  listingNeighborhoodId: string
) {
  if (userNeighborhoodId === listingNeighborhoodId) return true;
  const follow = await db.neighborhoodFollow.findUnique({
    where: {
      userId_neighborhoodId: {
        userId,
        neighborhoodId: listingNeighborhoodId,
      },
    },
    select: { userId: true },
  });
  return follow !== null;
}

function revalidateListing(listingId: string) {
  revalidatePath(`/barter/${listingId}`);
  revalidatePath("/barter");
  revalidatePath("/barter/offers");
}

export async function createOfferAction(
  input: CreateOfferInput
): Promise<OfferActionResult> {
  const user = await requireUser();

  const parsed = createBarterOfferSchema.safeParse({
    listingId: input.listingId,
    message: input.message,
    offeredItemDesc: blankToUndefined(input.offeredItemDesc),
    creditAmount: blankToUndefined(input.creditAmount),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const data = parsed.data;

  const listing = await db.barterListing.findUnique({
    where: { id: data.listingId },
    select: {
      id: true,
      ownerId: true,
      title: true,
      status: true,
      neighborhoodId: true,
    },
  });
  if (!listing) return { ok: false, error: "That listing is no longer here." };

  if (listing.ownerId === user.id) {
    return { ok: false, error: "You can't make an offer on your own listing." };
  }
  if (listing.status !== "OPEN") {
    return { ok: false, error: "This listing isn't taking offers right now." };
  }
  if (
    !(await canSeeNeighborhood(user.id, user.neighborhoodId, listing.neighborhoodId))
  ) {
    return { ok: false, error: "That listing is in another neighborhood." };
  }

  const existing = await db.barterOffer.findFirst({
    where: {
      listingId: listing.id,
      offererId: user.id,
      status: { in: ["PENDING", "ACCEPTED"] },
    },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, error: "You already have an offer on this listing." };
  }

  // Credits are only moved on completion, but there's no point letting someone
  // promise more than they have.
  if (data.creditAmount) {
    const balance = await creditBalance(user.id);
    if (data.creditAmount > balance) {
      return {
        ok: false,
        error: `You have ${balance} Porch Credits — offer that or less.`,
        fieldErrors: { creditAmount: "More than your balance" },
      };
    }
  }

  await db.barterOffer.create({
    data: {
      listingId: listing.id,
      offererId: user.id,
      message: data.message,
      offeredItemDesc: data.offeredItemDesc ?? null,
      creditAmount: data.creditAmount ?? null,
    },
  });

  await notify({
    userId: listing.ownerId,
    actorId: user.id,
    type: "OFFER_RECEIVED",
    payload: {
      href: `/barter/${listing.id}`,
      text: `${user.name} made an offer on "${listing.title}"`,
      actorName: user.name,
    },
  });

  revalidateListing(listing.id);
  return { ok: true };
}

export async function decideOfferAction(input: {
  offerId: string;
  decision: string;
}): Promise<OfferActionResult> {
  const user = await requireUser();

  const parsed = offerDecisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That isn't a valid action." };
  const { offerId, decision } = parsed.data;

  const offer = await db.barterOffer.findUnique({
    where: { id: offerId },
    include: {
      offerer: { select: { id: true, name: true } },
      listing: {
        select: { id: true, ownerId: true, title: true, status: true },
      },
    },
  });
  if (!offer) return { ok: false, error: "That offer is no longer here." };

  const isOwner = offer.listing.ownerId === user.id;
  const isOfferer = offer.offererId === user.id;

  // The offerer may withdraw their own pending offer; everything else is the
  // listing owner's call.
  if (decision === "CANCELLED") {
    if (!isOfferer) {
      return { ok: false, error: "Only the offerer can withdraw this offer." };
    }
    if (offer.status !== "PENDING") {
      return { ok: false, error: "That offer isn't pending anymore." };
    }
    await db.barterOffer.update({
      where: { id: offer.id },
      data: { status: "CANCELLED" },
    });
    revalidateListing(offer.listingId);
    return { ok: true };
  }

  if (!isOwner) {
    return { ok: false, error: "Only the listing owner can do that." };
  }

  if (decision === "ACCEPTED") {
    if (offer.status !== "PENDING") {
      return { ok: false, error: "That offer isn't pending anymore." };
    }
    // Only an OPEN listing can take an acceptance — otherwise a stale offer
    // could reopen a trade that's already in progress or finished.
    if (offer.listing.status !== "OPEN") {
      return {
        ok: false,
        error:
          offer.listing.status === "PENDING"
            ? "You've already accepted an offer on this listing."
            : "This listing is closed.",
      };
    }
    await db.$transaction([
      db.barterOffer.update({
        where: { id: offer.id },
        data: { status: "ACCEPTED" },
      }),
      db.barterListing.update({
        where: { id: offer.listingId },
        data: { status: "PENDING" },
      }),
    ]);
    await notify({
      userId: offer.offererId,
      actorId: user.id,
      type: "OFFER_ACCEPTED",
      payload: {
        href: `/barter/${offer.listingId}`,
        text: `${user.name} accepted your offer on "${offer.listing.title}"`,
        actorName: user.name,
      },
    });
    revalidateListing(offer.listingId);
    return { ok: true };
  }

  if (decision === "DECLINED") {
    if (offer.status !== "PENDING") {
      return { ok: false, error: "That offer isn't pending anymore." };
    }
    // Declining touches nothing but the offer — the listing stays open for
    // everyone else who made one.
    await db.barterOffer.update({
      where: { id: offer.id },
      data: { status: "DECLINED" },
    });
    await notify({
      userId: offer.offererId,
      actorId: user.id,
      type: "OFFER_DECLINED",
      payload: {
        href: `/barter/${offer.listingId}`,
        text: `${user.name} passed on your offer for "${offer.listing.title}"`,
        actorName: user.name,
      },
    });
    revalidateListing(offer.listingId);
    return { ok: true };
  }

  // COMPLETED
  if (offer.status !== "ACCEPTED") {
    return { ok: false, error: "Accept the offer before marking it complete." };
  }

  // Move credits first: settleCreditTrade throws on an insufficient balance and
  // we'd rather surface that than leave a completed trade that never paid.
  if (offer.creditAmount) {
    try {
      await settleCreditTrade({
        offerId: offer.id,
        fromUserId: offer.offererId,
        toUserId: offer.listing.ownerId,
        amount: offer.creditAmount,
      });
    } catch {
      return {
        ok: false,
        error: `${offer.offerer.name} doesn't have ${offer.creditAmount} Porch Credits right now. Nothing was changed — try again once they've earned them.`,
      };
    }
  }

  await db.$transaction([
    db.barterOffer.update({
      where: { id: offer.id },
      data: { status: "COMPLETED" },
    }),
    db.barterListing.update({
      where: { id: offer.listingId },
      data: { status: "COMPLETED" },
    }),
    // Both sides showed up for a neighbor — karma for both.
    db.user.update({
      where: { id: offer.listing.ownerId },
      data: { karma: { increment: 2 } },
    }),
    db.user.update({
      where: { id: offer.offererId },
      data: { karma: { increment: 2 } },
    }),
  ]);

  await notify({
    userId: offer.offererId,
    actorId: user.id,
    type: "SYSTEM",
    payload: {
      href: `/barter/${offer.listingId}`,
      text: offer.creditAmount
        ? `Trade complete: "${offer.listing.title}" — ${offer.creditAmount} Porch Credits sent, +2 karma`
        : `Trade complete: "${offer.listing.title}" — +2 karma`,
      actorName: user.name,
    },
  });

  revalidateListing(offer.listingId);
  revalidatePath("/barter/credits");
  revalidatePath("/profile");
  return { ok: true };
}

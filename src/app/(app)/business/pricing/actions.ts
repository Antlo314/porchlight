"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { appOrigin } from "@/lib/appUrl";
import {
  getStripe,
  paidPlansReady,
  priceIdForPlan,
  stripeConfigured,
} from "@/lib/stripe";
import { Plan } from "@/lib/validators";
import type { ActionResult } from "@/components/business/types";

export async function choosePlan(input: unknown): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = Plan.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unknown plan." };
  const plan = parsed.data;

  const business = await db.business.findFirst({
    where: { ownerId: user.id },
    select: {
      id: true,
      name: true,
      subscription: {
        select: {
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          plan: true,
        },
      },
    },
  });
  if (!business) {
    return {
      ok: false,
      error: "List your business first, then pick a plan.",
    };
  }

  if (plan === "FREE") {
    return cancelToFree({
      businessId: business.id,
      stripeSubscriptionId: business.subscription?.stripeSubscriptionId ?? null,
    });
  }

  if (!stripeConfigured() || !paidPlansReady()) {
    return {
      ok: false,
      error:
        "Paid plans aren't taking cards yet. List free for now — we'll flip this on as soon as checkout is live.",
    };
  }

  const priceId = priceIdForPlan(plan);
  if (!priceId) {
    return { ok: false, error: "That plan isn't available yet." };
  }

  try {
    const stripe = getStripe();
    const customerId = await ensureCustomer({
      businessId: business.id,
      businessName: business.name,
      userId: user.id,
      email: user.email,
      existing: business.subscription?.stripeCustomerId ?? null,
    });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appOrigin()}/business/manage?checkout=success`,
      cancel_url: `${appOrigin()}/business/pricing?checkout=cancelled`,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { businessId: business.id, userId: user.id, plan },
      },
      metadata: { businessId: business.id, userId: user.id, plan },
    });

    if (!session.url) {
      return { ok: false, error: "Stripe didn't return a checkout URL." };
    }
    return { ok: true, checkoutUrl: session.url };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("stripe checkout failed", message);
    const modeMix = /no such price/i.test(message);
    return {
      ok: false,
      error: modeMix
        ? "Stripe rejected that price — the price IDs and the secret key have to be from the same mode (both test or both live)."
        : "Couldn't start checkout. Try again in a minute.",
    };
  }
}

export async function openBillingPortal(): Promise<ActionResult> {
  const user = await requireUser();
  const business = await db.business.findFirst({
    where: { ownerId: user.id },
    select: { subscription: { select: { stripeCustomerId: true } } },
  });
  const customerId = business?.subscription?.stripeCustomerId;
  if (!customerId || !stripeConfigured()) {
    return {
      ok: false,
      error: "No card on file yet. Choose a paid plan first.",
    };
  }
  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appOrigin()}/business/manage`,
    });
    return { ok: true, portalUrl: session.url };
  } catch (err) {
    console.error("stripe portal failed", err instanceof Error ? err.message : err);
    return { ok: false, error: "Couldn't open the billing portal." };
  }
}

async function ensureCustomer(opts: {
  businessId: string;
  businessName: string;
  userId: string;
  email: string;
  existing: string | null;
}) {
  if (opts.existing) return opts.existing;
  const customer = await getStripe().customers.create({
    email: opts.email,
    name: opts.businessName,
    metadata: { businessId: opts.businessId, userId: opts.userId },
  });
  await db.subscription.upsert({
    where: { businessId: opts.businessId },
    update: { stripeCustomerId: customer.id },
    create: {
      businessId: opts.businessId,
      plan: "FREE",
      status: "ACTIVE",
      stripeCustomerId: customer.id,
    },
  });
  return customer.id;
}

async function cancelToFree(opts: {
  businessId: string;
  stripeSubscriptionId: string | null;
}): Promise<ActionResult> {
  if (opts.stripeSubscriptionId && stripeConfigured()) {
    try {
      await getStripe().subscriptions.update(opts.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    } catch (err) {
      console.error("stripe cancel failed", err instanceof Error ? err.message : err);
      return {
        ok: false,
        error: "Couldn't schedule the cancel. Try the billing portal.",
      };
    }
    revalidatePath("/business/pricing");
    revalidatePath("/business/manage");
    return { ok: true };
  }

  await db.subscription.upsert({
    where: { businessId: opts.businessId },
    update: { plan: "FREE", status: "ACTIVE", currentPeriodEnd: null },
    create: { businessId: opts.businessId, plan: "FREE", status: "ACTIVE" },
  });
  revalidatePath("/business/pricing");
  revalidatePath("/business/manage");
  revalidatePath("/services");
  revalidatePath(`/services/${opts.businessId}`);
  return { ok: true };
}



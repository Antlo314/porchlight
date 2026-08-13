"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PLAN_META, Plan } from "@/lib/validators";
import type { ActionResult } from "@/components/business/types";

const DAYS_30_MS = 30 * 24 * 60 * 60 * 1000;

/* ═══════════════════════════════════════════════════════════════════════════
 * ⚠️  TEMPORARY BILLING SHIM — NO MONEY MOVES HERE. REPLACE BEFORE LAUNCH.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Stripe keys are not configured yet, so `choosePlan` below just writes the
 * chosen plan onto Subscription and dates the period 30 days out. It collects
 * no card details and deliberately renders no fake payment UI — a checkout
 * form that doesn't charge is worse than none at all.
 *
 * WHAT TO REPLACE, EXACTLY
 * ------------------------
 * Keep: requireUser(), the Zod parse of `plan`, and the ownership lookup.
 * Replace: everything from the `db.subscription.upsert(...)` call down.
 *
 * 1. CREATE / REUSE THE CUSTOMER
 *    const sub = business.subscription;
 *    let customerId = sub?.stripeCustomerId;
 *    if (!customerId) {
 *      const customer = await stripe.customers.create({
 *        email: user.email,
 *        name: business.name,
 *        metadata: { businessId: business.id, userId: user.id },
 *      });
 *      customerId = customer.id;
 *      await db.subscription.update({
 *        where: { businessId: business.id },
 *        data: { stripeCustomerId: customerId },
 *      });
 *    }
 *
 * 2. START CHECKOUT INSTEAD OF MUTATING THE PLAN
 *    Map PlanValue -> Stripe Price id via env (STRIPE_PRICE_LOCAL_PRO,
 *    STRIPE_PRICE_FEATURED). FREE is a cancellation, not a checkout: call
 *    stripe.subscriptions.update(sub.stripeSubscriptionId,
 *      { cancel_at_period_end: true }) and return.
 *
 *    const session = await stripe.checkout.sessions.create({
 *      mode: "subscription",
 *      customer: customerId,
 *      line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
 *      success_url: `${APP_URL}/business/manage?checkout=success`,
 *      cancel_url: `${APP_URL}/business/pricing?checkout=cancelled`,
 *      subscription_data: { metadata: { businessId: business.id } },
 *    });
 *    return { ok: true, checkoutUrl: session.url };  // widen ActionResult
 *
 *    The client then does window.location.assign(checkoutUrl). Never write
 *    `plan` from the browser round-trip — Stripe is the source of truth.
 *
 * 3. HANDLE THE WEBHOOK (the only place plan/status may change)
 *    New route: src/app/api/stripe/webhook/route.ts. It must NOT use
 *    requireUser() (Stripe is the caller) and must read the raw body:
 *      const body = await req.text();
 *      const event = stripe.webhooks.constructEvent(
 *        body, req.headers.get("stripe-signature")!, STRIPE_WEBHOOK_SECRET);
 *    Handle, keyed on subscription_data.metadata.businessId:
 *      checkout.session.completed         -> store stripeSubscriptionId,
 *                                            plan, status ACTIVE,
 *                                            currentPeriodEnd
 *      customer.subscription.updated      -> plan + status + currentPeriodEnd
 *      customer.subscription.deleted      -> plan FREE, status CANCELLED
 *      invoice.payment_failed             -> status PAST_DUE
 *    Webhooks retry, so every handler must be idempotent (upsert, don't
 *    append). Also add a customer-portal action for card/cancel management:
 *    stripe.billingPortal.sessions.create({ customer, return_url }).
 *
 * 4. AD-BOOST POOL
 *    scripts/ad-boost-pool.ts sums PLAN_META prices for ACTIVE subscriptions.
 *    Once Stripe is live, swap that for actual collected revenue (Stripe
 *    Balance Transactions or your ledger) so the pool reflects money received,
 *    not money invoiced.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export async function choosePlan(input: unknown): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = Plan.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unknown plan." };
  const plan = parsed.data;

  // Ownership check: a caller may only change the plan on their own business.
  const business = await db.business.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!business) {
    return {
      ok: false,
      error: "List your business first, then pick a plan.",
    };
  }

  // ── everything below this line is what Stripe replaces ──────────────────
  const paid = PLAN_META[plan].priceMonthly > 0;
  const currentPeriodEnd = paid ? new Date(Date.now() + DAYS_30_MS) : null;

  await db.subscription.upsert({
    where: { businessId: business.id },
    update: { plan, status: "ACTIVE", currentPeriodEnd },
    create: {
      businessId: business.id,
      plan,
      status: "ACTIVE",
      currentPeriodEnd,
    },
  });

  revalidatePath("/business/pricing");
  revalidatePath("/business/manage");
  revalidatePath("/services");
  revalidatePath(`/services/${business.id}`);
  return { ok: true };
}

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { getStripe, planFromPriceId } from "@/lib/stripe";
import type { PlanValue } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const secret = process.env["STRIPE_WEBHOOK_SECRET"]?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret missing." }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await onCheckoutCompleted(event.data.object);
        break;
      case "customer.subscription.updated":
        await onSubscription(event.data.object, "updated");
        break;
      case "customer.subscription.deleted":
        await onSubscription(event.data.object, "deleted");
        break;
      case "invoice.payment_failed":
        await onPaymentFailed(event.data.object);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error("stripe webhook handler", event.type, err);
    return NextResponse.json({ error: "Handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function onCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== "subscription") return;
  const businessId = session.metadata?.businessId;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;
  if (!businessId || !subscriptionId) return;

  const sub = await getStripe().subscriptions.retrieve(subscriptionId);
  await applySubscription(businessId, sub, session.customer);
}

async function onSubscription(
  sub: Stripe.Subscription,
  kind: "updated" | "deleted"
) {
  const businessId =
    sub.metadata?.businessId ||
    (await businessIdFromCustomer(sub.customer));
  if (!businessId) return;

  if (kind === "deleted") {
    await db.subscription.upsert({
      where: { businessId },
      update: {
        plan: "FREE",
        status: "CANCELLED",
        stripeSubscriptionId: sub.id,
        currentPeriodEnd: null,
      },
      create: {
        businessId,
        plan: "FREE",
        status: "CANCELLED",
        stripeSubscriptionId: sub.id,
      },
    });
    return;
  }

  await applySubscription(businessId, sub, sub.customer);
}

async function onPaymentFailed(invoice: Stripe.Invoice) {
  const customer = invoice.customer;
  const businessId = await businessIdFromCustomer(customer);
  if (!businessId) return;
  await db.subscription.updateMany({
    where: { businessId },
    data: { status: "PAST_DUE" },
  });
}

async function applySubscription(
  businessId: string,
  sub: Stripe.Subscription,
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
) {
  const priceId = sub.items.data[0]?.price?.id ?? "";
  const plan: PlanValue = planFromPriceId(priceId) ?? "FREE";
  const customerId = typeof customer === "string" ? customer : customer?.id;
  const periodUnix =
    sub.items.data[0] && "current_period_end" in sub.items.data[0]
      ? Number(sub.items.data[0].current_period_end)
      : Number((sub as { current_period_end?: number }).current_period_end);
  const periodEnd =
    Number.isFinite(periodUnix) && periodUnix > 0
      ? new Date(periodUnix * 1000)
      : null;
  const status =
    sub.status === "active" || sub.status === "trialing"
      ? "ACTIVE"
      : sub.status === "past_due"
        ? "PAST_DUE"
        : "CANCELLED";

  await db.subscription.upsert({
    where: { businessId },
    update: {
      plan: status === "CANCELLED" ? "FREE" : plan,
      status,
      stripeSubscriptionId: sub.id,
      ...(customerId ? { stripeCustomerId: customerId } : {}),
      currentPeriodEnd: periodEnd,
    },
    create: {
      businessId,
      plan: status === "CANCELLED" ? "FREE" : plan,
      status,
      stripeSubscriptionId: sub.id,
      stripeCustomerId: customerId ?? null,
      currentPeriodEnd: periodEnd,
    },
  });
}

async function businessIdFromCustomer(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
) {
  const customerId = typeof customer === "string" ? customer : customer?.id;
  if (!customerId) return null;
  const row = await db.subscription.findFirst({
    where: { stripeCustomerId: customerId },
    select: { businessId: true },
  });
  return row?.businessId ?? null;
}

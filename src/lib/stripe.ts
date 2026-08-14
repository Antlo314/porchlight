import Stripe from "stripe";
import type { PlanValue } from "@/lib/validators";

function secret() {
  return process.env["STRIPE_SECRET_KEY"]?.trim() ?? "";
}

export function stripeConfigured() {
  return Boolean(secret());
}

let client: Stripe | null = null;

export function getStripe(): Stripe {
  const key = secret();
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  if (!client) {
    client = new Stripe(key, { typescript: true });
  }
  return client;
}

export function priceIdForPlan(plan: PlanValue): string {
  if (plan === "LOCAL_PRO") {
    return process.env["STRIPE_PRICE_LOCAL_PRO"]?.trim() ?? "";
  }
  if (plan === "FEATURED") {
    return process.env["STRIPE_PRICE_FEATURED"]?.trim() ?? "";
  }
  return "";
}

export function planFromPriceId(priceId: string): PlanValue | null {
  const local = process.env["STRIPE_PRICE_LOCAL_PRO"]?.trim();
  const featured = process.env["STRIPE_PRICE_FEATURED"]?.trim();
  if (local && priceId === local) return "LOCAL_PRO";
  if (featured && priceId === featured) return "FEATURED";
  return null;
}

export function paidPlansReady() {
  return Boolean(
    priceIdForPlan("LOCAL_PRO") && priceIdForPlan("FEATURED")
  );
}

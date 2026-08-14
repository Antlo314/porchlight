import Stripe from "stripe";
import type { PlanValue } from "@/lib/validators";

function env(name: string) {
  return process.env[name]?.trim().replace(/[\r\n]+/g, "") ?? "";
}

/** Public Stripe Price ids — env wins, these keep checkout alive if env is blank. */
const FALLBACK_PRICE: Record<"LOCAL_PRO" | "FEATURED", string> = {
  LOCAL_PRO: "price_1U4D7zKC2ZARSJhoQIXbxCSF",
  FEATURED: "price_1U4D9UKC2ZARSJhojRfFkJP6",
};

function secret() {
  return env("STRIPE_SECRET_KEY");
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
    return env("STRIPE_PRICE_LOCAL_PRO") || FALLBACK_PRICE.LOCAL_PRO;
  }
  if (plan === "FEATURED") {
    return env("STRIPE_PRICE_FEATURED") || FALLBACK_PRICE.FEATURED;
  }
  return "";
}

export function planFromPriceId(priceId: string): PlanValue | null {
  if (priceId && priceId === priceIdForPlan("LOCAL_PRO")) return "LOCAL_PRO";
  if (priceId && priceId === priceIdForPlan("FEATURED")) return "FEATURED";
  return null;
}

export function paidPlansReady() {
  return Boolean(
    priceIdForPlan("LOCAL_PRO") && priceIdForPlan("FEATURED")
  );
}

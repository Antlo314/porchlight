"use client";

import { useState, useTransition } from "react";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  FormError,
  useToast,
} from "@/components/ui";
import { PLAN_META, Plan, type PlanValue } from "@/lib/validators";
import { choosePlan } from "@/app/(app)/business/pricing/actions";

const PLANS = Plan.options as readonly PlanValue[];

/**
 * Plan comparison cards. Paid plans open Stripe Checkout. The plan on the
 * business only changes after Stripe confirms payment via webhook.
 */
export function PlanPicker({
  currentPlan,
  hasBusiness,
  checkoutLive,
  billed,
}: {
  currentPlan: PlanValue | null;
  hasBusiness: boolean;
  checkoutLive: boolean;
  billed: boolean;
}) {
  const [choosing, setChoosing] = useState<PlanValue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const toast = useToast();

  function select(plan: PlanValue) {
    setError(null);
    setChoosing(plan);

    startTransition(async () => {
      const result = await choosePlan(plan);
      setChoosing(null);
      if (result.ok && result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }
      if (PLAN_META[plan].priceMonthly > 0) {
        const msg =
          !result.ok
            ? result.error
            : "Checkout didn't open. Refresh and try again.";
        setError(msg);
        toast(msg, "error");
        return;
      }
      if (result.ok) toast(`You're on ${PLAN_META[plan].label}`);
      else setError(result.error);
    });
  }

  return (
    <div className="space-y-3">
      <FormError>{error}</FormError>

      {PLANS.map((plan) => {
        const meta = PLAN_META[plan];
        const isCurrent = currentPlan === plan;
        const highlight = plan === "LOCAL_PRO";

        return (
          <Card
            key={plan}
            // Ring rather than a border override: Card owns `border-line`, and
            // two competing border-color utilities is a coin flip.
            className={
              isCurrent
                ? "ring-2 ring-porch-500"
                : highlight
                  ? "ring-1 ring-porch-300"
                  : undefined
            }
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold">{meta.label}</h3>
                  {isCurrent && (
                    <Badge className="bg-porch-100 text-porch-800">
                      Current
                    </Badge>
                  )}
                  {!isCurrent && highlight && (
                    <Badge className="bg-pine-500/10 text-pine-700">
                      Most popular
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-ink-soft">{meta.tagline}</p>
              </div>
              <p className="shrink-0 text-right">
                <span className="text-2xl font-bold tabular-nums">
                  ${meta.priceMonthly}
                </span>
                <span className="block text-xs text-ink-soft">
                  {meta.priceMonthly === 0 ? "forever" : "per month"}
                </span>
              </p>
            </div>

            <ul className="mt-3 space-y-1.5">
              {meta.features.map((feature) => (
                <li key={feature} className="flex gap-2 text-[15px]">
                  <span aria-hidden className="text-porch-600">
                    ✓
                  </span>
                  <span>{feature}</span>
                </li>
              ))}
              {/* No separate listing-limit row: PLAN_META.features already
                  states it for every plan, and repeating it read as a bug. */}
            </ul>

            <div className="mt-4">
              {!hasBusiness ? (
                <ButtonLink
                  href="/business/new"
                  size="lg"
                  variant={highlight ? "primary" : "secondary"}
                >
                  List your business first
                </ButtonLink>
              ) : isCurrent && (meta.priceMonthly === 0 || billed) ? (
                <Button size="lg" variant="secondary" disabled>
                  Your current plan
                </Button>
              ) : (
                <Button
                  size="lg"
                  variant={highlight ? "primary" : "secondary"}
                  disabled={choosing !== null}
                  onClick={() => select(plan)}
                >
                  {choosing === plan
                    ? meta.priceMonthly === 0
                      ? "Switching…"
                      : "Opening checkout…"
                    : meta.priceMonthly === 0
                      ? "Switch to Free"
                      : checkoutLive
                        ? `Pay $${meta.priceMonthly}/mo — ${meta.label}`
                        : `Get ${meta.label} — $${meta.priceMonthly}/mo`}
                </Button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

# Porchlight — Build Status & Roadmap

Product positioning, pricing rationale, and go-to-market live in
`STRATEGY.md`. This file tracks what exists and what's next.

## Status: feature-complete MVP, not yet deployed

`npm run build` passes clean (34 routes, zero type errors).
`npx tsx scripts/smoke-test.ts` passes all credit-ledger and barter invariants.

Demo logins (all password `porchlight1`): `demo@porchlight.app`,
`maya@porchlight.app`, `jerome@porchlight.app`.

## What's built

**Foundation** — Next.js 15 App Router, TypeScript, Tailwind v4, Prisma +
SQLite. Custom JWT sessions (jose, httpOnly cookie), bcrypt passwords,
`requireUser()` / `requireRole()` guards, route middleware. A design system at
`src/components/ui` (buttons, bottom sheets, segmented controls, filter chips,
toasts, avatars, skeletons, empty states) that every vertical builds on.

**Community feed** — posts across six types with server-rendered filtering,
composer with event fields, post detail, one-level comment threads, reactions
with optimistic updates, karma on reactions and comments, report + delete menus.

**Barter (the differentiator)** — browse with kind/category filters, create
listings (Item / Skill / Time), listing detail, full offer lifecycle
(make → accept/decline → complete), Porch Credit settlement on completion, the
credit ledger view, and a two-sided offers screen. Credits are earned, never
purchasable, never cashable out.

**Messaging** — inbox with unread counts, conversation view with grouped
bubbles and date dividers, composer with optimistic send, 4-second visibility-
aware polling, and 1:1 conversation reuse so duplicates can't accumulate.

**Business & monetization** — directory with a rotating featured rail, business
detail with verified-job reviews, owner dashboard with analytics and listing
limits by plan, the three-tier pricing page with a live Ad-Boost Pool
calculation, and `scripts/ad-boost-pool.ts` to run the monthly payout.

**Profiles, notifications, events, discovery, moderation, PWA** — public and
private profiles, notification center, events calendar with RSVPs, neighborhood
follow/discovery, a moderator report queue, and an installable PWA with
manifest, icons, and a service worker.

## Launch blockers (fix before real signups)

- **No email verification.** Nothing proves an address belongs to whoever typed
  it, so `SIGNUP_BONUS` (25 credits) can be minted per throwaway email, and the
  invite loop compounds it. Invite bonuses are now capped daily and for life
  (`INVITE_BONUS_DAILY_CAP` / `INVITE_BONUS_LIFETIME_CAP` in `src/lib/invites.ts`),
  which bounds the damage — but the real fix is a verify-email step before any
  credit is granted. **Porch Credits are the community's currency; if they can
  be manufactured, the barter economy is worth nothing.**
- **No rate limiting on `POST /api/auth/signup`.** It is public by necessity.
  Add IP + email throttling at the edge (Vercel middleware or Upstash) before
  launch.
- **Uploads write to local disk** (`public/uploads`) with no per-user quota. Fine
  for development, but a Vercel filesystem is ephemeral — uploads vanish on
  redeploy. Swap `storeImage` in `src/lib/uploads.ts` for S3/UploadThing and add
  a per-member ceiling at the same time. Every caller only sees the returned
  URL, so nothing else changes.

## Known gaps (deliberate)

- **Stripe is not connected.** Choosing a plan switches it immediately and
  charges nothing; the UI says so plainly and no card details are collected
  anywhere. `src/app/(app)/business/pricing/actions.ts` carries a comment block
  spelling out the exact swap.
- **No image uploads.** Composers accept pasted image URLs. Wire UploadThing or
  S3 presigned uploads and allowlist the host in `next.config.ts`.
- **Residency verification is manual.** Nothing self-serve sets
  `User.verifiedAt` or `Business.verifiedAt` — intentional, since verification
  is the product's integrity.
- **SQLite.** Fine for development; flip the datasource to `postgresql` for
  production (the schema is written to port cleanly).
- **Ad-Boost pool math uses invoiced, not collected, revenue.** Correct once
  Stripe lands.

## Next up

1. **Deploy.** Postgres on Neon or Supabase, deploy to Vercel, real domain.
   Nothing else matters until there's a URL to send people to.
2. **Stripe.** Checkout, customer portal, webhook → `Subscription`.
3. **Image uploads.**
4. **Calm Safety** (see STRATEGY.md) — structured incident templates, the
   person-vs-incident prompt, 14-day expiry on safety posts. This is the
   marketing wedge, not just a feature.
5. **Storm Mode** — check-in-safe roster and a resource map, toggled per
   neighborhood. Highest word-of-mouth feature in the product for Georgia.
6. **Push notifications** on top of the existing service worker.
7. **Teen job board** and the **reverse service marketplace**.

## Legal notes (not legal advice — verify before launch)

- **Never name a competitor or quote their prices in user-facing copy.**
  Describe our own pricing only. Quoting someone else's price is a falsifiable
  factual claim and the single largest legal exposure in the marketing; naming
  them invites a public company's lawyers to notice a solo founder. The full
  rule is at the top of `docs/STRATEGY.md`, and `CLAUDE.md` repeats it so it
  survives future edits.
- Don't use another company's name, branding, or trade dress anywhere.
  "Porchlight" is a working name; trademark-search before spending on branding.
- Porch Credits must never be sold for or redeemed into cash.
- Business subscriptions raise sales-tax questions in Georgia — ask an
  accountant at revenue time.
- Barter between neighbors will eventually produce a dispute. Set expectations
  in the terms and never position Porchlight as escrow or as a party to a trade.

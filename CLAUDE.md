# Porchlight

Hyperlocal community app for Georgia neighborhoods.
Working name "Porchlight" — rename is a find/replace + metadata change.

**Copy rule (legal):** user-facing text never names a competitor and never
quotes a competitor's prices. Describe our own pricing only. See
`docs/STRATEGY.md` for why.

## Commands

- `npm run dev` — dev server (http://localhost:3000)
- `npm run db:migrate` — create + apply a migration (dev branch)
- `npm run db:deploy` — apply existing migrations (production)
- `npm run db:seed` — seed GA neighborhoods + demo data
- `npm run db:reset` — wipe + re-migrate + re-seed
- `npm run build` — production build (run before declaring work done)

**Requires a database.** Postgres in dev too — point `DATABASE_URL` and
`DIRECT_URL` at a Neon dev branch (see `docs/DEPLOY.md`). There is no SQLite
fallback: matching engines is deliberate, because the previous split hid a
double-spend in the credit ledger that only Postgres would have exposed.

Demo login: `demo@porchlight.app` / `porchlight1` (also maya@ / jerome@, same password).

## Architecture

- Next.js App Router + TypeScript + Tailwind v4.
- Prisma + PostgreSQL (Neon) in dev and production. Enum-like fields are Strings and `images`/`payload` are JSON strings — both carried over from the original SQLite schema; allowed values live in `src/lib/validators.ts` (Zod) and must stay in sync with the comments in `prisma/schema.prisma`.
- Uploads: `src/lib/uploads.ts` writes to Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set, else to `.uploads/` on disk. Never write to `public/` — Next fixes that directory's file list at build time, so runtime writes 404 in production.
- Auth: custom JWT sessions (`src/lib/session.ts`, jose, httpOnly cookie), bcryptjs passwords. `requireUser()` from `src/lib/auth.ts` guards server components/actions; `src/middleware.ts` guards routes. No NextAuth.
- Porch Credits: append-only ledger (`TradeCreditEntry`); balance is always SUM(delta) via `src/lib/credits.ts`. Never add a balance column, never delete ledger rows.
- Route groups: `(auth)` = public login/signup; `(app)` = protected shell with `AppHeader` + `BottomNav` + `ToastProvider`.

## Conventions — follow these

**Mutations are server actions**, not API routes. Colocate them in an
`actions.ts` beside the route that uses them, mark `"use server"`, call
`requireUser()` first, validate input with a Zod schema from
`src/lib/validators.ts`, then `revalidatePath()`. API routes are only for auth
and for client-polled reads (e.g. new messages).

**Never re-derive shared logic.** Import it:
- `@/lib/validators` — Zod schemas *and* display metadata maps
  (`POST_TYPE_META`, `BARTER_KIND_META`, `BUSINESS_CATEGORY_META`, `PLAN_META`,
  `BARTER_CATEGORY_LABELS`, `REPORT_REASON_LABELS`)
- `@/lib/format` — `timeAgo`, `formatEventRange`, `initials`, `pluralize`, `truncate`
- `@/lib/json` — `parseImages` / `serializeImages` (never `JSON.parse` a column inline)
- `@/lib/notify` — `notify()` for every notification; it suppresses self-notifies
- `@/lib/credits` — `creditBalance()`, `settleCreditTrade()`
- `@/lib/events` — `toggleRsvp()`, `getUpcomingEvents()`

**UI comes from `@/components/ui`** — `Button`, `ButtonLink`, `Fab`, `Card`,
`CardLink`, `SectionHeading`, `Field`, `Input`, `Textarea`, `Select`,
`FormError`, `CharCount`, `Avatar`, `AvatarStack`, `Badge`, `CreditPill`,
`Stars`, `VerifiedMark`, `CountDot`, `EmptyState`, `Skeleton`, `ListSkeleton`,
`Spinner`, `Sheet`, `ConfirmSheet`, `SegmentedControl`, `ChipRow`,
`useToast`. Don't hand-roll a styled button or input.

**Design tokens only** — `porch-*`, `pine-*`, `cream`, `card`, `ink`,
`ink-soft`, `line`, `rounded-card`, `animate-slide-up|fade-in|pop`. No raw hex,
no stock Tailwind grays.

**Mobile-first, always.** Designed at 375px inside `max-w-md`; desktop just
centers the column. Tap targets ≥ 44px. Inputs stay at 16px (`text-base`) or
iOS zooms on focus. Give every list an `EmptyState`. Use `useTransition` +
optimistic state so taps feel instant.

## Docs

`docs/HANDOFF.md` — phased roadmap, pricing strategy, and product differentiators.

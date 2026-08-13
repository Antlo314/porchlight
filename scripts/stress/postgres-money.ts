/**
 * postgres-money.ts — the definitive concurrency test for the Porch Credit
 * ledger, ON POSTGRES.
 *
 *   npx tsx scripts/stress/postgres-money.ts
 *
 * WHY THIS EXISTS
 * ---------------
 * `settleCreditTrade()` in src/lib/credits.ts reads a member's balance
 * (SUM of ledger deltas), checks it covers the amount, then inserts two rows.
 * A read-then-write like that is a textbook double-spend. SQLite hid it by
 * serializing every write. Postgres READ COMMITTED does not: two concurrent
 * transactions can both read the same balance, both pass the check, and both
 * insert — and the community's currency has just been minted out of nothing.
 *
 * The current defence is a row lock: the transaction UPDATEs the spender's
 * User row *first*, which holds an exclusive row lock for the rest of the
 * transaction, so concurrent spends by the same member queue instead of race.
 * That defence has never been exercised against a real Postgres. This script
 * exercises it.
 *
 * WHAT MAKES THIS DIFFERENT FROM scripts/stress/race-credits.ts
 * -------------------------------------------------------------
 *  1. It PROVES the transactions actually overlap. A concurrency test that
 *     accidentally serializes (too few pooled connections, a client that
 *     queues) passes trivially and tells you nothing. Every gated scenario
 *     holds all N transactions open at a barrier *before* the lock point and
 *     reports how many were genuinely open at once.
 *  2. It runs a deliberately UNSAFE settle function through the identical
 *     harness as a control. If the unsafe version does NOT overspend, the
 *     harness is not reproducing the race and a pass from the safe version is
 *     worthless — the script says so loudly and fails.
 *  3. It asserts the exact success count (floor(balance / amount)), not just
 *     "not too many".
 *  4. It refuses to run against anything that looks like a live member
 *     database.
 *
 * HOW TO RUN IT
 * -------------
 * Point it at a THROWAWAY Neon branch — never a branch anyone is using.
 * This script deliberately ignores .env / .env.local: pointing at the wrong
 * database has to be a decision you make out loud, not one a stale dotenv
 * makes for you.
 *
 *   PowerShell:
 *     $env:DATABASE_URL="postgresql://...throwaway-branch..."
 *     $env:DIRECT_URL="postgresql://...throwaway-branch..."   # unpooled, preferred
 *     npx tsx scripts/stress/postgres-money.ts
 *
 *   bash:
 *     DATABASE_URL="postgresql://..." DIRECT_URL="postgresql://..." \
 *       npx tsx scripts/stress/postgres-money.ts
 *
 * Optional knobs:
 *   PGSTRESS_LEVELS=5,25,50   concurrency levels to test (default 5,25,50)
 *   PGSTRESS_CONFIRM=...      see the safety gate below; not settable in advance
 *
 * Every fixture this script creates is prefixed `pgstress-` (emails),
 * `[pgstress]` (names) or `pgstress-` (neighborhood slug), and nothing without
 * one of those prefixes is ever deleted. Fixtures are removed at the end,
 * including on failure, and any left behind by a crashed run are swept at the
 * start.
 */
import { PrismaClient } from "@prisma/client";

// ─────────────────────────────────────────────────────────────
// Constants copied from the app (kept literal on purpose — importing
// src/lib/* drags in Next-specific modules and the shared `db` singleton,
// which would read DATABASE_URL out of the schema instead of the explicit,
// audited URL this script builds).
// ─────────────────────────────────────────────────────────────

/** Copy of INVITE_BONUS_INVITER in src/lib/invites.ts. */
const INVITE_BONUS_INVITER = 15;
/** Copy of INVITE_BONUS_JOINER in src/lib/invites.ts. */
const INVITE_BONUS_JOINER = 10;
/** Copy of INVITE_BONUS_DAILY_CAP in src/lib/invites.ts. */
const INVITE_BONUS_DAILY_CAP = 3;
/** Copy of INVITE_BONUS_LIFETIME_CAP in src/lib/invites.ts. */
const INVITE_BONUS_LIFETIME_CAP = 20;

const EMAIL_PREFIX = "pgstress-";
const NAME_PREFIX = "[pgstress]";
const SLUG_PREFIX = "pgstress-";

/** Credits per simulated settlement. */
const AMOUNT = 20;

/**
 * A seeded dev branch has 3 users (prisma/seed.ts). Anything much past that is
 * either a volume-seeded branch or — the case that matters — a database with
 * real members in it.
 */
const SOFT_USER_CEILING = 25;
/** No override exists past this. Nothing this large is a throwaway branch. */
const HARD_USER_CEILING = 250;

/** Interactive transactions here queue behind a row lock; 5s is nowhere near enough. */
const TX_TIMEOUT_MS = 120_000;
const TX_MAXWAIT_MS = 120_000;
/** How long the barrier waits for all N transactions to be open before giving up. */
const GATE_TIMEOUT_MS = 20_000;

// ─────────────────────────────────────────────────────────────
// Reporting
// ─────────────────────────────────────────────────────────────

type Section = "LEDGER" | "CONTROL" | "INVITES" | "JOB_REPLIES" | "HARNESS";

type CheckResult = { section: Section; label: string; ok: boolean; detail: string };

const results: CheckResult[] = [];

function check(section: Section, label: string, ok: boolean, detail = ""): boolean {
  results.push({ section, label, ok, detail });
  const mark = ok ? "  ok  " : "  FAIL";
  console.log(`${mark} ${label}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

function note(text: string) {
  console.log(`       ${text}`);
}

function heading(text: string) {
  console.log(`\n${text}\n${"─".repeat(Math.min(text.length, 70))}`);
}

// ─────────────────────────────────────────────────────────────
// Safety gate
// ─────────────────────────────────────────────────────────────

function usageAndExit(message: string): never {
  console.error(`\nRefusing to run: ${message}\n`);
  console.error(
    [
      "This script writes to the database and creates dozens of concurrent",
      "transactions. It must be pointed at a THROWAWAY Neon branch.",
      "",
      "Create a branch in the Neon console (Branches -> New branch, from your",
      "dev branch), copy its connection strings, then:",
      "",
      "  PowerShell",
      '    $env:DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.../neondb?sslmode=require"',
      '    $env:DIRECT_URL="postgresql://user:pass@ep-xxx.../neondb?sslmode=require"',
      "    npx tsx scripts/stress/postgres-money.ts",
      "",
      "  bash",
      '    DATABASE_URL="..." DIRECT_URL="..." npx tsx scripts/stress/postgres-money.ts',
      "",
      "DIRECT_URL (the unpooled endpoint) is preferred: this test deliberately",
      "holds row locks across many simultaneous sessions, which is exactly the",
      "traffic shape a transaction pooler is worst at.",
      "",
      "Delete the branch when you are done. Never point this at production.",
    ].join("\n")
  );
  process.exit(1);
}

type Target = { url: string; hostname: string; database: string; source: string; pooled: boolean };

/**
 * Builds the connection URL the run will use, with pool settings that make
 * real concurrency possible. Prisma's default pool is small; if the pool is
 * smaller than the concurrency level the transactions queue in the *client*
 * and the race never reaches Postgres — a false pass.
 */
function resolveTarget(maxConcurrency: number): Target {
  const direct = process.env.DIRECT_URL?.trim();
  const pooled = process.env.DATABASE_URL?.trim();

  if (!pooled) {
    usageAndExit("DATABASE_URL is not set.");
  }

  const raw = direct || pooled;
  const source = direct ? "DIRECT_URL" : "DATABASE_URL";

  let hostname = "unknown";
  let database = "unknown";
  let url = raw;
  let isPooler = false;

  try {
    const parsed = new URL(raw);
    hostname = parsed.hostname;
    database = parsed.pathname.replace(/^\//, "") || "unknown";
    isPooler = /-pooler\./.test(hostname);

    // Headroom over the highest concurrency level so the client is never the
    // thing that serializes us.
    parsed.searchParams.set("connection_limit", String(maxConcurrency + 8));
    parsed.searchParams.set("pool_timeout", "120");
    parsed.searchParams.set("connect_timeout", "30");
    // Prisma's prepared statements and a transaction pooler do not mix.
    if (isPooler && !parsed.searchParams.has("pgbouncer")) {
      parsed.searchParams.set("pgbouncer", "true");
    }
    url = parsed.toString();
  } catch {
    // Unparseable but possibly still valid (some providers hand out odd
    // strings). Append params the crude way rather than refusing to run.
    const join = raw.includes("?") ? "&" : "?";
    url = `${raw}${join}connection_limit=${maxConcurrency + 8}&pool_timeout=120&connect_timeout=30`;
  }

  return { url, hostname, database, source, pooled: isPooler };
}

/**
 * Aborts unless the target database is plainly disposable.
 *
 * The override token is bound to the live hostname AND the live non-fixture
 * user count, which is what makes it impossible to skip accidentally: it
 * cannot be exported once and forgotten in a shell profile or a .env, because
 * it goes stale the moment the database it names gains or loses a member, and
 * a token copied from a colleague simply does not match your database. The two
 * hard tripwires below have no override at all.
 */
async function assertThrowawayDatabase(db: PrismaClient, target: Target) {
  const [userCount, fixtureUsers, billingRows] = await Promise.all([
    db.user.count({ where: { email: { not: { startsWith: EMAIL_PREFIX } } } }),
    db.user.count({ where: { email: { startsWith: EMAIL_PREFIX } } }),
    db.subscription.count({
      where: {
        OR: [
          { stripeCustomerId: { not: null } },
          { stripeSubscriptionId: { not: null } },
        ],
      },
    }),
  ]);

  console.log(
    `  target      ${target.hostname}/${target.database} (from ${target.source}${
      target.pooled ? ", pooled endpoint" : ""
    })`
  );
  console.log(
    `  contents    ${userCount} real user(s), ${fixtureUsers} leftover ${NAME_PREFIX} fixture(s), ${billingRows} billing record(s)`
  );

  // ── Tripwire 1: real money. No override. ──
  if (billingRows > 0) {
    usageAndExit(
      `this database holds ${billingRows} Stripe billing record(s). That is a live ` +
        "business database, not a throwaway branch. There is no override for this."
    );
  }

  // ── Tripwire 2: too many people. No override. ──
  if (userCount >= HARD_USER_CEILING) {
    usageAndExit(
      `this database holds ${userCount} users (hard limit ${HARD_USER_CEILING}). ` +
        "Nothing that size is disposable. There is no override for this."
    );
  }

  // ── Soft ceiling: override possible, but it must be minted for THIS run. ──
  if (userCount > SOFT_USER_CEILING) {
    const required = `throwaway:${target.hostname}:${userCount}`;
    const supplied = process.env.PGSTRESS_CONFIRM?.trim();
    if (supplied !== required) {
      console.error(
        `\nRefusing to run: this database holds ${userCount} users, more than the ${SOFT_USER_CEILING} ` +
          "a freshly seeded throwaway branch would have.\n"
      );
      console.error(
        [
          "If — and only if — you are certain every one of those accounts is",
          "disposable, re-run with:",
          "",
          `  PowerShell:  $env:PGSTRESS_CONFIRM=\"${required}\"`,
          `  bash:        PGSTRESS_CONFIRM='${required}' npx tsx scripts/stress/postgres-money.ts`,
          "",
          "That token names this exact host and this exact user count on purpose.",
          "It expires the moment either changes, so it cannot sit in a shell",
          "profile or a .env and silently authorise a run against a database you",
          "did not mean to touch.",
        ].join("\n")
      );
      process.exit(1);
    }
    console.log("  override    accepted (soft user-count ceiling waived for this run)");
  }
}

// ─────────────────────────────────────────────────────────────
// The barrier that proves the transactions really overlap
// ─────────────────────────────────────────────────────────────

/**
 * Every gated worker opens its transaction, then parks here until all N are
 * parked. Because nothing past this point has run yet, "N arrived" means N
 * transactions were genuinely open on the server at the same instant — which
 * is the thing a concurrency test has to establish before its result means
 * anything.
 *
 * The barrier sits BEFORE the row lock, never after: after the lock, worker 2
 * would block on worker 1's UPDATE, never arrive, and the barrier would
 * deadlock the whole run.
 */
class Gate {
  private readonly waiters: (() => void)[] = [];
  private timer: NodeJS.Timeout | undefined;
  private arrived = 0;
  released = false;
  timedOut = false;
  /** How many transactions were open at the moment the barrier let go. */
  openAtRelease = 0;

  constructor(
    private readonly target: number,
    private readonly timeoutMs: number
  ) {}

  arrive(): Promise<void> {
    if (this.released) return Promise.resolve();
    this.arrived++;
    if (this.arrived >= this.target) {
      this.release();
      return Promise.resolve();
    }
    if (!this.timer) {
      const timer = setTimeout(() => {
        this.timedOut = true;
        this.release();
      }, this.timeoutMs);
      // Don't let a stuck barrier hold the process open.
      timer.unref?.();
      this.timer = timer;
    }
    return new Promise<void>((resolve) => this.waiters.push(resolve));
  }

  private release() {
    this.released = true;
    this.openAtRelease = this.arrived;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    for (const w of this.waiters.splice(0)) w();
  }
}

/** Max number of workers whose wall-clock spans overlapped. */
function maxOverlap(spans: { start: number; end: number }[]): number {
  const events: [number, number][] = [];
  for (const s of spans) {
    events.push([s.start, 1]);
    events.push([s.end, -1]);
  }
  // Ends before starts at an equal timestamp — deliberately pessimistic.
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let cur = 0;
  let peak = 0;
  for (const [, delta] of events) {
    cur += delta;
    if (cur > peak) peak = cur;
  }
  return peak;
}

// ─────────────────────────────────────────────────────────────
// The two settle implementations
// ─────────────────────────────────────────────────────────────

type SettleOpts = {
  offerId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  gate?: Gate;
};

/**
 * FAITHFUL COPY of settleCreditTrade() from src/lib/credits.ts.
 *
 * Copied rather than imported: src/lib/credits.ts imports the shared `db`
 * singleton, which resolves DATABASE_URL through the Prisma schema and would
 * bypass the explicit, safety-gated connection this script builds. Everything
 * from the `tx.user.update` down is byte-for-byte the production logic. If
 * src/lib/credits.ts changes, change this too — a stale copy here is worse
 * than no test at all.
 */
async function settleSafe(db: PrismaClient, opts: SettleOpts) {
  const { offerId, fromUserId, toUserId, amount, gate } = opts;
  if (amount <= 0) throw new Error("Amount must be positive");

  await db.$transaction(
    async (tx) => {
      // Harness only: force the transaction open, then hold here until every
      // other worker is also open. Not part of the production path.
      await tx.$queryRaw`SELECT 1`;
      if (gate) await gate.arrive();

      // ── production logic begins ──
      await tx.user.update({
        where: { id: fromUserId },
        data: { updatedAt: new Date() },
      });

      const agg = await tx.tradeCreditEntry.aggregate({
        where: { userId: fromUserId },
        _sum: { delta: true },
      });
      if ((agg._sum.delta ?? 0) < amount) {
        throw new Error("Insufficient Porch Credits");
      }
      await tx.tradeCreditEntry.createMany({
        data: [
          { userId: fromUserId, delta: -amount, reason: "TRADE_SPENT", offerId },
          { userId: toUserId, delta: amount, reason: "TRADE_EARNED", offerId },
        ],
      });
      // ── production logic ends ──
    },
    { timeout: TX_TIMEOUT_MS, maxWait: TX_MAXWAIT_MS }
  );
}

/**
 * CONTROL — deliberately unsafe. This is settleCreditTrade() with the row
 * lock removed, i.e. exactly what the code looked like before the lock was
 * added and exactly what it degrades to if someone deletes that `tx.user.update`
 * as a pointless write.
 *
 * This is not a test of the app. It is a test of the test: if this version
 * does NOT overspend on Postgres, then the harness is not reproducing the race
 * and a clean result from settleSafe() proves nothing.
 */
async function settleUnsafe(db: PrismaClient, opts: SettleOpts) {
  const { offerId, fromUserId, toUserId, amount, gate } = opts;
  if (amount <= 0) throw new Error("Amount must be positive");

  await db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1`;
      if (gate) await gate.arrive();

      // No row lock. Read committed: everyone sees the same starting balance.
      const agg = await tx.tradeCreditEntry.aggregate({
        where: { userId: fromUserId },
        _sum: { delta: true },
      });
      if ((agg._sum.delta ?? 0) < amount) {
        throw new Error("Insufficient Porch Credits");
      }
      await tx.tradeCreditEntry.createMany({
        data: [
          { userId: fromUserId, delta: -amount, reason: "TRADE_SPENT", offerId },
          { userId: toUserId, delta: amount, reason: "TRADE_EARNED", offerId },
        ],
      });
    },
    { timeout: TX_TIMEOUT_MS, maxWait: TX_MAXWAIT_MS }
  );
}

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

const RUN_ID = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
let seq = 0;

function fixtureEmail(tag: string) {
  seq++;
  return `${EMAIL_PREFIX}${RUN_ID}-${seq}-${tag}@porchlight.test`;
}

async function makeUser(db: PrismaClient, neighborhoodId: string, tag: string) {
  return db.user.create({
    data: {
      email: fixtureEmail(tag),
      name: `${NAME_PREFIX} ${tag}`,
      passwordHash: "not-a-real-hash",
      neighborhoodId,
    },
  });
}

async function balance(db: PrismaClient, userId: string): Promise<number> {
  const agg = await db.tradeCreditEntry.aggregate({
    where: { userId },
    _sum: { delta: true },
  });
  return agg._sum.delta ?? 0;
}

/** Removes every fixture this script has ever created. Never touches anything else. */
async function cleanupFixtures(db: PrismaClient): Promise<{ users: number; hoods: number }> {
  const users = await db.user.findMany({
    where: { email: { startsWith: EMAIL_PREFIX } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);

  if (ids.length > 0) {
    const businesses = await db.business.findMany({
      where: { ownerId: { in: ids } },
      select: { id: true },
    });
    const bizIds = businesses.map((b) => b.id);
    const jobs = await db.jobRequest.findMany({
      where: { requesterId: { in: ids } },
      select: { id: true },
    });
    const jobIds = jobs.map((j) => j.id);

    if (bizIds.length > 0 || jobIds.length > 0) {
      await db.jobReply.deleteMany({
        where: { OR: [{ businessId: { in: bizIds } }, { jobId: { in: jobIds } }] },
      });
    }
    if (jobIds.length > 0) {
      await db.jobRequest.deleteMany({ where: { id: { in: jobIds } } });
    }
    if (bizIds.length > 0) {
      await db.review.deleteMany({ where: { businessId: { in: bizIds } } });
      await db.subscription.deleteMany({ where: { businessId: { in: bizIds } } });
      await db.business.deleteMany({ where: { id: { in: bizIds } } });
    }

    // Ledger rows point at BarterOffer without a cascade, so they go first.
    await db.tradeCreditEntry.deleteMany({ where: { userId: { in: ids } } });

    const listings = await db.barterListing.findMany({
      where: { ownerId: { in: ids } },
      select: { id: true },
    });
    const listingIds = listings.map((l) => l.id);
    await db.barterOffer.deleteMany({
      where: { OR: [{ offererId: { in: ids } }, { listingId: { in: listingIds } }] },
    });
    if (listingIds.length > 0) {
      await db.barterListing.deleteMany({ where: { id: { in: listingIds } } });
    }

    await db.notification.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
  }

  const hoods = await db.neighborhood.deleteMany({
    where: { slug: { startsWith: SLUG_PREFIX } },
  });

  return { users: ids.length, hoods: hoods.count };
}

// ─────────────────────────────────────────────────────────────
// Scenario 1 — the core double-spend test
// ─────────────────────────────────────────────────────────────

type Outcome = {
  successes: number;
  insufficient: number;
  otherErrors: string[];
  spenderEnd: number;
  receiverEnd: number;
  spentRows: number;
  earnedRows: number;
  openAtRelease: number;
  observedOverlap: number;
  gateTimedOut: boolean;
  ms: number;
};

function describeError(e: unknown): string {
  if (e && typeof e === "object") {
    const code = (e as { code?: unknown }).code;
    const msg = (e as { message?: unknown }).message;
    const text = typeof msg === "string" ? msg.split("\n")[0] : String(e);
    return code ? `${String(code)}: ${text}` : text;
  }
  return String(e);
}

async function runDoubleSpend(
  db: PrismaClient,
  neighborhoodId: string,
  opts: { variant: "safe" | "unsafe"; level: number; gated: boolean; fundedSpends: number }
): Promise<Outcome> {
  const { variant, level, gated, fundedSpends } = opts;
  const start = fundedSpends * AMOUNT;

  const spender = await makeUser(db, neighborhoodId, `${variant}-${level}-spender`);
  const receiver = await makeUser(db, neighborhoodId, `${variant}-${level}-receiver`);

  await db.tradeCreditEntry.create({
    data: { userId: spender.id, delta: start, reason: "ADJUSTMENT" },
  });

  const listing = await db.barterListing.create({
    data: {
      ownerId: receiver.id,
      neighborhoodId,
      kind: "SERVICE",
      title: `${NAME_PREFIX} listing ${variant}/${level}`,
      description: "concurrency fixture",
      category: "OTHER",
      creditValue: AMOUNT,
    },
  });
  const offer = await db.barterOffer.create({
    data: {
      listingId: listing.id,
      offererId: spender.id,
      message: `${NAME_PREFIX} offer`,
      creditAmount: AMOUNT,
    },
  });

  const gate = gated ? new Gate(level, GATE_TIMEOUT_MS) : undefined;
  const settle = variant === "safe" ? settleSafe : settleUnsafe;
  const spans: { start: number; end: number }[] = [];

  const t0 = Date.now();
  const settled = await Promise.allSettled(
    Array.from({ length: level }, async () => {
      const s = Date.now();
      try {
        await settle(db, {
          offerId: offer.id,
          fromUserId: spender.id,
          toUserId: receiver.id,
          amount: AMOUNT,
          gate,
        });
      } finally {
        spans.push({ start: s, end: Date.now() });
      }
    })
  );
  const ms = Date.now() - t0;

  let successes = 0;
  let insufficient = 0;
  const otherErrors: string[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") {
      successes++;
      continue;
    }
    const text = describeError(r.reason);
    if (text.includes("Insufficient Porch Credits")) insufficient++;
    else otherErrors.push(text);
  }

  const [spenderEnd, receiverEnd, spentRows, earnedRows] = await Promise.all([
    balance(db, spender.id),
    balance(db, receiver.id),
    db.tradeCreditEntry.count({ where: { userId: spender.id, reason: "TRADE_SPENT" } }),
    db.tradeCreditEntry.count({ where: { userId: receiver.id, reason: "TRADE_EARNED" } }),
  ]);

  return {
    successes,
    insufficient,
    otherErrors,
    spenderEnd,
    receiverEnd,
    spentRows,
    earnedRows,
    openAtRelease: gate?.openAtRelease ?? 0,
    observedOverlap: maxOverlap(spans),
    gateTimedOut: gate?.timedOut ?? false,
    ms,
  };
}

// ─────────────────────────────────────────────────────────────
// Scenario 2 — invite bonus caps
// ─────────────────────────────────────────────────────────────

/** FAITHFUL COPY of inviterBonusUsage() from src/lib/invites.ts. */
async function inviterBonusUsage(db: PrismaClient, inviterId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [lifetime, today] = await Promise.all([
    db.tradeCreditEntry.count({
      where: {
        userId: inviterId,
        reason: "INVITE_BONUS",
        delta: INVITE_BONUS_INVITER,
      },
    }),
    db.tradeCreditEntry.count({
      where: {
        userId: inviterId,
        reason: "INVITE_BONUS",
        delta: INVITE_BONUS_INVITER,
        createdAt: { gte: startOfDay },
      },
    }),
  ]);

  return { lifetime, today };
}

/**
 * FAITHFUL COPY of awardInviteBonus() from src/lib/invites.ts, including its
 * swallow-everything catch. Note what it does NOT have: a transaction, a lock,
 * or a unique constraint. The cap is a plain read-then-write, and this test
 * asks Postgres whether that survives a burst of simultaneous signups.
 */
async function awardInviteBonus(
  db: PrismaClient,
  opts: { inviterId: string; joinerId: string }
) {
  try {
    if (opts.inviterId === opts.joinerId) return;

    await db.tradeCreditEntry.create({
      data: {
        userId: opts.joinerId,
        delta: INVITE_BONUS_JOINER,
        reason: "INVITE_BONUS",
      },
    });

    const usage = await inviterBonusUsage(db, opts.inviterId);
    if (
      usage.lifetime >= INVITE_BONUS_LIFETIME_CAP ||
      usage.today >= INVITE_BONUS_DAILY_CAP
    ) {
      await db.notification.create({
        data: {
          userId: opts.inviterId,
          type: "SYSTEM",
          payload: JSON.stringify({
            href: "/invite",
            text: "A neighbor joined with your invite. You've hit the invite bonus cap for now, but keep sharing — the block is growing.",
          }),
        },
      });
      return;
    }

    await db.tradeCreditEntry.create({
      data: {
        userId: opts.inviterId,
        delta: INVITE_BONUS_INVITER,
        reason: "INVITE_BONUS",
      },
    });
    await db.notification.create({
      data: {
        userId: opts.inviterId,
        type: "SYSTEM",
        payload: JSON.stringify({
          href: "/barter/credits",
          text: `A neighbor joined with your invite — you earned ${INVITE_BONUS_INVITER} Porch Credits.`,
        }),
      },
    });
  } catch {
    // Faithful: the real one swallows failures so a bonus can never cost
    // someone their account.
  }
}

async function inviterBonusCount(db: PrismaClient, inviterId: string) {
  return db.tradeCreditEntry.count({
    where: {
      userId: inviterId,
      reason: "INVITE_BONUS",
      delta: INVITE_BONUS_INVITER,
    },
  });
}

async function runInviteCaps(db: PrismaClient, neighborhoodId: string, burst: number) {
  // ── Daily cap under a burst of simultaneous signups ──
  const inviter = await makeUser(db, neighborhoodId, "invite-daily-inviter");
  const joiners = await Promise.all(
    Array.from({ length: burst }, (_, i) =>
      makeUser(db, neighborhoodId, `invite-daily-joiner-${i}`)
    )
  );

  await Promise.all(
    joiners.map((j) =>
      awardInviteBonus(db, { inviterId: inviter.id, joinerId: j.id })
    )
  );

  const dailyPaid = await inviterBonusCount(db, inviter.id);
  const inviterCredits = await balance(db, inviter.id);
  note(
    `${burst} simultaneous signups against one code -> inviter was paid ${dailyPaid} bonus(es) (${inviterCredits} credits); cap is ${INVITE_BONUS_DAILY_CAP}`
  );
  check(
    "INVITES",
    `daily invite cap holds under ${burst} simultaneous signups`,
    dailyPaid <= INVITE_BONUS_DAILY_CAP,
    `${dailyPaid} bonuses paid against a cap of ${INVITE_BONUS_DAILY_CAP} — ` +
      `${(dailyPaid - INVITE_BONUS_DAILY_CAP) * INVITE_BONUS_INVITER} credits minted past the cap, per code, per day`
  );

  // The joiner half is uncapped by design — but it must be paid exactly once
  // per joiner, or the burst is duplicating grants too.
  const joinerRows = await db.tradeCreditEntry.count({
    where: {
      userId: { in: joiners.map((j) => j.id) },
      reason: "INVITE_BONUS",
      delta: INVITE_BONUS_JOINER,
    },
  });
  check(
    "INVITES",
    "each joiner was paid their bonus exactly once",
    joinerRows === burst,
    `${joinerRows} rows for ${burst} joiners`
  );

  // ── Lifetime cap, approached from one below ──
  // Backdated so the daily cap is not what's binding: today = 0, lifetime = 19,
  // so exactly one more bonus is owed and no more.
  const veteran = await makeUser(db, neighborhoodId, "invite-lifetime-inviter");
  const priorCount = INVITE_BONUS_LIFETIME_CAP - 1;
  await db.tradeCreditEntry.createMany({
    data: Array.from({ length: priorCount }, (_, i) => ({
      userId: veteran.id,
      delta: INVITE_BONUS_INVITER,
      reason: "INVITE_BONUS",
      createdAt: new Date(Date.now() - (i + 2) * 24 * 60 * 60 * 1000),
    })),
  });

  const startingLifetime = await inviterBonusCount(db, veteran.id);
  const lifetimeBurst = Math.max(10, burst);
  const lateJoiners = await Promise.all(
    Array.from({ length: lifetimeBurst }, (_, i) =>
      makeUser(db, neighborhoodId, `invite-life-joiner-${i}`)
    )
  );
  await Promise.all(
    lateJoiners.map((j) =>
      awardInviteBonus(db, { inviterId: veteran.id, joinerId: j.id })
    )
  );

  const lifetimePaid = await inviterBonusCount(db, veteran.id);
  note(
    `inviter at ${startingLifetime}/${INVITE_BONUS_LIFETIME_CAP} lifetime, hit by ${lifetimeBurst} simultaneous signups -> ended at ${lifetimePaid}`
  );
  check(
    "INVITES",
    `lifetime invite cap holds under ${lifetimeBurst} simultaneous signups`,
    lifetimePaid <= INVITE_BONUS_LIFETIME_CAP,
    `${lifetimePaid} bonuses, cap ${INVITE_BONUS_LIFETIME_CAP}`
  );
}

// ─────────────────────────────────────────────────────────────
// Scenario 3 — JobReply unique constraint
// ─────────────────────────────────────────────────────────────

async function runJobReplyRace(db: PrismaClient, neighborhoodId: string, burst: number) {
  const requester = await makeUser(db, neighborhoodId, "job-requester");
  const pro = await makeUser(db, neighborhoodId, "job-pro");

  const business = await db.business.create({
    data: {
      ownerId: pro.id,
      neighborhoodId,
      name: `${NAME_PREFIX} Pro Services`,
      category: "HOME_SERVICES",
      description: "concurrency fixture",
    },
  });
  const job = await db.jobRequest.create({
    data: {
      requesterId: requester.id,
      neighborhoodId,
      title: `${NAME_PREFIX} gutters`,
      description: "concurrency fixture",
      category: "HOME_SERVICES",
    },
  });

  // Same business, same job, N simultaneous taps — mirrors replyToJob() in
  // src/app/(app)/jobs/actions.ts, which has no pre-check and leans entirely
  // on @@unique([jobId, businessId]).
  const settled = await Promise.allSettled(
    Array.from({ length: burst }, (_, i) =>
      db.jobReply.create({
        data: {
          jobId: job.id,
          businessId: business.id,
          message: `${NAME_PREFIX} reply ${i}`,
          quoteInfo: "free estimate",
        },
      })
    )
  );

  const created = settled.filter((s) => s.status === "fulfilled").length;
  const rows = await db.jobReply.count({ where: { jobId: job.id } });
  const rejections = settled
    .filter((s): s is PromiseRejectedResult => s.status === "rejected")
    .map((s) => describeError(s.reason));
  const uniqueViolations = rejections.filter((r) => r.startsWith("P2002")).length;

  note(`${burst} simultaneous replies from one business -> ${created} created, ${rows} row(s) on the job`);
  check(
    "JOB_REPLIES",
    "one business produced exactly one reply row",
    rows === 1,
    `${rows} rows`
  );
  check(
    "JOB_REPLIES",
    "exactly one insert won the race",
    created === 1,
    `${created} inserts reported success`
  );
  check(
    "JOB_REPLIES",
    "every loser failed with a unique violation the action can translate (P2002)",
    uniqueViolations === burst - created,
    rejections.filter((r) => !r.startsWith("P2002")).slice(0, 3).join(" | ") ||
      `${uniqueViolations}/${burst - created}`
  );

  // The constraint must not over-fire: two different businesses answering the
  // same job at the same instant are both legitimate.
  const secondBusiness = await db.business.create({
    data: {
      ownerId: pro.id,
      neighborhoodId,
      name: `${NAME_PREFIX} Second Trade`,
      category: "LANDSCAPING",
      description: "concurrency fixture",
    },
  });
  const twoWay = await Promise.allSettled([
    db.jobReply.create({
      data: {
        jobId: job.id,
        businessId: secondBusiness.id,
        message: `${NAME_PREFIX} reply from the other business`,
      },
    }),
    db.jobReply.create({
      data: {
        jobId: job.id,
        businessId: secondBusiness.id,
        message: `${NAME_PREFIX} duplicate from the other business`,
      },
    }),
  ]);
  const secondCreated = twoWay.filter((s) => s.status === "fulfilled").length;
  const totalRows = await db.jobReply.count({ where: { jobId: job.id } });
  check(
    "JOB_REPLIES",
    "a different business is still free to reply to the same job",
    secondCreated === 1 && totalRows === 2,
    `${secondCreated} created, ${totalRows} total rows`
  );
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

function parseLevels(): number[] {
  const raw = process.env.PGSTRESS_LEVELS?.trim();
  if (!raw) return [5, 25, 50];
  const parsed = raw
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 2);
  if (parsed.length === 0) return [5, 25, 50];
  // A Neon compute tops out around a hundred connections; asking for more
  // would fail as connection errors and read as a false negative.
  return parsed.map((n) => Math.min(n, 100)).sort((a, b) => a - b);
}

async function main() {
  console.log("\nPorchlight — Porch Credit ledger concurrency test (PostgreSQL)\n");

  const levels = parseLevels();
  const target = resolveTarget(Math.max(...levels));

  const db = new PrismaClient({
    datasources: { db: { url: target.url } },
    log: ["warn", "error"],
  });

  try {
    await db.$connect();

    const version = await db.$queryRawUnsafe<{ v: string }[]>("SELECT version() AS v");
    const banner = version?.[0]?.v ?? "";
    console.log(`  engine      ${banner.split(",")[0] || "unknown"}`);
    if (!/postgre/i.test(banner)) {
      check(
        "HARNESS",
        "target is PostgreSQL",
        false,
        "this test only means something on Postgres"
      );
      throw new Error("Not a PostgreSQL database");
    }

    await assertThrowawayDatabase(db, target);

    const swept = await cleanupFixtures(db);
    if (swept.users > 0 || swept.hoods > 0) {
      console.log(
        `  swept       ${swept.users} user(s) and ${swept.hoods} neighborhood(s) left by an earlier run`
      );
    }

    const hood = await db.neighborhood.create({
      data: {
        slug: `${SLUG_PREFIX}${RUN_ID}`,
        name: `${NAME_PREFIX} Test Block`,
        city: "Decatur",
        county: "DeKalb",
        state: "GA",
        lat: 33.7748,
        lng: -84.2963,
      },
    });
    console.log(`  levels      ${levels.join(", ")} concurrent settlements`);

    // ── 1. The core test: the shipped implementation ──────────
    heading("1. Double-spend against the shipped settleCreditTrade (row lock)");
    console.log(
      `Each level fires N simultaneous ${AMOUNT}-credit settlements against a balance that\n` +
        "can only fund a fraction of them. Nothing may go negative, nothing may be minted,\n" +
        "and the number of successes must equal exactly what the balance could pay for.\n"
    );

    for (const level of levels) {
      // Both shapes matter. The barrier-synchronised run guarantees the race
      // window is open; the natural burst is what production traffic actually
      // looks like, where the window is narrower and a defect can hide.
      for (const gated of [true, false]) {
        const funded = Math.max(1, Math.floor(level / 5));
        const startBalance = funded * AMOUNT;
        const outcome = await runDoubleSpend(db, hood.id, {
          variant: "safe",
          level,
          gated,
          fundedSpends: funded,
        });

        const mode = gated ? "barrier-synchronised" : "natural burst";
        console.log(
          `\n  n=${level} (${mode}): balance ${startBalance}, ${level} x ${AMOUNT} attempted, ` +
            `${outcome.successes} ok / ${outcome.insufficient} refused / ${outcome.otherErrors.length} errored, ${outcome.ms}ms`
        );

        if (gated) {
          note(
            `${outcome.openAtRelease}/${level} transactions were open simultaneously at the barrier` +
              (outcome.gateTimedOut ? " (barrier timed out — see below)" : "")
          );
          check(
            "HARNESS",
            `n=${level}: the harness really ran ${level} transactions at once`,
            outcome.openAtRelease === level,
            `only ${outcome.openAtRelease} were open together; raise connection_limit or use DIRECT_URL — a pass here would be meaningless`
          );
        } else {
          note(`peak wall-clock overlap: ${outcome.observedOverlap}/${level} workers`);
        }

        check(
          "LEDGER",
          `n=${level} (${mode}): balance never went negative`,
          outcome.spenderEnd >= 0,
          `ended at ${outcome.spenderEnd}`
        );
        check(
          "LEDGER",
          `n=${level} (${mode}): credits conserved, nothing minted`,
          outcome.spenderEnd + outcome.receiverEnd === startBalance,
          `${outcome.spenderEnd} + ${outcome.receiverEnd} != ${startBalance}`
        );
        check(
          "LEDGER",
          `n=${level} (${mode}): exactly ${funded} settlement(s) succeeded — what the balance could fund`,
          outcome.successes === funded,
          `${outcome.successes} succeeded, balance could fund ${funded}`
        );
        check(
          "LEDGER",
          `n=${level} (${mode}): ledger rows match the successes (2 per settlement)`,
          outcome.spentRows === outcome.successes && outcome.earnedRows === outcome.successes,
          `${outcome.spentRows} spent / ${outcome.earnedRows} earned rows for ${outcome.successes} successes`
        );
        check(
          "LEDGER",
          `n=${level} (${mode}): losers failed cleanly on the balance check, not on infrastructure`,
          outcome.otherErrors.length === 0,
          outcome.otherErrors.slice(0, 3).join(" | ")
        );
      }
    }

    // ── 2. The control: prove the harness can see a failure ───
    heading("2. Control — the same scenario without the row lock");
    console.log(
      "This runs a deliberately unsafe settle (read balance, no lock, insert) through the\n" +
        "identical harness. It is EXPECTED to overspend. If it does not, the harness is not\n" +
        "reproducing the race and section 1 proves nothing.\n"
    );

    let controlBroke = false;

    for (const level of levels) {
      const funded = Math.max(1, Math.floor(level / 5));
      const startBalance = funded * AMOUNT;
      const outcome = await runDoubleSpend(db, hood.id, {
        variant: "unsafe",
        level,
        gated: true,
        fundedSpends: funded,
      });

      const overspent = outcome.successes > funded || outcome.spenderEnd < 0;
      if (overspent) controlBroke = true;
      const minted = Math.max(0, (outcome.successes - funded) * AMOUNT);
      console.log(
        `  n=${level}: ${outcome.successes}/${level} succeeded against a ${startBalance}-credit balance, ` +
          `spender ended at ${outcome.spenderEnd}` +
          (minted > 0 ? `, ${minted} credits spent that never existed` : "")
      );
      note(
        `${outcome.openAtRelease}/${level} open simultaneously; ${
          overspent ? "OVERSPENT as expected" : "did not overspend"
        }`
      );
    }

    check(
      "CONTROL",
      "the unsafe implementation overspends on Postgres (the race is real and this test can see it)",
      controlBroke,
      "the unsafe version did NOT overspend"
    );
    if (!controlBroke) {
      console.log("");
      console.log("  ###############################################################");
      console.log("  #  THIS RESULT IS NOT TRUSTWORTHY                             #");
      console.log("  #                                                             #");
      console.log("  #  A settle function with NO row lock at all came through      #");
      console.log("  #  clean. That means these transactions are being serialized   #");
      console.log("  #  somewhere before they reach Postgres — the client pool, a   #");
      console.log("  #  transaction pooler, or a single-connection setup.           #");
      console.log("  #                                                             #");
      console.log("  #  Section 1 passing therefore proves NOTHING about the row    #");
      console.log("  #  lock. Re-run against DIRECT_URL (the unpooled Neon          #");
      console.log("  #  endpoint) with connection_limit above the concurrency       #");
      console.log("  #  level before believing any of this.                         #");
      console.log("  ###############################################################");
      console.log("");
    }

    // ── 3. Invite bonus caps ──────────────────────────────────
    heading("3. Invite bonus caps under a burst of simultaneous signups");
    console.log(
      "awardInviteBonus() counts prior bonuses, then inserts — with no transaction, no\n" +
        "lock and no unique constraint. If simultaneous signups can slip past the cap,\n" +
        "credits can be farmed, which is the one thing the caps exist to prevent.\n"
    );
    await runInviteCaps(db, hood.id, Math.max(10, Math.min(25, Math.max(...levels))));

    // ── 4. JobReply unique constraint ─────────────────────────
    heading("4. JobReply @@unique([jobId, businessId]) under concurrent inserts");
    await runJobReplyRace(db, hood.id, Math.max(10, Math.min(25, Math.max(...levels))));
  } catch (e) {
    // Record and keep going: the summary and — far more importantly — the
    // fixture cleanup below must still run.
    check("HARNESS", "the run completed without crashing", false, describeError(e));
    console.error(e);
  } finally {
    // Fixtures go, pass or fail, crash or not.
    try {
      const removed = await cleanupFixtures(db);
      console.log(
        `\nCleanup: removed ${removed.users} fixture user(s) and ${removed.hoods} fixture neighborhood(s).`
      );
      const stragglers = await db.user.count({
        where: { email: { startsWith: EMAIL_PREFIX } },
      });
      if (stragglers > 0) {
        console.log(
          `WARNING: ${stragglers} fixture user(s) survived cleanup. Delete the branch.`
        );
      }
    } catch (e) {
      console.error(
        `\nCleanup FAILED (${describeError(e)}). This was a throwaway branch — delete it.`
      );
    } finally {
      await db.$disconnect();
    }
  }

  // ── Summary ─────────────────────────────────────────────────
  const bySection = (s: Section) => results.filter((r) => r.section === s);
  const failed = results.filter((r) => !r.ok);

  heading("Summary");
  const order: Section[] = ["HARNESS", "LEDGER", "CONTROL", "INVITES", "JOB_REPLIES"];
  const labels: Record<Section, string> = {
    HARNESS: "harness validity (did the transactions really overlap)",
    LEDGER: "credit ledger double-spend (the money path)",
    CONTROL: "control (can this test detect a broken ledger)",
    INVITES: "invite bonus caps",
    JOB_REPLIES: "job reply uniqueness",
  };
  for (const s of order) {
    const rows = bySection(s);
    if (rows.length === 0) continue;
    const bad = rows.filter((r) => !r.ok).length;
    console.log(
      `  ${bad === 0 ? "PASS" : "FAIL"}  ${labels[s]} — ${rows.length - bad}/${rows.length} checks passed`
    );
  }

  if (failed.length > 0) {
    console.log("\nFailures:");
    for (const f of failed) {
      console.log(`  - [${f.section}] ${f.label}${f.detail ? ` — ${f.detail}` : ""}`);
    }
  }

  const ledgerBad = bySection("LEDGER").some((r) => !r.ok);
  const harnessBad =
    bySection("HARNESS").some((r) => !r.ok) || bySection("CONTROL").some((r) => !r.ok);

  console.log("");
  if (failed.length === 0) {
    console.log(
      "RESULT: PASS — the row lock in src/lib/credits.ts holds under real Postgres concurrency."
    );
  } else {
    console.log(`RESULT: FAIL — ${failed.length} check(s) failed.`);
    if (ledgerBad) {
      console.log(
        "        The credit ledger is the currency of the barter economy. Treat a failure here as a stop-ship."
      );
    }
    if (harnessBad) {
      console.log(
        "        The harness itself is suspect — fix that before trusting any other line above."
      );
    }
  }
  console.log("");

  if (failed.length > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("\npostgres-money crashed:", e);
  process.exit(1);
});

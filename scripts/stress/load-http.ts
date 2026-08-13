/**
 * ============================================================================
 *  Porchlight HTTP load driver — Vercel + Neon edition
 * ============================================================================
 *
 * Logs in as a real member, then requests the pages that do the most database
 * work and reports how long they took. Written for the deployed app (Vercel
 * serverless functions in front of a Neon Postgres branch), not for a laptop.
 *
 * USAGE
 *
 *   # against a local production build (npm run build && npm start)
 *   npx tsx scripts/stress/load-http.ts
 *
 *   # find the concurrency ceiling on a deployed preview
 *   npx tsx scripts/stress/load-http.ts --base=https://<preview>.vercel.app --confirm
 *
 *   # one fixed burst instead of a ramp
 *   npx tsx scripts/stress/load-http.ts --mode=burst --concurrency=25 --requests=300
 *
 * FLAGS
 *
 *   --base=URL           target origin (default http://localhost:3000)
 *   --confirm            REQUIRED when --base is not localhost. Guardrail so
 *                        nobody points a load test at real neighbors' traffic.
 *   --mode=ramp|burst    ramp (default) steps concurrency up and finds the
 *                        ceiling; burst runs one fixed level.
 *   --stages=5,10,25,50  concurrency steps for ramp mode.
 *   --concurrency=N      burst mode only (default 20).
 *   --requests=N         burst mode only (default 200).
 *   --stage-requests=N   ramp mode: fixed request count per stage. Default
 *                        scales with the stage (6 x concurrency, min 40).
 *   --routes=/a,/b       override the route list (default: the 8 heaviest).
 *   --email=  --password=   credentials (default the demo account).
 *   --timeout=30000      per-request timeout in ms.
 *
 * ---------------------------------------------------------------------------
 *  HOW TO READ THE OUTPUT (plain English)
 * ---------------------------------------------------------------------------
 *
 * COLD START. Neon's free tier puts the database to sleep after a few minutes
 * of no traffic, and Vercel shuts idle functions down too. The very first
 * request has to wake both up, so it can take several seconds. That is normal
 * and it is NOT a bug in the app — but if you average it in with everything
 * else it looks like one. So this script measures the first request on its own,
 * reports it as "cold start", and throws it away before measuring anything
 * else. What matters:
 *   - Cold start under ~5s is expected on the free tier.
 *   - Cold start over ~10s means a real neighbor tapping a link after a quiet
 *     hour will think the app is broken. Fix by keeping the database warm
 *     (a paid Neon plan, or a scheduled ping) — not by tuning queries.
 *
 * WARM LATENCY. Everything after the warm-up is "warm" — the honest number for
 * what an active user feels. Reported as:
 *   - p50 ("typical"): half of requests were faster than this.
 *   - p95 ("bad day"): 19 out of 20 requests were faster than this. This is the
 *     number that decides whether the app feels fast, because everybody hits
 *     the slow 5% eventually.
 *   - max: the single worst request.
 * Target: p95 under 1000ms. Anything over that is flagged with a warning.
 *
 * THE CONCURRENCY RAMP. Serverless is the tricky part. Every simultaneous
 * visitor can spin up a separate function instance, and every instance opens
 * its own database connection. Postgres only accepts so many. So the app is
 * fine at 5 visitors, fine at 10, and then somewhere above that latency spikes
 * or requests start failing outright, because new functions are queueing for a
 * connection that does not exist.
 *
 * The ramp steps concurrency up (5 -> 10 -> 25 -> 50) and watches for that
 * knee. What you want to see:
 *   - Latency roughly flat as concurrency doubles, and throughput (req/s)
 *     roughly doubling with it. That means there is headroom.
 * What means trouble:
 *   - p95 jumping 3x or more between two stages, or
 *   - throughput refusing to grow when concurrency doubles, or
 *   - errors appearing at all (especially 500s that mention connections).
 * The stage where that first happens is your CONNECTION-POOL CEILING: roughly
 * how many people can be tapping around the app at the same instant before it
 * degrades. If that number is lower than the crowd you expect on launch day,
 * the fix is connection pooling — use the Neon POOLED connection string
 * (the `-pooler` host) as DATABASE_URL, and keep the direct one as DIRECT_URL
 * for migrations only.
 *
 * ERRORS. Any response that isn't 200 is listed with its status code:
 *   - 307/302 to /login  the session cookie was rejected. Not a speed problem,
 *                        a login problem — the results below it are worthless.
 *   - 401/403            Vercel Deployment Protection is on for this URL.
 *   - 500                the app threw. Check the Vercel function logs.
 *   - 504                the request ran past the function timeout, almost
 *                        always waiting on the database.
 * Error rate should be 0.0%. Anything above ~1% under load is a failing result.
 *
 * ---------------------------------------------------------------------------
 * Notes for whoever maintains this:
 *  - No dependencies. Node's built-in fetch only.
 *  - Point it at a PRODUCTION build. `next dev` measures the compiler.
 *  - Point it at a THROWAWAY Neon branch. It only reads, but it will happily
 *    burn through a free-tier compute quota.
 *  - The session cookie is `Secure` in production, so a cookie jar over plain
 *    http would silently drop it. We capture the Set-Cookie header from
 *    /api/auth/login and attach it by hand on every request instead.
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);

function flag(name: string): boolean {
  return argv.includes(`--${name}`);
}

function str(name: string, fallback: string): string {
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const i = argv.indexOf(`--${name}`);
  // Only treat the next token as a value if it isn't another flag.
  if (i !== -1 && argv[i + 1] && !argv[i + 1].startsWith("--")) return argv[i + 1];
  return fallback;
}

function num(name: string, fallback: number): number {
  const raw = str(name, "");
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    fail(`--${name} must be a positive number (got "${raw}")`);
  }
  return n;
}

function fail(message: string): never {
  console.error(`\n  ERROR  ${message}\n`);
  process.exit(1);
}

const BASE = str("base", "http://localhost:3000").replace(/\/+$/, "");
const MODE = str("mode", "ramp");
const EMAIL = str("email", "demo@porchlight.app");
const PASSWORD = str("password", "porchlight1");
const TIMEOUT_MS = num("timeout", 30_000);

if (MODE !== "ramp" && MODE !== "burst") {
  fail(`--mode must be "ramp" or "burst" (got "${MODE}")`);
}

function parseBase(raw: string): URL {
  try {
    return new URL(raw);
  } catch {
    fail(`--base is not a valid URL: "${raw}"`);
  }
}

const baseUrl = parseBase(BASE);
if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") {
  fail(`--base must be http:// or https:// (got "${baseUrl.protocol}")`);
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0"]);
const isLocal = LOCAL_HOSTS.has(baseUrl.hostname);

// Guardrail: a load test aimed at the live app is indistinguishable from an
// outage for the people using it. Make hitting a remote host deliberate.
if (!isLocal && !flag("confirm")) {
  fail(
    `--base points at a remote host (${baseUrl.hostname}).\n` +
      `         Load-testing a live deployment slows the app down for real neighbors\n` +
      `         and burns Neon compute quota.\n\n` +
      `         Use a THROWAWAY preview deployment backed by a throwaway Neon branch,\n` +
      `         then re-run with --confirm to acknowledge:\n\n` +
      `           npx tsx scripts/stress/load-http.ts --base=${BASE} --confirm`
  );
}

const STAGES = str("stages", "5,10,25,50")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => {
    const n = Number(s);
    if (!Number.isInteger(n) || n <= 0) fail(`--stages must be positive integers (got "${s}")`);
    return n;
  });
if (STAGES.length === 0) fail("--stages must list at least one concurrency level");

const BURST_CONCURRENCY = Math.round(num("concurrency", 20));
const BURST_REQUESTS = Math.round(num("requests", 200));
const STAGE_REQUESTS_OVERRIDE = Math.round(num("stage-requests", 0));

/**
 * Routes that actually touch the database on render. Deliberately excludes
 * static-ish pages: this test exists to find database ceilings, and padding it
 * with cheap routes only makes the averages look better than the app is.
 */
const ROUTES = str(
  "routes",
  [
    "/feed", // neighborhood posts + authors + comment counts
    "/barter", // active listings + owners + credit prices
    "/barter/wants", // open wants
    "/barter/matches", // the matching engine — the heaviest read in the app
    "/services", // business directory + ratings
    "/jobs", // job-request marketplace + bids
    "/messages", // conversations + last message + unread counts
    "/notifications", // notification fan-in
  ].join(",")
)
  .split(",")
  .map((r) => r.trim())
  .filter(Boolean);

if (ROUTES.length === 0) fail("--routes must list at least one path");

const SLOW_P95_MS = 1000;

// ---------------------------------------------------------------------------
// Stats helpers
// ---------------------------------------------------------------------------

type Sample = { route: string; ms: number; ttfb: number; status: number };

/** Nearest-rank percentile over an ascending-sorted array. */
function pct(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sortedAsc.length);
  return sortedAsc[Math.min(sortedAsc.length - 1, Math.max(0, rank - 1))];
}

function summarize(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  return {
    n: s.length,
    p50: Math.round(pct(s, 50)),
    p95: Math.round(pct(s, 95)),
    p99: Math.round(pct(s, 99)),
    max: Math.round(s[s.length - 1] ?? 0),
  };
}

const ms = (v: number) => `${Math.round(v)}ms`;
const secs = (v: number) => `${(v / 1000).toFixed(1)}s`;

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

type Attempt = {
  route: string;
  ms: number;
  ttfb: number;
  status: number;
  ok: boolean;
  problem?: string;
};

/**
 * One timed request. Always drains the body: Next.js streams RSC payloads, so
 * a response can have headers in 40ms and still be waiting on Postgres for the
 * next second. Time-to-first-byte is recorded separately for exactly that
 * reason — a big gap between ttfb and total means the database, not the network.
 */
async function timedGet(route: string, cookie: string): Promise<Attempt> {
  const start = performance.now();
  try {
    const res = await fetch(`${BASE}${route}`, {
      headers: { cookie, accept: "text/html" },
      redirect: "manual", // a redirect to /login must be visible, not followed
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const ttfb = performance.now() - start;
    await res.text();
    const total = performance.now() - start;

    const location = res.headers.get("location") ?? "";
    let problem: string | undefined;
    if (res.status >= 300 && res.status < 400) {
      problem = location.includes("/login")
        ? `${res.status} -> /login (session rejected)`
        : `${res.status} -> ${location || "(no location)"}`;
    } else if (res.status === 401 || res.status === 403) {
      problem = `${res.status} (deployment protection or auth?)`;
    } else if (res.status !== 200) {
      problem = `${res.status}`;
    }

    return { route, ms: total, ttfb, status: res.status, ok: !problem, problem };
  } catch (e) {
    const total = performance.now() - start;
    const err = e as Error;
    const problem =
      err.name === "TimeoutError" || err.name === "AbortError"
        ? `timeout after ${ms(TIMEOUT_MS)}`
        : `network: ${err.message}`;
    return { route, ms: total, ttfb: total, status: 0, ok: false, problem };
  }
}

/** Split a combined Set-Cookie header without breaking on `Expires=Wed, 01 ...`. */
function splitSetCookie(header: string): string[] {
  const out: string[] = [];
  let current = "";
  for (const part of header.split(",")) {
    // A new cookie always starts with `name=`; a date fragment never does.
    if (/^\s*[^=;,\s]+=/.test(part) && current) {
      out.push(current);
      current = part;
    } else {
      current = current ? `${current},${part}` : part;
    }
  }
  if (current) out.push(current);
  return out;
}

/**
 * Authenticate and return a ready-to-send Cookie header value.
 *
 * We do NOT use a cookie jar. In production the session cookie is set with
 * `Secure`, and jar implementations correctly refuse to replay a Secure cookie
 * over anything they consider insecure — which silently turns every subsequent
 * request into an unauthenticated 307 that looks blazingly fast. Reading the
 * header ourselves keeps that failure impossible.
 */
async function login(): Promise<{ cookie: string; ms: number }> {
  const start = performance.now();
  // The cold-start login is the one request that may legitimately take tens of
  // seconds, so it gets a floor of 60s regardless of --timeout.
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    redirect: "manual",
    signal: AbortSignal.timeout(Math.max(TIMEOUT_MS, 60_000)),
  }).catch((e: Error) =>
    fail(
      `could not reach ${BASE}/api/auth/login — ${e.message}\n` +
        `         Is the server running, and is --base correct?`
    )
  );
  const elapsed = performance.now() - start;

  if (res.status === 401) {
    fail(
      `login rejected for ${EMAIL}. Seed the target database (npm run db:seed)\n` +
        `         or pass --email= and --password= for an account that exists there.`
    );
  }
  if (!res.ok) {
    fail(
      `login failed: HTTP ${res.status}. If this is a Vercel preview URL, check\n` +
        `         whether Deployment Protection is blocking unauthenticated requests.`
    );
  }

  // Node exposes Headers.getSetCookie() (18.14+); fall back to parsing the
  // combined header on anything older rather than dropping the session.
  const getSetCookie = (res.headers as unknown as { getSetCookie?: () => string[] })
    .getSetCookie;
  const raw =
    typeof getSetCookie === "function"
      ? getSetCookie.call(res.headers)
      : splitSetCookie(res.headers.get("set-cookie") ?? "");

  const cookie = raw
    .map((c) => c.split(";")[0].trim())
    .find((c) => c.startsWith("porchlight_session="));

  if (!cookie) {
    fail(
      `login returned ${res.status} but no porchlight_session cookie.\n` +
        `         Check AUTH_SECRET is set on the target deployment.`
    );
  }
  return { cookie, ms: elapsed };
}

// ---------------------------------------------------------------------------
// Load stages
// ---------------------------------------------------------------------------

type StageResult = {
  concurrency: number;
  samples: Sample[];
  problems: Map<string, number>;
  wallMs: number;
};

/**
 * Fire `total` requests round-robin across the routes, keeping exactly
 * `concurrency` of them in flight at once.
 */
async function runStage(
  concurrency: number,
  total: number,
  cookie: string
): Promise<StageResult> {
  const samples: Sample[] = [];
  const problems = new Map<string, number>();
  let issued = 0;
  const started = performance.now();

  async function worker() {
    for (;;) {
      const n = issued++;
      if (n >= total) return;
      const route = ROUTES[n % ROUTES.length];
      const a = await timedGet(route, cookie);
      samples.push({ route: a.route, ms: a.ms, ttfb: a.ttfb, status: a.status });
      if (!a.ok && a.problem) {
        const key = `${a.route} -> ${a.problem}`;
        problems.set(key, (problems.get(key) ?? 0) + 1);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker));
  return { concurrency, samples, problems, wallMs: performance.now() - started };
}

function okSamples(r: StageResult) {
  return r.samples.filter((s) => s.status === 200);
}

function errorCount(r: StageResult) {
  let n = 0;
  for (const c of r.problems.values()) n += c;
  return n;
}

function errorRate(r: StageResult) {
  return r.samples.length === 0 ? 0 : (errorCount(r) / r.samples.length) * 100;
}

function throughput(r: StageResult) {
  return r.wallMs === 0 ? 0 : r.samples.length / (r.wallMs / 1000);
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function reportPerRoute(samples: Sample[]): string[] {
  const warnings: string[] = [];
  console.log("\n  Per route — warm requests only");
  console.log(
    `    ${"route".padEnd(18)} ${"p50".padStart(8)} ${"p95".padStart(8)} ${"max".padStart(8)}   n`
  );
  for (const route of ROUTES) {
    const rs = samples.filter((s) => s.route === route && s.status === 200).map((s) => s.ms);
    if (rs.length === 0) {
      console.log(`    ${route.padEnd(18)} ${"—".padStart(8)} ${"—".padStart(8)} ${"—".padStart(8)}   0  (no successful responses)`);
      continue;
    }
    const st = summarize(rs);
    const slow = st.p95 > SLOW_P95_MS;
    if (slow) warnings.push(`${route} p95 ${ms(st.p95)}`);
    console.log(
      `    ${route.padEnd(18)} ${ms(st.p50).padStart(8)} ${ms(st.p95).padStart(8)} ${ms(st.max).padStart(8)}   ${st.n}${slow ? "   <-- SLOW (over 1s at p95)" : ""}`
    );
  }
  return warnings;
}

function reportProblems(problems: Map<string, number>) {
  if (problems.size === 0) return;
  console.log("\n  Non-200 responses");
  const rows = [...problems.entries()].sort((a, b) => b[1] - a[1]);
  for (const [key, count] of rows.slice(0, 15)) {
    console.log(`    ${String(count).padStart(5)} x  ${key}`);
  }
  if (rows.length > 15) console.log(`    ... and ${rows.length - 15} more distinct failures`);
}

function mergeProblems(into: Map<string, number>, from: Map<string, number>) {
  for (const [k, v] of from) into.set(k, (into.get(k) ?? 0) + v);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("");
  console.log("  Porchlight HTTP load test");
  console.log("  " + "=".repeat(60));
  console.log(`  target       ${BASE}${isLocal ? "  (local)" : "  (REMOTE — confirmed)"}`);
  console.log(`  mode         ${MODE}`);
  console.log(`  routes       ${ROUTES.length} database-backed pages`);
  if (MODE === "ramp") {
    console.log(`  stages       concurrency ${STAGES.join(" -> ")}`);
  } else {
    console.log(`  concurrency  ${BURST_CONCURRENCY}`);
    console.log(`  requests     ${BURST_REQUESTS}`);
  }
  console.log(`  account      ${EMAIL}`);

  // -- Phase 1: cold start ---------------------------------------------------
  // Nothing has touched this deployment yet, so this measures Vercel spinning
  // up a function plus Neon waking from autosuspend. Kept out of every other
  // number below.
  console.log("\n  [1/3] Cold start probe");
  const coldStart = performance.now();
  const auth = await login();
  const coldMs = performance.now() - coldStart;
  console.log(`    first request (login, DB touched)   ${ms(coldMs)}`);

  // Repeat the same call now that everything is awake. The difference between
  // the two is the wake penalty, which is infrastructure, not application code.
  const warmLogin = await login();
  const cookie = auth.cookie;
  const wakePenalty = Math.max(0, coldMs - warmLogin.ms);
  console.log(`    same request once warm             ${ms(warmLogin.ms)}`);
  console.log(`    wake penalty (cold - warm)         ${ms(wakePenalty)}`);
  if (wakePenalty > 10_000) {
    console.log(
      `    NOTE: over 10s. A neighbor opening the app after a quiet hour waits this\n` +
        `          long before anything appears. This is Neon autosuspend, not slow code.`
    );
  } else if (wakePenalty > 2_000) {
    console.log(`    NOTE: normal for a free-tier database that had gone to sleep.`);
  }

  // Sanity check the session before measuring anything, so we never publish a
  // page of beautiful latencies that were really unauthenticated redirects.
  const probe = await timedGet(ROUTES[0], cookie);
  if (!probe.ok) {
    fail(
      `authenticated probe of ${ROUTES[0]} failed: ${probe.problem}\n` +
        `         Every number after this would be measuring the wrong thing, so stopping.`
    );
  }

  // -- Phase 2: warm-up ------------------------------------------------------
  // Each route is a separate serverless function, so each has its own first-hit
  // penalty. Touch every route once and discard the timings.
  console.log("\n  [2/3] Warm-up — first hit on each route (discarded)");
  for (const route of ROUTES) {
    const a = await timedGet(route, cookie);
    const note = a.ok ? "" : `   FAILED: ${a.problem}`;
    console.log(`    ${route.padEnd(18)} ${ms(a.ms).padStart(8)}${note}`);
  }

  // -- Phase 3: measurement --------------------------------------------------
  const allSamples: Sample[] = [];
  const allProblems = new Map<string, number>();
  const stages: StageResult[] = [];

  if (MODE === "burst") {
    console.log(
      `\n  [3/3] Burst — ${BURST_REQUESTS} requests at concurrency ${BURST_CONCURRENCY}`
    );
    const r = await runStage(BURST_CONCURRENCY, BURST_REQUESTS, cookie);
    stages.push(r);
    allSamples.push(...r.samples);
    mergeProblems(allProblems, r.problems);

    const st = summarize(okSamples(r).map((s) => s.ms));
    console.log(`    completed    ${r.samples.length}/${BURST_REQUESTS} in ${secs(r.wallMs)}`);
    console.log(`    throughput   ${throughput(r).toFixed(1)} req/s`);
    console.log(`    errors       ${errorCount(r)} (${errorRate(r).toFixed(1)}%)`);
    console.log(`    p50 / p95    ${ms(st.p50)} / ${ms(st.p95)}`);
    console.log(`    p99 / max    ${ms(st.p99)} / ${ms(st.max)}`);
  } else {
    console.log("\n  [3/3] Concurrency ramp — looking for the connection-pool ceiling");
    console.log(
      `    ${"conc".padStart(5)} ${"reqs".padStart(6)} ${"req/s".padStart(7)} ${"p50".padStart(8)} ${"p95".padStart(8)} ${"max".padStart(8)} ${"errors".padStart(8)}`
    );

    for (const concurrency of STAGES) {
      const total =
        STAGE_REQUESTS_OVERRIDE > 0
          ? STAGE_REQUESTS_OVERRIDE
          : Math.max(40, concurrency * 6);
      const r = await runStage(concurrency, total, cookie);
      stages.push(r);
      allSamples.push(...r.samples);
      mergeProblems(allProblems, r.problems);

      const st = summarize(okSamples(r).map((s) => s.ms));
      const errs = errorCount(r);
      console.log(
        `    ${String(concurrency).padStart(5)} ${String(r.samples.length).padStart(6)} ${throughput(r).toFixed(1).padStart(7)} ${ms(st.p50).padStart(8)} ${ms(st.p95).padStart(8)} ${ms(st.max).padStart(8)} ${(errs === 0 ? "0" : `${errs} (${errorRate(r).toFixed(0)}%)`).padStart(8)}`
      );

      // Let queues drain and connections get released before the next step, so
      // each stage measures its own concurrency and not the previous backlog.
      await new Promise((r2) => setTimeout(r2, 2000));
    }
  }

  // -- Verdict ---------------------------------------------------------------
  console.log("\n  " + "=".repeat(60));
  console.log("  RESULTS");
  console.log("  " + "=".repeat(60));

  const warm = allSamples.filter((s) => s.status === 200);
  const overall = summarize(warm.map((s) => s.ms));
  const totalErrors = [...allProblems.values()].reduce((a, b) => a + b, 0);
  const totalRate = allSamples.length === 0 ? 0 : (totalErrors / allSamples.length) * 100;
  const totalWall = stages.reduce((a, s) => a + s.wallMs, 0);

  console.log(`\n  Warm requests   ${warm.length} of ${allSamples.length}`);
  console.log(`  Cold start      ${ms(coldMs)}  (measured once, excluded below)`);
  console.log(`  Typical (p50)   ${ms(overall.p50)}`);
  console.log(`  Bad day (p95)   ${ms(overall.p95)}`);
  console.log(`  Worst (max)     ${ms(overall.max)}`);
  console.log(
    `  Throughput      ${totalWall ? (allSamples.length / (totalWall / 1000)).toFixed(1) : "0.0"} req/s`
  );
  console.log(`  Error rate      ${totalRate.toFixed(1)}%  (${totalErrors} failed)`);

  // Headers arrive, then the page streams. A wide gap means the server was
  // still waiting on Postgres while the page was already open — that is a query
  // problem, not a network problem.
  const ttfb = summarize(warm.map((s) => s.ttfb));
  console.log(
    `  First byte p50  ${ms(ttfb.p50)}  (page then finished streaming ${ms(Math.max(0, overall.p50 - ttfb.p50))} later)`
  );

  const slowRoutes = reportPerRoute(allSamples);
  reportProblems(allProblems);

  // Where did it start to hurt?
  let ceilingNote: string | null = null;
  let ceiling: number | null = null;
  let safeCeiling: number | null = null;

  if (MODE === "ramp" && stages.length > 1) {
    console.log("\n  Scaling analysis");
    const baseStage = stages[0];
    const baseP95 = summarize(okSamples(baseStage).map((s) => s.ms)).p95 || 1;

    for (let i = 1; i < stages.length; i++) {
      const prev = stages[i - 1];
      const cur = stages[i];
      const prevP95 = summarize(okSamples(prev).map((s) => s.ms)).p95 || 1;
      const curP95 = summarize(okSamples(cur).map((s) => s.ms)).p95 || 1;
      const latencyGrowth = curP95 / prevP95;
      const throughputGrowth = throughput(prev) > 0 ? throughput(cur) / throughput(prev) : 0;
      const concurrencyGrowth = cur.concurrency / prev.concurrency;

      const bad: string[] = [];
      if (errorRate(cur) > 1) bad.push(`errors reached ${errorRate(cur).toFixed(1)}%`);
      if (curP95 > baseP95 * 3 && curP95 - baseP95 > 300) {
        bad.push(`p95 is ${(curP95 / baseP95).toFixed(1)}x the ${baseStage.concurrency}-user baseline`);
      }
      if (concurrencyGrowth >= 1.8 && throughputGrowth < 1.2) {
        bad.push(`throughput stopped growing (${throughputGrowth.toFixed(2)}x for ${concurrencyGrowth.toFixed(0)}x the load)`);
      }

      console.log(
        `    ${prev.concurrency} -> ${cur.concurrency} users:  p95 ${latencyGrowth.toFixed(2)}x, throughput ${throughputGrowth.toFixed(2)}x` +
          (bad.length ? `   <-- ${bad.join("; ")}` : "   ok")
      );

      if (bad.length && ceiling === null) {
        ceiling = cur.concurrency;
        safeCeiling = prev.concurrency;
        ceilingNote =
          `Holds up to about ${prev.concurrency} simultaneous users, then degrades ` +
          `at ${cur.concurrency} (${bad.join("; ")}).`;
      }
    }

    console.log("\n  Connection-pool ceiling");
    if (ceiling === null) {
      const top = stages[stages.length - 1].concurrency;
      console.log(
        `    None found. The app held up all the way to ${top} simultaneous users\n` +
          `    with no latency cliff and no errors. Re-run with a higher --stages to\n` +
          `    find the real limit, e.g. --stages=50,100,200`
      );
    } else {
      console.log(
        `    Around ${safeCeiling} simultaneous users is safe; it degrades by ${ceiling}.\n` +
          `    Above that, functions are queueing for database connections.\n` +
          `    Fix: set DATABASE_URL to the Neon POOLED connection string (the host\n` +
          `    with "-pooler" in it) and leave DIRECT_URL on the direct host for\n` +
          `    migrations. That is usually a one-line environment change, not a rewrite.`
      );
    }
  }

  // Plain-language bottom line.
  console.log("\n  Bottom line");
  const verdicts: string[] = [];
  if (totalErrors > 0) verdicts.push(`${totalErrors} request(s) failed — see the list above.`);
  if (overall.p95 > SLOW_P95_MS) {
    verdicts.push(`Overall p95 is ${ms(overall.p95)}, above the 1s target.`);
  }
  if (slowRoutes.length > 0) {
    verdicts.push(`Slow pages: ${slowRoutes.join(", ")}.`);
  }
  if (coldMs > 10_000) {
    verdicts.push(
      `Cold start is ${secs(coldMs)} — the first visitor after a quiet spell waits that long.`
    );
  }

  if (verdicts.length === 0) {
    console.log(
      `    HEALTHY. Every database-backed page answered in under a second at the\n` +
        `    95th percentile, with no failed requests` +
        (MODE === "ramp" && ceiling === null
          ? `, at up to\n    ${stages[stages.length - 1].concurrency} simultaneous users.`
          : ".")
    );
  } else {
    console.log("    NEEDS ATTENTION:");
    for (const v of verdicts) console.log(`      - ${v}`);
  }
  if (ceilingNote) console.log(`    Capacity: ${ceilingNote}`);
  console.log("");

  if (totalErrors > 0 || overall.p95 > SLOW_P95_MS) process.exitCode = 1;
}

main().catch((e) => {
  console.error(`\n  ERROR  ${(e as Error).stack ?? e}\n`);
  process.exit(1);
});

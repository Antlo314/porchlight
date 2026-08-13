/**
 * HTTP load driver. Authenticates once, then hammers the real routes with
 * concurrent requests and reports latency percentiles and error rates.
 *
 *   npx tsx scripts/stress/load-http.ts
 *   npx tsx scripts/stress/load-http.ts --concurrency=25 --requests=300
 *   npx tsx scripts/stress/load-http.ts --base=http://localhost:3000
 *
 * Run against a PRODUCTION build (`npm run build && npm start`), not `next dev`.
 * Dev-mode numbers measure the compiler, not the app.
 */
const args = process.argv.slice(2);
function arg(name: string, fallback: number) {
  const raw = args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  return raw ? Number(raw) : fallback;
}
const BASE =
  args.find((a) => a.startsWith("--base="))?.split("=")[1] ??
  "http://localhost:3000";
const CONCURRENCY = arg("concurrency", 20);
const REQUESTS = arg("requests", 200);

const ROUTES = [
  "/feed",
  "/feed?type=SAFETY",
  "/barter",
  "/services",
  "/messages",
  "/events",
  "/notifications",
  "/profile",
  "/neighborhood",
  "/barter/credits",
];

type Sample = { route: string; ms: number; status: number };

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i];
}

async function login(): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "demo@porchlight.app",
      password: "porchlight1",
    }),
    redirect: "manual",
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);

  const raw = res.headers.getSetCookie?.() ?? [];
  const cookie = raw
    .map((c) => c.split(";")[0])
    .find((c) => c.startsWith("porchlight_session="));
  if (!cookie) throw new Error("no session cookie returned");
  return cookie;
}

async function main() {
  console.log(`\nPorchlight HTTP load test`);
  console.log(`  target      ${BASE}`);
  console.log(`  concurrency ${CONCURRENCY}`);
  console.log(`  requests    ${REQUESTS}\n`);

  const cookie = await login();

  const samples: Sample[] = [];
  const errors: string[] = [];
  let issued = 0;

  const started = Date.now();

  async function worker() {
    while (issued < REQUESTS) {
      const n = issued++;
      const route = ROUTES[n % ROUTES.length];
      const t = Date.now();
      try {
        const res = await fetch(`${BASE}${route}`, {
          headers: { cookie },
          redirect: "manual",
        });
        await res.text(); // drain the body so streaming time is included
        const ms = Date.now() - t;
        samples.push({ route, ms, status: res.status });
        if (res.status >= 400) errors.push(`${route} -> ${res.status}`);
      } catch (e) {
        errors.push(`${route} -> ${(e as Error).message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const wall = Date.now() - started;

  const all = samples.map((s) => s.ms).sort((a, b) => a - b);
  console.log("Overall");
  console.log(`  completed   ${samples.length}/${REQUESTS}`);
  console.log(`  errors      ${errors.length}`);
  console.log(`  wall        ${(wall / 1000).toFixed(1)}s`);
  console.log(`  throughput  ${(samples.length / (wall / 1000)).toFixed(1)} req/s`);
  console.log(`  p50         ${percentile(all, 50)}ms`);
  console.log(`  p95         ${percentile(all, 95)}ms`);
  console.log(`  p99         ${percentile(all, 99)}ms`);
  console.log(`  max         ${all[all.length - 1] ?? 0}ms\n`);

  console.log("Per route (p50 / p95 / max, n)");
  for (const route of ROUTES) {
    const rs = samples
      .filter((s) => s.route === route)
      .map((s) => s.ms)
      .sort((a, b) => a - b);
    if (rs.length === 0) continue;
    const flag = percentile(rs, 95) > 1000 ? "  ⚠ slow" : "";
    console.log(
      `  ${route.padEnd(22)} ${String(percentile(rs, 50)).padStart(5)}ms ${String(
        percentile(rs, 95)
      ).padStart(6)}ms ${String(rs[rs.length - 1]).padStart(6)}ms  n=${rs.length}${flag}`
    );
  }

  if (errors.length > 0) {
    console.log("\nErrors (first 10)");
    for (const e of errors.slice(0, 10)) console.log(`  ${e}`);
  }
  console.log("");

  if (errors.length > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

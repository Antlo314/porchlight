/**
 * Simulates N members sitting in open chat windows: each polls
 * GET /api/conversations/[id]/messages?since=... every 4 seconds, exactly like
 * src/components/chat/useMessagePoll.ts does.
 *
 *   npx tsx scripts/stress/load-polling.ts --clients=150 --seconds=20
 *
 * This is the endpoint with real fan-out risk in production: unlike page loads,
 * polling is sustained for as long as a chat is on screen.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const args = process.argv.slice(2);
function arg(name: string, fallback: number) {
  const raw = args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  return raw ? Number(raw) : fallback;
}
const BASE = "http://localhost:3000";
const CLIENTS = arg("clients", 150);
const SECONDS = arg("seconds", 20);
const INTERVAL_MS = 4000;

async function login(): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "demo@porchlight.app",
      password: "porchlight1",
    }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  const cookie = (res.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .find((c) => c.startsWith("porchlight_session="));
  if (!cookie) throw new Error("no session cookie");
  return cookie;
}

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

async function main() {
  const demo = await db.user.findUniqueOrThrow({
    where: { email: "demo@porchlight.app" },
    select: { id: true },
  });
  const convos = await db.conversationParticipant.findMany({
    where: { userId: demo.id },
    select: { conversationId: true },
    take: 200,
  });
  if (convos.length === 0) throw new Error("demo user has no conversations");

  const cookie = await login();

  console.log(`\nPolling load test`);
  console.log(`  simulated open chats ${CLIENTS}`);
  console.log(`  poll interval        ${INTERVAL_MS}ms (matches useMessagePoll)`);
  console.log(`  duration             ${SECONDS}s`);
  console.log(`  conversations        ${convos.length} distinct\n`);

  const latencies: number[] = [];
  let errors = 0;
  let polls = 0;
  const stopAt = Date.now() + SECONDS * 1000;

  async function client(i: number) {
    const convoId = convos[i % convos.length].conversationId;
    // Stagger start so polls don't arrive as one synchronized thundering herd —
    // matches reality, where people open chats at different moments.
    await new Promise((r) => setTimeout(r, (i % 40) * (INTERVAL_MS / 40)));
    while (Date.now() < stopAt) {
      const since = new Date(Date.now() - 10_000).toISOString();
      const t = Date.now();
      try {
        const res = await fetch(
          `${BASE}/api/conversations/${convoId}/messages?since=${encodeURIComponent(since)}`,
          { headers: { cookie } }
        );
        await res.text();
        polls++;
        latencies.push(Date.now() - t);
        if (!res.ok) errors++;
      } catch {
        errors++;
      }
      const elapsed = Date.now() - t;
      await new Promise((r) => setTimeout(r, Math.max(0, INTERVAL_MS - elapsed)));
    }
  }

  await Promise.all(Array.from({ length: CLIENTS }, (_, i) => client(i)));

  const sorted = [...latencies].sort((a, b) => a - b);
  console.log(`  polls completed ${polls}`);
  console.log(`  errors          ${errors}`);
  console.log(`  p50             ${percentile(sorted, 50)}ms`);
  console.log(`  p95             ${percentile(sorted, 95)}ms`);
  console.log(`  p99             ${percentile(sorted, 99)}ms`);
  console.log(`  max             ${sorted[sorted.length - 1] ?? 0}ms`);
  console.log(
    errors === 0
      ? `\n✅ ${CLIENTS} concurrent open chats sustained with zero errors.\n`
      : `\n❌ ${errors} failed polls.\n`
  );
  if (errors > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

/**
 * Generates a realistic heavy dataset so list pages are measured against
 * something closer to a live neighborhood than three seeded posts.
 *
 *   npx tsx scripts/stress/seed-volume.ts          # default scale
 *   npx tsx scripts/stress/seed-volume.ts --scale=3
 *   npx tsx scripts/stress/seed-volume.ts --clean   # remove everything it made
 *
 * Everything it creates is tagged with the [load] marker so --clean can find it.
 * BACK UP prisma/dev.db BEFORE RUNNING.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const MARK = "[load]";
const args = process.argv.slice(2);
const CLEAN = args.includes("--clean");
const SCALE = Number(
  args.find((a) => a.startsWith("--scale="))?.split("=")[1] ?? 1
);

// Deterministic pseudo-random so runs are reproducible and comparable.
let seed = 1337;
function rnd() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}

const POST_TYPES = [
  "GENERAL",
  "SAFETY",
  "EVENT",
  "RECOMMENDATION",
  "LOST_FOUND",
  "FREE_STUFF",
];
const BODIES = [
  "Anyone else lose power on Boulevard last night?",
  "Free moving boxes on my porch, first come first served.",
  "Looking for a reliable dog walker for weekday afternoons.",
  "Reminder: street sweeping is Thursday, move your cars.",
  "Found a set of keys near the playground — describe them and they're yours.",
  "Does anyone have a ladder I could borrow this weekend?",
  "New coffee spot opened on Edgewood and it's genuinely good.",
  "Heads up, there's a pothole forming at the corner of Krog and Irwin.",
];

async function clean() {
  console.log("Removing all [load] fixtures…");
  const users = await db.user.findMany({
    where: { name: { startsWith: MARK } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  console.log(`  ${ids.length} generated users`);

  if (ids.length > 0) {
    // Cascades handle posts/comments/reactions/listings/messages, but the
    // ledger and offers reference users from both sides, so clear explicitly.
    await db.tradeCreditEntry.deleteMany({ where: { userId: { in: ids } } });
    await db.barterOffer.deleteMany({ where: { offererId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
  }
  await db.post.deleteMany({ where: { body: { startsWith: MARK } } });
  await db.barterListing.deleteMany({ where: { title: { startsWith: MARK } } });
  console.log("✅ Clean.");
}

async function main() {
  if (CLEAN) return clean();

  const USERS = 200 * SCALE;
  const POSTS = 1500 * SCALE;
  const COMMENTS = 4000 * SCALE;
  const LISTINGS = 400 * SCALE;
  const MESSAGES = 3000 * SCALE;

  console.log(
    `\nSeeding volume (scale ${SCALE}): ${USERS} users, ${POSTS} posts, ${COMMENTS} comments, ${LISTINGS} listings, ${MESSAGES} messages\n`
  );
  const t0 = Date.now();

  const hoods = await db.neighborhood.findMany({ select: { id: true } });
  const hoodIds = hoods.map((h) => h.id);

  // Users
  await db.user.createMany({
    data: Array.from({ length: USERS }, (_, i) => ({
      email: `load-${i}-${Date.now()}@example.test`,
      name: `${MARK} Neighbor ${i}`,
      passwordHash: "x",
      neighborhoodId: pick(hoodIds),
      karma: Math.floor(rnd() * 40),
    })),
  });
  const users = await db.user.findMany({
    where: { name: { startsWith: MARK } },
    select: { id: true, neighborhoodId: true },
  });
  console.log(`  users: ${users.length} (${Date.now() - t0}ms)`);

  // Credit grants — makes creditBalance() aggregate over real volume
  await db.tradeCreditEntry.createMany({
    data: users.flatMap((u) =>
      Array.from({ length: 3 }, () => ({
        userId: u.id,
        delta: Math.floor(rnd() * 20) + 1,
        reason: "COMMUNITY_REWARD",
      }))
    ),
  });

  // Posts
  const t1 = Date.now();
  await db.post.createMany({
    data: Array.from({ length: POSTS }, () => {
      const u = pick(users);
      return {
        authorId: u.id,
        neighborhoodId: u.neighborhoodId,
        type: pick(POST_TYPES),
        body: `${MARK} ${pick(BODIES)}`,
        createdAt: new Date(Date.now() - Math.floor(rnd() * 90 * 86_400_000)),
      };
    }),
  });
  const posts = await db.post.findMany({
    where: { body: { startsWith: MARK } },
    select: { id: true },
  });
  console.log(`  posts: ${posts.length} (${Date.now() - t1}ms)`);

  // Comments + reactions — the counts the feed aggregates per row
  const t2 = Date.now();
  await db.comment.createMany({
    data: Array.from({ length: COMMENTS }, () => ({
      postId: pick(posts).id,
      authorId: pick(users).id,
      body: `${MARK} agreed, thanks for posting this.`,
    })),
  });
  const reactionPairs = new Set<string>();
  const reactionRows: { userId: string; postId: string; kind: string }[] = [];
  for (let i = 0; i < COMMENTS; i++) {
    const u = pick(users).id;
    const p = pick(posts).id;
    const key = `${u}:${p}`;
    if (reactionPairs.has(key)) continue;
    reactionPairs.add(key);
    reactionRows.push({ userId: u, postId: p, kind: "LIKE" });
  }
  await db.reaction.createMany({ data: reactionRows });
  console.log(
    `  comments + ${reactionRows.length} reactions (${Date.now() - t2}ms)`
  );

  // Barter listings
  const t3 = Date.now();
  await db.barterListing.createMany({
    data: Array.from({ length: LISTINGS }, (_, i) => {
      const u = pick(users);
      return {
        ownerId: u.id,
        neighborhoodId: u.neighborhoodId,
        kind: pick(["GOODS", "SERVICE", "TIME"]),
        title: `${MARK} listing ${i}`,
        description: "Generated by the volume seeder.",
        category: pick(["TOOLS", "GARDEN", "SKILLS", "REPAIRS", "TUTORING"]),
        creditValue: Math.floor(rnd() * 50) + 5,
        status: "OPEN",
      };
    }),
  });
  console.log(`  listings (${Date.now() - t3}ms)`);

  // Conversations — the inbox unread query is the hottest path in the shell
  const t4 = Date.now();
  const demo = await db.user.findUnique({
    where: { email: "demo@porchlight.app" },
    select: { id: true },
  });
  const CONVOS = 60 * SCALE;
  for (let i = 0; i < CONVOS; i++) {
    const other = pick(users);
    const convo = await db.conversation.create({
      data: {
        participants: {
          create: [
            ...(demo ? [{ userId: demo.id }] : []),
            { userId: other.id },
          ],
        },
      },
    });
    await db.message.createMany({
      data: Array.from({ length: Math.ceil(MESSAGES / CONVOS) }, () => ({
        conversationId: convo.id,
        senderId: rnd() > 0.5 && demo ? demo.id : other.id,
        body: `${MARK} message body for load testing`,
      })),
    });
  }
  console.log(`  ${CONVOS} conversations + messages (${Date.now() - t4}ms)`);

  console.log(`\n✅ Volume seeded in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log("   Undo with: npx tsx scripts/stress/seed-volume.ts --clean\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

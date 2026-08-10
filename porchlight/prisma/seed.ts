import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

// Georgia launch neighborhoods — Atlanta metro first, then major cities.
const NEIGHBORHOODS = [
  { slug: "midtown-atl", name: "Midtown", city: "Atlanta", county: "Fulton", lat: 33.7838, lng: -84.3831 },
  { slug: "old-fourth-ward", name: "Old Fourth Ward", city: "Atlanta", county: "Fulton", lat: 33.7644, lng: -84.3722 },
  { slug: "grant-park", name: "Grant Park", city: "Atlanta", county: "Fulton", lat: 33.7365, lng: -84.3703 },
  { slug: "east-atlanta-village", name: "East Atlanta Village", city: "Atlanta", county: "DeKalb", lat: 33.7407, lng: -84.3438 },
  { slug: "kirkwood", name: "Kirkwood", city: "Atlanta", county: "DeKalb", lat: 33.7534, lng: -84.3269 },
  { slug: "buckhead", name: "Buckhead", city: "Atlanta", county: "Fulton", lat: 33.8388, lng: -84.3793 },
  { slug: "west-end-atl", name: "West End", city: "Atlanta", county: "Fulton", lat: 33.7365, lng: -84.4133 },
  { slug: "downtown-decatur", name: "Downtown Decatur", city: "Decatur", county: "DeKalb", lat: 33.7748, lng: -84.2963 },
  { slug: "smyrna-market-village", name: "Market Village", city: "Smyrna", county: "Cobb", lat: 33.8840, lng: -84.5144 },
  { slug: "marietta-square", name: "Marietta Square", city: "Marietta", county: "Cobb", lat: 33.9526, lng: -84.5499 },
  { slug: "roswell-historic", name: "Historic Roswell", city: "Roswell", county: "Fulton", lat: 34.0232, lng: -84.3616 },
  { slug: "alpharetta-downtown", name: "Downtown Alpharetta", city: "Alpharetta", county: "Fulton", lat: 34.0754, lng: -84.2941 },
  { slug: "sandy-springs-city", name: "City Springs", city: "Sandy Springs", county: "Fulton", lat: 33.9245, lng: -84.3785 },
  { slug: "duluth-downtown", name: "Downtown Duluth", city: "Duluth", county: "Gwinnett", lat: 34.0029, lng: -84.1446 },
  { slug: "lawrenceville-square", name: "Lawrenceville Square", city: "Lawrenceville", county: "Gwinnett", lat: 33.9562, lng: -83.9880 },
  { slug: "savannah-historic", name: "Historic District", city: "Savannah", county: "Chatham", lat: 32.0764, lng: -81.0912 },
  { slug: "savannah-starland", name: "Starland District", city: "Savannah", county: "Chatham", lat: 32.0553, lng: -81.0954 },
  { slug: "athens-five-points", name: "Five Points", city: "Athens", county: "Clarke", lat: 33.9382, lng: -83.3910 },
  { slug: "athens-normaltown", name: "Normaltown", city: "Athens", county: "Clarke", lat: 33.9645, lng: -83.4023 },
  { slug: "augusta-summerville", name: "Summerville", city: "Augusta", county: "Richmond", lat: 33.4863, lng: -82.0244 },
  { slug: "columbus-uptown", name: "Uptown", city: "Columbus", county: "Muscogee", lat: 32.4633, lng: -84.9911 },
  { slug: "macon-intown", name: "InTown", city: "Macon", county: "Bibb", lat: 32.8353, lng: -83.6329 },
];

async function main() {
  console.log("Seeding Georgia neighborhoods…");
  for (const n of NEIGHBORHOODS) {
    await db.neighborhood.upsert({
      where: { slug: n.slug },
      update: {},
      create: { ...n, state: "GA" },
    });
  }

  const o4w = await db.neighborhood.findUniqueOrThrow({
    where: { slug: "old-fourth-ward" },
  });

  console.log("Seeding demo users…");
  const passwordHash = await bcrypt.hash("porchlight1", 11);
  const [demo, maya, jerome] = await Promise.all(
    [
      { email: "demo@porchlight.app", name: "Demo Neighbor" },
      { email: "maya@porchlight.app", name: "Maya Thompson" },
      { email: "jerome@porchlight.app", name: "Jerome Wallace" },
    ].map((u) =>
      db.user.upsert({
        where: { email: u.email },
        update: {},
        create: {
          ...u,
          passwordHash,
          neighborhoodId: o4w.id,
          verifiedAt: new Date(),
        },
      })
    )
  );

  await db.tradeCreditEntry.createMany({
    data: [demo, maya, jerome].map((u) => ({
      userId: u.id,
      delta: 25,
      reason: "SIGNUP_BONUS",
    })),
  });

  console.log("Seeding posts…");
  await db.post.create({
    data: {
      authorId: maya.id,
      neighborhoodId: o4w.id,
      type: "SAFETY",
      title: "Package thief on Irwin St",
      body: "Heads up y'all — doorbell cam caught someone grabbing packages around 2pm today. Silver sedan. Report filed with APD, sharing footage if anyone needs it.",
    },
  });
  await db.post.create({
    data: {
      authorId: jerome.id,
      neighborhoodId: o4w.id,
      type: "EVENT",
      title: "O4W community garden workday",
      body: "Saturday 9am at the Freedom Park plots. Bring gloves — we've got extra tools. Kids welcome, we'll do a seed-planting table for them.",
      event: {
        create: {
          startsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          location: "Freedom Park community garden",
        },
      },
    },
  });
  await db.post.create({
    data: {
      authorId: demo.id,
      neighborhoodId: o4w.id,
      type: "RECOMMENDATION",
      body: "Anyone know a good, honest AC repair company? Mine's blowing warm air and it's August in Georgia, so… urgent. 😅",
    },
  });

  console.log("Seeding barter listings…");
  await db.barterListing.createMany({
    data: [
      {
        ownerId: jerome.id,
        neighborhoodId: o4w.id,
        kind: "GOODS",
        title: "Pressure washer (electric, 2000 PSI)",
        description: "Works great, I just upgraded. Happy to trade or take Porch Credits.",
        category: "TOOLS",
        wants: "Yard help or garden veggies",
        creditValue: 40,
      },
      {
        ownerId: maya.id,
        neighborhoodId: o4w.id,
        kind: "TIME",
        title: "2 hours of math tutoring (middle/high school)",
        description: "Former teacher, 10 years experience. Algebra through pre-calc.",
        category: "TUTORING",
        creditValue: 20,
      },
      {
        ownerId: demo.id,
        neighborhoodId: o4w.id,
        kind: "SERVICE",
        title: "I'll fix your bike",
        description: "Tune-ups, flats, brake adjustments. Parts cost extra, labor is trade.",
        category: "REPAIRS",
        wants: "Sourdough starter or fresh bread, honestly",
      },
    ],
  });

  console.log("Seeding a business…");
  const biz = await db.business.upsert({
    where: { id: "seed-biz-peachstate" },
    update: {},
    create: {
      id: "seed-biz-peachstate",
      ownerId: jerome.id,
      neighborhoodId: o4w.id,
      name: "Peach State Handyman Co.",
      category: "HOME_SERVICES",
      description: "Licensed & insured handyman serving intown Atlanta. Drywall, fixtures, fences, small electrical.",
      phone: "(404) 555-0142",
      verifiedAt: new Date(),
    },
  });
  await db.subscription.upsert({
    where: { businessId: biz.id },
    update: {},
    create: { businessId: biz.id, plan: "LOCAL_PRO", status: "ACTIVE" },
  });
  await db.serviceListing.create({
    data: {
      businessId: biz.id,
      title: "Fence repair & gate alignment",
      description: "Most repairs done same week. Free estimates.",
      priceInfo: "from $95",
    },
  });
  await db.review.upsert({
    where: { businessId_authorId: { businessId: biz.id, authorId: maya.id } },
    update: {},
    create: {
      businessId: biz.id,
      authorId: maya.id,
      rating: 5,
      body: "Fixed our sagging gate in an hour. Fair price, great communication.",
      verifiedJob: true,
    },
  });

  console.log("Seeding a conversation…");
  const convo = await db.conversation.create({
    data: {
      participants: {
        create: [{ userId: demo.id }, { userId: maya.id }],
      },
    },
  });
  await db.message.createMany({
    data: [
      {
        conversationId: convo.id,
        senderId: maya.id,
        body: "Hey! Saw your bike repair listing — still open to trades?",
      },
      {
        conversationId: convo.id,
        senderId: demo.id,
        body: "Absolutely. What did you have in mind?",
      },
    ],
  });

  console.log("✅ Seed complete. Log in as demo@porchlight.app / porchlight1");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

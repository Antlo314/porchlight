import { PrismaClient } from "@prisma/client";

const OWNER_EMAIL = "iamwhoiambook@gmail.com";
const db = new PrismaClient();

async function main() {
  const user = await db.user.findUnique({ where: { email: OWNER_EMAIL } });
  if (!user) {
    console.log(
      `No account for ${OWNER_EMAIL} yet. Sign up with that email — signup and login both pin it as Steward.`,
    );
    return;
  }
  if (user.role === "ADMIN") {
    console.log(`${OWNER_EMAIL} is already Steward (ADMIN).`);
    return;
  }
  await db.user.update({
    where: { id: user.id },
    data: { role: "ADMIN" },
  });
  console.log(`Promoted ${OWNER_EMAIL} (${user.name}) to Steward.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

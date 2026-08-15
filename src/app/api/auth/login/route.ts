import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { loginSchema } from "@/lib/validators";

export async function POST(req: NextRequest) {
  const parsed = loginSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();
  const { password } = parsed.data;

  let user;
  try {
    user = await db.user.findUnique({ where: { email } });
  } catch {
    return NextResponse.json(
      {
        error:
          "Couldn't reach the porch ledger. The database isn't connected — you can still play Light the Block as a guest.",
        offline: true,
      },
      { status: 503 }
    );
  }

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.json(
      { error: "Incorrect email or password" },
      { status: 401 }
    );
  }

  await createSession({
    userId: user.id,
    role: user.role,
    neighborhoodId: user.neighborhoodId,
  });
  return NextResponse.json({ ok: true });
}

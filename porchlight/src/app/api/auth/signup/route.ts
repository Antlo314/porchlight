import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { grantSignupBonus } from "@/lib/credits";
import { signupSchema } from "@/lib/validators";

export async function POST(req: NextRequest) {
  const parsed = signupSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const { email, password, name, neighborhoodId } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists" },
      { status: 409 }
    );
  }

  const neighborhood = await db.neighborhood.findUnique({
    where: { id: neighborhoodId },
  });
  if (!neighborhood) {
    return NextResponse.json({ error: "Unknown neighborhood" }, { status: 400 });
  }

  const user = await db.user.create({
    data: {
      email,
      name,
      neighborhoodId,
      passwordHash: await bcrypt.hash(password, 11),
    },
  });
  await grantSignupBonus(user.id);

  await createSession({
    userId: user.id,
    role: user.role,
    neighborhoodId: user.neighborhoodId,
  });
  return NextResponse.json({ ok: true });
}

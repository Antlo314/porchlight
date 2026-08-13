import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { consumePasswordReset } from "@/lib/passwordReset";
import { createSession } from "@/lib/session";
import { resetPasswordSchema } from "@/lib/validators";

export async function POST(req: NextRequest) {
  const parsed = resetPasswordSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  try {
    const user = await consumePasswordReset({
      rawToken: parsed.data.token,
      passwordHash: await bcrypt.hash(parsed.data.password, 11),
    });
    if (!user) {
      return NextResponse.json(
        { error: "That reset link is expired or already used. Request a new one." },
        { status: 400 }
      );
    }
    await createSession({
      userId: user.userId,
      role: user.role,
      neighborhoodId: user.neighborhoodId,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Couldn't update the password. Try again." },
      { status: 503 }
    );
  }
}

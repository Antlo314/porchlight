import { NextRequest, NextResponse } from "next/server";
import { mailConfigured, resetPasswordEmail, sendMail } from "@/lib/mail";
import { requestPasswordReset } from "@/lib/passwordReset";
import { forgotPasswordSchema } from "@/lib/validators";

const SAME =
  "If that email is on Porchlight, we sent a reset link. Check your inbox.";

function clientIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  const parsed = forgotPasswordSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  if (!mailConfigured()) {
    return NextResponse.json(
      { error: "Password reset email isn't set up on this deploy yet." },
      { status: 503 }
    );
  }

  try {
    const minted = await requestPasswordReset({
      email: parsed.data.email,
      ip: clientIp(req),
    });
    if ("rawToken" in minted) {
      const letter = resetPasswordEmail({
        name: minted.name,
        token: minted.rawToken,
      });
      const sent = await sendMail({
        to: parsed.data.email,
        subject: letter.subject,
        html: letter.html,
        text: letter.text,
      });
      if (!sent.ok) {
        return NextResponse.json({ error: sent.error }, { status: 503 });
      }
    }
  } catch {
    // Same copy as a miss — don't leak whether the mailbox exists.
  }

  return NextResponse.json({ ok: true, message: SAME });
}

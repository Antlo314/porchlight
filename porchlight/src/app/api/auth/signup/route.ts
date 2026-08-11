import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { grantSignupBonus } from "@/lib/credits";
import { awardInviteBonus, resolveInvite } from "@/lib/invites";
import { invitedSignupSchema, signupSchema } from "@/lib/validators";

type Account = {
  email: string;
  password: string;
  name: string;
  neighborhoodId: string;
  /** Set only for invited signups; drives the invite bonus after creation. */
  inviterId: string | null;
};

/**
 * Validates the payload and decides which neighborhood the account belongs to.
 *
 * With an invite code that neighborhood comes from the inviter's own record and
 * any client-supplied neighborhoodId is discarded, so a forged request can't
 * ride someone's invite into a neighborhood of its choosing.
 */
async function resolveSignup(
  body: unknown
): Promise<{ account: Account } | { error: NextResponse }> {
  const rawCode =
    body !== null &&
    typeof body === "object" &&
    typeof (body as { inviteCode?: unknown }).inviteCode === "string"
      ? (body as { inviteCode: string }).inviteCode.trim()
      : "";

  if (rawCode) {
    const parsed = invitedSignupSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return {
        error: NextResponse.json(
          {
            error: issue?.message ?? "Invalid input",
            // Signals the form to fall back to the neighborhood picker.
            inviteInvalid: issue?.path[0] === "inviteCode",
          },
          { status: 400 }
        ),
      };
    }

    const invite = await resolveInvite(parsed.data.inviteCode);
    if (!invite) {
      return {
        error: NextResponse.json(
          {
            error:
              "That invite link isn't working any more — pick your neighborhood instead.",
            inviteInvalid: true,
          },
          { status: 400 }
        ),
      };
    }

    return {
      account: {
        email: parsed.data.email,
        password: parsed.data.password,
        name: parsed.data.name,
        neighborhoodId: invite.neighborhoodId,
        inviterId: invite.inviterId,
      },
    };
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return {
      error: NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      ),
    };
  }

  const neighborhood = await db.neighborhood.findUnique({
    where: { id: parsed.data.neighborhoodId },
  });
  if (!neighborhood) {
    return {
      error: NextResponse.json({ error: "Unknown neighborhood" }, { status: 400 }),
    };
  }

  return {
    account: {
      email: parsed.data.email,
      password: parsed.data.password,
      name: parsed.data.name,
      neighborhoodId: parsed.data.neighborhoodId,
      inviterId: null,
    },
  };
}

export async function POST(req: NextRequest) {
  const resolved = await resolveSignup(await req.json().catch(() => null));
  if ("error" in resolved) return resolved.error;
  const { email, password, name, neighborhoodId, inviterId } = resolved.account;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists" },
      { status: 409 }
    );
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
  // The invite bonus rides on top of the signup bonus and never throws — a
  // failed bonus must not cost someone their brand-new account.
  if (inviterId) await awardInviteBonus({ inviterId, joinerId: user.id });

  await createSession({
    userId: user.id,
    role: user.role,
    neighborhoodId: user.neighborhoodId,
  });
  return NextResponse.json({ ok: true });
}

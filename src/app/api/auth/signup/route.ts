import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { authSecretConfigured, createSession } from "@/lib/session";
import { grantSignupBonus } from "@/lib/credits";
import { awardInviteBonus, resolveInvite } from "@/lib/invites";
import { isOwnerEmail } from "@/lib/staff";
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
        email: parsed.data.email.toLowerCase(),
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
      email: parsed.data.email.toLowerCase(),
      password: parsed.data.password,
      name: parsed.data.name,
      neighborhoodId: parsed.data.neighborhoodId,
      inviterId: null,
    },
  };
}

export async function POST(req: NextRequest) {
  if (!authSecretConfigured()) {
    return NextResponse.json(
      {
        error:
          "This deploy is missing AUTH_SECRET, so we can't start a session. Add it in Vercel → Settings → Environment Variables, then redeploy.",
        code: "AUTH_SECRET",
      },
      { status: 503 }
    );
  }

  try {
    const resolved = await resolveSignup(await req.json().catch(() => null));
    if ("error" in resolved) return resolved.error;
    const { email, password, name, neighborhoodId, inviterId } = resolved.account;

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with that email already exists. Try logging in." },
        { status: 409 }
      );
    }

    const user = await db.user.create({
      data: {
        email,
        name,
        neighborhoodId,
        passwordHash: await bcrypt.hash(password, 11),
        updatedAt: new Date(),
        role: isOwnerEmail(email) ? "ADMIN" : "MEMBER",
      },
    });
    try {
      await grantSignupBonus(user.id);
    } catch {
      // Account exists; bonus is best-effort so a ledger hiccup doesn't
      // look like signup failed.
    }
    if (inviterId) await awardInviteBonus({ inviterId, joinerId: user.id });

    try {
      await createSession({
        userId: user.id,
        role: user.role,
        neighborhoodId: user.neighborhoodId,
      });
    } catch {
      return NextResponse.json({
        ok: true,
        needsLogin: true,
        error: "Account created. Log in with the same email and password.",
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const prismaish = /prisma|database|connect|p1001|p2002|p2003/i.test(message);
    return NextResponse.json(
      {
        error: prismaish
          ? "Couldn't save the account. The database rejected the write."
          : "Couldn't create the account. Try logging in if you already signed up, or play as a guest.",
        code: prismaish ? "DATABASE" : "UNKNOWN",
      },
      { status: 503 }
    );
  }
}

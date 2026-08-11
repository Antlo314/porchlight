// Invite links — the growth loop.
//
// Every member gets a shareable code tied to their neighborhood. A new signup
// arriving through it lands in the right neighborhood automatically (no picker
// to get wrong) and both sides earn credits once the invitee is real.
import { randomBytes } from "node:crypto";
import { db } from "./db";

export const INVITE_BONUS_INVITER = 15;
export const INVITE_BONUS_JOINER = 10;

/**
 * Caps on the inviter's side. Without them the loop mints credits without
 * limit: sign up throwaway accounts against your own code, and each one pays
 * you 15 while handing the sock puppet 35 (signup + joiner bonus) that it can
 * then move to you through a credit-priced barter trade. Porch Credits are the
 * community's currency — if they can be manufactured, the barter economy is
 * worth nothing.
 *
 * These bounds make farming not worth the effort. They are NOT a substitute
 * for email verification, which is a launch blocker (see docs/HANDOFF.md):
 * until an address is proven, SIGNUP_BONUS is farmable on its own.
 */
export const INVITE_BONUS_DAILY_CAP = 3;
export const INVITE_BONUS_LIFETIME_CAP = 20;

// No 0/O/1/I/L — these get read aloud and hand-copied off a flyer.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function makeCode(length = 8): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** Lazily mints a code the first time a member opens their invite screen. */
export async function getOrCreateInviteCode(userId: string): Promise<string> {
  const existing = await db.user.findUnique({
    where: { id: userId },
    select: { inviteCode: true },
  });
  if (existing?.inviteCode) return existing.inviteCode;

  // Retry on the astronomically unlikely collision rather than 500 the page.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeCode();
    try {
      await db.user.update({ where: { id: userId }, data: { inviteCode: code } });
      return code;
    } catch {
      const raced = await db.user.findUnique({
        where: { id: userId },
        select: { inviteCode: true },
      });
      if (raced?.inviteCode) return raced.inviteCode;
    }
  }
  throw new Error("Could not generate an invite code");
}

export type InviteContext = {
  code: string;
  inviterId: string;
  inviterName: string;
  neighborhoodId: string;
  neighborhoodName: string;
  city: string;
};

/** Resolves a code for the signup screen. Returns null for unknown codes. */
export async function resolveInvite(
  code: string | undefined | null
): Promise<InviteContext | null> {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z2-9]{8}$/.test(normalized)) return null;

  const inviter = await db.user.findUnique({
    where: { inviteCode: normalized },
    select: {
      id: true,
      name: true,
      neighborhoodId: true,
      neighborhood: { select: { name: true, city: true } },
    },
  });
  if (!inviter) return null;

  return {
    code: normalized,
    inviterId: inviter.id,
    inviterName: inviter.name,
    neighborhoodId: inviter.neighborhoodId,
    neighborhoodName: inviter.neighborhood.name,
    city: inviter.neighborhood.city,
  };
}

/** How many inviter bonuses this member has already been paid, and when. */
async function inviterBonusUsage(inviterId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [lifetime, today] = await Promise.all([
    db.tradeCreditEntry.count({
      where: {
        userId: inviterId,
        reason: "INVITE_BONUS",
        delta: INVITE_BONUS_INVITER,
      },
    }),
    db.tradeCreditEntry.count({
      where: {
        userId: inviterId,
        reason: "INVITE_BONUS",
        delta: INVITE_BONUS_INVITER,
        createdAt: { gte: startOfDay },
      },
    }),
  ]);

  return { lifetime, today };
}

/**
 * Credits both sides after a successful signup.
 *
 * The joiner's half is always paid — it lands in their own brand-new account
 * and is no more farmable than the signup bonus itself. The inviter's half is
 * capped daily and for life, because that is the side an attacker actually
 * profits from. Never throws into the signup path: a bonus that fails must not
 * cost someone their account.
 */
export async function awardInviteBonus(opts: {
  inviterId: string;
  joinerId: string;
}) {
  try {
    // Self-invite is not a thing worth paying for.
    if (opts.inviterId === opts.joinerId) return;

    await db.tradeCreditEntry.create({
      data: {
        userId: opts.joinerId,
        delta: INVITE_BONUS_JOINER,
        reason: "INVITE_BONUS",
      },
    });

    const usage = await inviterBonusUsage(opts.inviterId);
    if (
      usage.lifetime >= INVITE_BONUS_LIFETIME_CAP ||
      usage.today >= INVITE_BONUS_DAILY_CAP
    ) {
      // Still tell them someone joined — the invite worked, the bonus is just
      // capped. Silently paying nothing would read as a bug.
      await db.notification.create({
        data: {
          userId: opts.inviterId,
          type: "SYSTEM",
          payload: JSON.stringify({
            href: "/invite",
            text: "A neighbor joined with your invite. You've hit the invite bonus cap for now, but keep sharing — the block is growing.",
          }),
        },
      });
      return;
    }

    await db.tradeCreditEntry.create({
      data: {
        userId: opts.inviterId,
        delta: INVITE_BONUS_INVITER,
        reason: "INVITE_BONUS",
      },
    });
    await db.notification.create({
      data: {
        userId: opts.inviterId,
        type: "SYSTEM",
        payload: JSON.stringify({
          href: "/barter/credits",
          text: `A neighbor joined with your invite — you earned ${INVITE_BONUS_INVITER} Porch Credits.`,
        }),
      },
    });
  } catch {
    // Bonus is best-effort; the account already exists and that matters more.
  }
}

export function inviteUrl(code: string, origin?: string): string {
  const base =
    origin ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/join/${code}`;
}

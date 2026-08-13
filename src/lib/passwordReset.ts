import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

export const RESET_TTL_MS = 30 * 60 * 1000;
export const EMAIL_HOUR_CAP = 3;
export const IP_HOUR_CAP = 10;

export function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export function hashIp(ip: string) {
  return createHash("sha256").update(ip.trim()).digest("hex").slice(0, 32);
}

export function mintRawToken() {
  return randomBytes(32).toString("base64url");
}

function hourAgo() {
  return new Date(Date.now() - 60 * 60 * 1000);
}

export async function requestPasswordReset(opts: {
  email: string;
  ip: string;
}): Promise<{ rawToken: string; name: string } | { skipped: true }> {
  const email = opts.email.trim().toLowerCase();
  const ipHash = hashIp(opts.ip || "unknown");

  const recentFromIp = await db.passwordResetToken.count({
    where: { ipHash, createdAt: { gte: hourAgo() } },
  });
  if (recentFromIp >= IP_HOUR_CAP) return { skipped: true };

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, name: true },
  });
  if (!user) return { skipped: true };

  const allowed = await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { updatedAt: new Date() },
    });
    const recent = await tx.passwordResetToken.count({
      where: { userId: user.id, createdAt: { gte: hourAgo() } },
    });
    if (recent >= EMAIL_HOUR_CAP) return false;

    const raw = mintRawToken();
    await tx.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(raw),
        ipHash,
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
      },
    });
    return raw;
  });

  if (!allowed) return { skipped: true };
  return { rawToken: allowed, name: user.name };
}

export async function consumePasswordReset(opts: {
  rawToken: string;
  passwordHash: string;
}): Promise<{ userId: string; role: string; neighborhoodId: string } | null> {
  const tokenHash = hashToken(opts.rawToken);
  return db.$transaction(async (tx) => {
    const row = await tx.passwordResetToken.findUnique({
      where: { tokenHash },
      include: {
        user: { select: { id: true, role: true, neighborhoodId: true } },
      },
    });
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
      return null;
    }
    await tx.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });
    await tx.user.update({
      where: { id: row.userId },
      data: { passwordHash: opts.passwordHash, updatedAt: new Date() },
    });
    await tx.passwordResetToken.updateMany({
      where: { userId: row.userId, usedAt: null, id: { not: row.id } },
      data: { usedAt: new Date() },
    });
    return {
      userId: row.user.id,
      role: row.user.role,
      neighborhoodId: row.user.neighborhoodId,
    };
  });
}

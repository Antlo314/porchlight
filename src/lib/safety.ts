/** Calm Safety — incident facts, then the notice leaves. */
export const SAFETY_TTL_DAYS = 14;

export function safetyExpiresAt(from = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + SAFETY_TTL_DAYS);
  return d;
}

export function safetyStillLive(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() > Date.now();
}

export function daysLeft(expiresAt: Date): number {
  const ms = expiresAt.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function formatSafetyWhen(value: Date | null | undefined): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

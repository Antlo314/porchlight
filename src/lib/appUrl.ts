/**
 * The app's public origin.
 *
 * Uses `||`, never `??`. An environment variable that exists but is EMPTY is a
 * completely normal state — Vercel happily saves a key with a blank value — and
 * `??` only falls back on null/undefined. `new URL("")` then throws
 * ERR_INVALID_URL, which fails the production build at page-collection time
 * with an error that points at /_not-found rather than at the real cause.
 *
 * A malformed value is treated the same way as an empty one: fall back rather
 * than crash the whole app over a typo'd setting.
 */
const FALLBACK_ORIGIN = "http://localhost:3000";

export function appOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return FALLBACK_ORIGIN;

  try {
    // Normalizing through URL also strips any trailing slash or stray path.
    return new URL(raw).origin;
  } catch {
    return FALLBACK_ORIGIN;
  }
}

/** Same value as a URL instance, for Next's `metadataBase`. */
export function appUrl(): URL {
  return new URL(appOrigin());
}

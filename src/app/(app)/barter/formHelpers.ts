// Small server-side form helpers shared by the barter server actions.
// (Not a route file — Next only treats page/layout/route/loading/etc. specially.)
import type { ZodError } from "zod";

/**
 * Flattens a Zod error into `{ field: firstMessage }` so a server action can
 * hand the client something it can render inline next to each input.
 * Nested paths collapse to their top-level key (`images.0` → `images`).
 */
export function toFieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in out)) out[key] = issue.message;
  }
  return out;
}

/**
 * Empty form fields arrive as "". The optional coercing schemas
 * (`creditValue`, `creditAmount`) reject "" — they need `undefined`.
 */
export function blankToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

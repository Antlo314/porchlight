// SQLite has no array/JSON columns, so `images` and `payload` are stored as
// JSON strings. Parse/serialize only through these helpers — never JSON.parse
// a column inline, since bad data would crash a whole page render.

export function parseImages(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

export function serializeImages(images: string[] | undefined): string {
  return JSON.stringify(images ?? []);
}

export function parsePayload<T extends Record<string, unknown>>(
  raw: string | null | undefined
): Partial<T> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Partial<T>) : {};
  } catch {
    return {};
  }
}

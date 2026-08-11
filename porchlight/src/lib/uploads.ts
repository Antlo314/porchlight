// Image uploads.
//
// Local-disk storage for now: zero config, works offline, keeps the launch
// unblocked. It does NOT survive a Vercel deploy (their filesystem is
// ephemeral), so before going live swap `storeImage` for an S3 presigned PUT or
// UploadThing — every caller only ever sees the returned URL, so nothing else
// changes.
//
// Files live in `.uploads/` at the project root, NOT in `public/`. Next.js
// builds its list of public files at BUILD time, so anything written there
// afterwards 404s under `next start` — uploads would work in dev and silently
// break in production. They are served instead by src/app/uploads/[name]/route.ts,
// which reads from disk per request.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024; // 6 MB
export const MAX_IMAGES_PER_POST = 6;

/** Only formats a browser will actually render inline. */
const ALLOWED = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

export type UploadResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Magic-number sniff. A client can claim any Content-Type it likes, so the
 * declared type is treated as a hint and the bytes decide. Prevents storing an
 * HTML/SVG payload under an image extension, which is a stored-XSS vector when
 * the file is later served from our own origin.
 */
function sniff(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  const b = bytes;

  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return "image/png";
  }
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) {
    return "image/gif";
  }
  // RIFF....WEBP
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export async function storeImage(file: File): Promise<UploadResult> {
  if (file.size === 0) return { ok: false, error: "That file is empty." };
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Images need to be under 6 MB." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const actualType = sniff(bytes);
  if (!actualType || !ALLOWED.has(actualType)) {
    return { ok: false, error: "Only JPG, PNG, WebP, or GIF images work here." };
  }

  const ext = ALLOWED.get(actualType)!;
  // Random name: never trust the client's filename (path traversal, collisions,
  // and it can leak whatever the uploader happened to call the file).
  const name = `${Date.now().toString(36)}-${randomBytes(8).toString("hex")}.${ext}`;

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, name), bytes);

  return { ok: true, url: `/uploads/${name}` };
}

export const UPLOAD_DIR = path.join(process.cwd(), ".uploads");

/** Filenames storeImage produces. Anything else is refused before touching disk. */
export const STORED_NAME_PATTERN = /^[a-z0-9]+-[a-f0-9]{16}\.(jpg|png|webp|gif)$/;

export const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

/**
 * Images are stored as relative paths, but validators use z.string().url().
 * Accept both so a pasted external link still works.
 */
export function isStoredImageUrl(value: string): boolean {
  if (value.startsWith("/uploads/")) return !value.includes("..");
  return /^https?:\/\//i.test(value);
}

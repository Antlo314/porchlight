// Image uploads.
//
// Two backends, chosen by whether BLOB_READ_WRITE_TOKEN is set:
//
//   Vercel Blob (production) — Vercel's filesystem is read-only outside /tmp
//     and ephemeral, so writing to disk there fails outright. Blob returns an
//     absolute CDN URL.
//   Local disk (development) — no token needed, so `npm run dev` works with
//     zero setup. Files land in `.uploads/` at the project root and are served
//     by src/app/uploads/[name]/route.ts.
//
// Both return a URL string and nothing else in the app cares which produced it:
// `images` columns hold absolute CDN URLs and relative /uploads paths side by
// side, and imageUrlSchema in validators.ts accepts either.
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
 * declared type is a hint and the bytes decide. Prevents storing an HTML or SVG
 * payload under an image extension, which is stored XSS once it is served back
 * from our own origin.
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
  // HEIC/HEIF (iPhone default) — ftyp....heic / heix / mif1
  if (
    b[4] === 0x66 &&
    b[5] === 0x74 &&
    b[6] === 0x79 &&
    b[7] === 0x70
  ) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (["heic", "heix", "heif", "mif1"].includes(brand.toLowerCase())) {
      return "image/heic";
    }
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

export const UPLOAD_DIR = path.join(process.cwd(), ".uploads");

/** Filenames storeImage produces. Anything else is refused before touching disk. */
export const STORED_NAME_PATTERN = /^[a-z0-9]+-[a-f0-9]{16}\.(jpg|png|webp|gif)$/;

export const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

function blobToken() {
  // Bracket access so Next.js cannot inline an empty value at build time.
  return process.env["BLOB_READ_WRITE_TOKEN"]?.trim() ?? "";
}

export function usingBlobStorage(): boolean {
  return Boolean(blobToken());
}

export async function storeImage(file: Blob): Promise<UploadResult> {
  if (file.size === 0) return { ok: false, error: "That file is empty." };
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Images need to be under 6 MB." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const actualType = sniff(bytes);
  if (actualType === "image/heic") {
    return {
      ok: false,
      error:
        "iPhone HEIC photos aren't supported yet. In the picker choose a JPG, or set Camera → Formats → Most Compatible.",
    };
  }
  if (!actualType || !ALLOWED.has(actualType)) {
    return { ok: false, error: "Only JPG, PNG, WebP, or GIF images work here." };
  }

  const ext = ALLOWED.get(actualType)!;
  // Random name: never trust the client's filename (path traversal, collisions,
  // and it leaks whatever the uploader happened to call the file).
  const name = `${Date.now().toString(36)}-${randomBytes(8).toString("hex")}.${ext}`;

  const token = blobToken();
  if (token) {
    try {
      // Imported lazily so local development never loads the SDK.
      const { put } = await import("@vercel/blob");
      // put() takes a Buffer/Blob/stream, not a bare Uint8Array.
      const blob = await put(`porchlight/${name}`, Buffer.from(bytes), {
        access: "public",
        contentType: actualType,
        token,
        // Our name is already random; Vercel's suffix would only make the URL
        // longer and harder to reason about.
        addRandomSuffix: false,
      });
      return { ok: true, url: blob.url };
    } catch (err) {
      console.error("blob put failed", err instanceof Error ? err.message : err);
      return {
        ok: false,
        error: "Photo storage didn't accept that file. Try a smaller JPG or PNG.",
      };
    }
  }

  if (process.env.VERCEL) {
    return {
      ok: false,
      error:
        "Photo storage isn't connected on this deploy yet. Attach the Vercel Blob store, then try again.",
    };
  }

  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, name), bytes);
    return { ok: true, url: `/uploads/${name}` };
  } catch {
    return { ok: false, error: "That upload didn't go through. Try again." };
  }
}

/**
 * Images are stored as either a relative /uploads path (local) or an absolute
 * CDN URL (Blob), so both shapes have to be accepted wherever one is read.
 */
export function isStoredImageUrl(value: string): boolean {
  if (value.startsWith("/uploads/")) return !value.includes("..");
  return /^https?:\/\//i.test(value);
}

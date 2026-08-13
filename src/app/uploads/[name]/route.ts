import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  UPLOAD_DIR,
  STORED_NAME_PATTERN,
  CONTENT_TYPE_BY_EXT,
} from "@/lib/uploads";

export const runtime = "nodejs";

/**
 * Serves uploaded images.
 *
 * These can't live in `public/` — Next.js fixes that directory's file list at
 * build time, so a file written after the build 404s under `next start`. Read
 * from disk per request instead.
 *
 * Deliberately unauthenticated: filenames carry 8 random bytes, so a URL is
 * unguessable, and this matches how the S3/CDN replacement will behave. What it
 * must never do is let a path escape the upload directory.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  // Whitelist the exact shape storeImage produces. This rejects "..", nested
  // paths, and anything with a non-image extension before touching the disk.
  if (!STORED_NAME_PATTERN.test(name)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const filePath = path.join(UPLOAD_DIR, name);
  // Belt and braces: even with the pattern above, never read outside the dir.
  if (path.dirname(path.resolve(filePath)) !== path.resolve(UPLOAD_DIR)) {
    return new NextResponse("Not found", { status: 404 });
  }

  let bytes: Buffer;
  try {
    bytes = await readFile(filePath);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const ext = name.split(".").pop() ?? "";
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream",
      // Names are content-addressed by randomness and never reused.
      "Cache-Control": "public, max-age=31536000, immutable",
      // Never let a stored file be interpreted as anything but its own type.
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}

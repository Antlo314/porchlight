import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  storeImage,
  MAX_IMAGES_PER_POST,
  MAX_UPLOAD_BYTES,
} from "@/lib/uploads";

// Multipart bodies must not be parsed by the edge runtime.
export const runtime = "nodejs";

/**
 * Accepts one or more images from a signed-in member and returns public URLs.
 * Auth first: an open upload endpoint is free hosting for whoever finds it.
 */
export async function POST(req: NextRequest) {
  await requireUser();

  // Reject on the declared size BEFORE parsing. req.formData() materializes
  // every part in memory, so checking sizes only inside storeImage means a
  // multi-gigabyte body is fully buffered before a single byte is refused.
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES * MAX_IMAGES_PER_POST) {
    return NextResponse.json(
      { error: "That upload is too large." },
      { status: 413 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a file upload." }, { status: 400 });
  }

  const files = form
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "No image selected." }, { status: 400 });
  }
  if (files.length > MAX_IMAGES_PER_POST) {
    return NextResponse.json(
      { error: `Up to ${MAX_IMAGES_PER_POST} images at a time.` },
      { status: 400 }
    );
  }

  const urls: string[] = [];
  for (const file of files) {
    const result = await storeImage(file);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    urls.push(result.url);
  }

  return NextResponse.json({ urls });
}

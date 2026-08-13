import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function same(a: string, b: string) {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

export async function POST(req: NextRequest) {
  const expected = process.env.WIPE_USERS_KEY?.trim();
  const got = req.headers.get("x-wipe-key")?.trim() || "";
  if (!expected || !got || !same(expected, got)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const users = await db.user.findMany({
    select: { email: true, name: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  await db.tradeCreditEntry.deleteMany({});
  const deleted = await db.user.deleteMany({});

  return NextResponse.json({
    ok: true,
    deleted: deleted.count,
    emails: users.map((u) => u.email),
  });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PRESENCE_STALE_MS } from "@/lib/games/presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "nope" }, { status: 401 });
    }
  }

  const cutoff = new Date(Date.now() - PRESENCE_STALE_MS * 3);
  const result = await db.gamePresence.deleteMany({
    where: { heartbeatAt: { lt: cutoff } },
  });
  return NextResponse.json({ swept: result.count });
}

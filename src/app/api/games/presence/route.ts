import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  PRESENCE_STALE_MS,
  firstName,
  isPresenceStatus,
  type PresencePublic,
} from "@/lib/games/presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asPublic(
  rows: {
    id: string;
    name: string;
    course: string;
    status: string;
    score: number;
    userId: string | null;
    guestKey: string | null;
  }[],
  self: { userId?: string; guestKey?: string },
): PresencePublic[] {
  return rows.flatMap((r) => {
    if (!isPresenceStatus(r.status)) return [];
    return [
      {
        id: r.id,
        name: firstName(r.name),
        course: r.course,
        status: r.status,
        score: r.score,
        self:
          (!!self.userId && r.userId === self.userId) ||
          (!!self.guestKey && r.guestKey === self.guestKey),
      },
    ];
  });
}

async function liveRows(neighborhoodId: string | null) {
  const since = new Date(Date.now() - PRESENCE_STALE_MS);
  return db.gamePresence.findMany({
    where: {
      heartbeatAt: { gte: since },
      ...(neighborhoodId ? { neighborhoodId } : {}),
    },
    orderBy: { heartbeatAt: "desc" },
    take: 24,
    select: {
      id: true,
      name: true,
      course: true,
      status: true,
      score: true,
      userId: true,
      guestKey: true,
    },
  });
}

export async function GET(req: NextRequest) {
  const user = await currentUser().catch(() => null);
  const guestKey = req.nextUrl.searchParams.get("guest")?.slice(0, 40) || undefined;
  const rows = await liveRows(user?.neighborhoodId ?? null);
  return NextResponse.json({
    neighborhood: user?.neighborhood.name ?? "Atlanta",
    people: asPublic(rows, { userId: user?.id, guestKey }),
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    guest?: string;
    course?: string;
    status?: string;
    score?: number;
    name?: string;
  } | null;

  const status = body?.status && isPresenceStatus(body.status) ? body.status : "lobby";
  const course = (body?.course ?? "lobby").toString().slice(0, 40);
  const score = Math.max(0, Math.min(99999, Number(body?.score) || 0));
  const guestKey = body?.guest?.toString().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);

  const user = await currentUser().catch(() => null);
  if (!user && !guestKey) {
    return NextResponse.json({ error: "Need a lantern key" }, { status: 400 });
  }

  const name = firstName(user?.name ?? body?.name ?? "Neighbor");
  const now = new Date();

  if (user) {
    await db.gamePresence.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        neighborhoodId: user.neighborhoodId,
        name,
        course,
        status,
        score,
        heartbeatAt: now,
      },
      update: {
        neighborhoodId: user.neighborhoodId,
        name,
        course,
        status,
        score,
        heartbeatAt: now,
      },
    });
  } else {
    await db.gamePresence.upsert({
      where: { guestKey: guestKey! },
      create: {
        guestKey,
        name,
        course,
        status,
        score,
        heartbeatAt: now,
      },
      update: { name, course, status, score, heartbeatAt: now },
    });
  }

  const rows = await liveRows(user?.neighborhoodId ?? null);
  return NextResponse.json({
    neighborhood: user?.neighborhood.name ?? "Atlanta",
    people: asPublic(rows, { userId: user?.id, guestKey }),
  });
}

import { NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  PRESENCE_STALE_MS,
  firstName,
  isPresenceStatus,
} from "@/lib/games/presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const user = await currentUser().catch(() => null);
  const guestKey = req.nextUrl.searchParams.get("guest")?.slice(0, 40) || undefined;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = async () => {
        if (closed) return;
        const since = new Date(Date.now() - PRESENCE_STALE_MS);
        const rows = await db.gamePresence.findMany({
          where: {
            heartbeatAt: { gte: since },
            ...(user?.neighborhoodId ? { neighborhoodId: user.neighborhoodId } : {}),
          },
          orderBy: { heartbeatAt: "desc" },
          take: 24,
        });
        const people = rows
          .filter((r) => isPresenceStatus(r.status))
          .map((r) => ({
            id: r.id,
            name: firstName(r.name),
            course: r.course,
            status: r.status,
            score: r.score,
            self:
              (!!user?.id && r.userId === user.id) ||
              (!!guestKey && r.guestKey === guestKey),
          }));
        const payload = JSON.stringify({
          neighborhood: user?.neighborhood.name ?? "Atlanta",
          people,
        });
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      };

      try {
        await send();
        const tick = setInterval(() => {
          void send().catch(() => {
            clearInterval(tick);
            if (!closed) {
              closed = true;
              controller.close();
            }
          });
        }, 2000);
        req.signal.addEventListener("abort", () => {
          clearInterval(tick);
          if (!closed) {
            closed = true;
            controller.close();
          }
        });
      } catch {
        if (!closed) controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

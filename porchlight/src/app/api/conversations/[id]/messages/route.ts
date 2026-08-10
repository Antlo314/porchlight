import { NextRequest, NextResponse } from "next/server";
import { toChatMessage } from "@/components/chat/types";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";

// Client-polled read: the one place API routes are allowed by convention.
// Mutations stay in server actions.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Authorization: only participants may read a conversation's messages.
  const participant = await db.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId: id, userId: user.id } },
    select: { lastReadAt: true },
  });
  if (!participant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sinceParam = request.nextUrl.searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : null;
  const validSince = since && !Number.isNaN(since.getTime()) ? since : null;

  const rows = await db.message.findMany({
    where: {
      conversationId: id,
      ...(validSince ? { createdAt: { gt: validSince } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: PAGE_SIZE,
    include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
  });

  // The viewer is looking right at the thread, so anything delivered here is read.
  const newest = rows[rows.length - 1];
  if (newest && newest.createdAt > participant.lastReadAt) {
    await db.conversationParticipant.update({
      where: { conversationId_userId: { conversationId: id, userId: user.id } },
      data: { lastReadAt: newest.createdAt },
    });
  }

  return NextResponse.json(
    { messages: rows.map(toChatMessage) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

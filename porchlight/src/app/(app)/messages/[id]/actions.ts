"use server";

import { revalidatePath } from "next/cache";
import { toChatMessage, type SendMessageResult } from "@/components/chat/types";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { truncate } from "@/lib/format";
import { notify } from "@/lib/notify";
import { sendMessageSchema } from "@/lib/validators";

export async function sendMessage(input: {
  conversationId: string;
  body: string;
}): Promise<SendMessageResult> {
  const user = await requireUser();

  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "That message can't be sent",
    };
  }
  const { conversationId, body } = parsed.data;

  // Never trust the id from the client: you may only post to a conversation
  // you are actually a participant of.
  const participant = await db.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: user.id } },
    select: { conversationId: true },
  });
  if (!participant) {
    return { ok: false, error: "You're not part of that conversation" };
  }

  const message = await db.message.create({
    data: { conversationId, senderId: user.id, body },
    include: {
      sender: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  // updatedAt drives inbox ordering — pin it to the message so the two agree.
  const conversation = await db.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: message.createdAt },
    select: {
      isGroup: true,
      title: true,
      participants: { select: { userId: true } },
    },
  });

  await db.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId: user.id } },
    data: { lastReadAt: message.createdAt },
  });

  const context =
    conversation.isGroup && conversation.title ? ` in ${conversation.title}` : "";
  await Promise.all(
    conversation.participants
      .filter((p) => p.userId !== user.id)
      .map((p) =>
        notify({
          userId: p.userId,
          actorId: user.id,
          type: "NEW_MESSAGE",
          payload: {
            href: `/messages/${conversationId}`,
            text: `${user.name}${context}: ${truncate(body, 80)}`,
            actorName: user.name,
          },
        })
      )
  );

  revalidatePath("/messages");
  revalidatePath(`/messages/${conversationId}`);

  return { ok: true, message: toChatMessage(message) };
}

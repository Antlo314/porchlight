"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { truncate } from "@/lib/format";
import { notify } from "@/lib/notify";
import { startConversationSchema } from "@/lib/validators";
import { findDirectConversationId } from "../queries";

/**
 * Starts (or reuses) the 1:1 thread with `recipientId`, posts the first
 * message, and redirects into it. Returns only on failure.
 */
export async function startConversation(input: {
  recipientId: string;
  body: string;
}): Promise<{ ok: false; error: string } | void> {
  const user = await requireUser();

  const parsed = startConversationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "That message can't be sent",
    };
  }
  const { recipientId, body } = parsed.data;

  if (recipientId === user.id) {
    return { ok: false, error: "You can't message yourself" };
  }

  const recipient = await db.user.findUnique({
    where: { id: recipientId },
    select: { id: true },
  });
  if (!recipient) {
    return { ok: false, error: "That neighbor is no longer on Porchlight" };
  }

  // Reuse before create, so repeated "Message" taps never fork the thread.
  let conversationId = await findDirectConversationId(user.id, recipient.id);
  if (!conversationId) {
    const created = await db.conversation.create({
      data: {
        isGroup: false,
        participants: {
          create: [{ userId: user.id }, { userId: recipient.id }],
        },
      },
      select: { id: true },
    });
    conversationId = created.id;
  }

  const message = await db.message.create({
    data: { conversationId, senderId: user.id, body },
    select: { createdAt: true },
  });

  await db.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: message.createdAt },
  });
  await db.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId: user.id } },
    data: { lastReadAt: message.createdAt },
  });

  await notify({
    userId: recipient.id,
    actorId: user.id,
    type: "NEW_MESSAGE",
    payload: {
      href: `/messages/${conversationId}`,
      text: `${user.name}: ${truncate(body, 80)}`,
      actorName: user.name,
    },
  });

  revalidatePath("/messages");
  redirect(`/messages/${conversationId}`);
}

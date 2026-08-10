"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Clears the bell for the signed-in neighbor.
 *
 * Takes no input on purpose — there is nothing a client could pass that would
 * change which rows are touched. The `userId` in the where clause is the
 * ownership check, so this can never mark somebody else's notifications read.
 */
export async function markAllNotificationsRead(): Promise<{
  ok: boolean;
  count: number;
}> {
  const user = await requireUser();

  const result = await db.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath("/notifications");
  // The bell badge lives in the app shell, which every screen renders.
  revalidatePath("/feed");

  return { ok: true, count: result.count };
}

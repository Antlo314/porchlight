"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isStaff } from "@/lib/staff";
import {
  isStormResource,
  isStormStatus,
  type StormResource,
  type StormStatus,
} from "@/lib/storm";

export async function setStormModeAction(input: {
  active: boolean;
}): Promise<{ error?: string } | undefined> {
  const user = await requireUser();
  if (!isStaff(user)) {
    return { error: "Only neighborhood mods can turn Storm Mode." };
  }

  if (input.active) {
    await db.$transaction([
      db.stormCheckIn.deleteMany({
        where: { neighborhoodId: user.neighborhoodId },
      }),
      db.neighborhood.update({
        where: { id: user.neighborhoodId },
        data: { stormActive: true, stormActivatedAt: new Date() },
      }),
    ]);
  } else {
    await db.neighborhood.update({
      where: { id: user.neighborhoodId },
      data: { stormActive: false },
    });
  }

  revalidatePath("/feed");
  revalidatePath("/storm");
  revalidatePath("/neighborhood");
}

export async function stormCheckInAction(input: {
  status: string;
  resource?: string | null;
  note?: string;
}): Promise<{ error?: string } | undefined> {
  const user = await requireUser();
  if (!user.neighborhood.stormActive) {
    return { error: "Storm Mode is not on right now." };
  }
  if (!isStormStatus(input.status)) {
    return { error: "Pick safe or need help." };
  }
  const resource =
    input.resource && isStormResource(input.resource) ? input.resource : null;
  const note = input.note?.trim().slice(0, 240) || null;

  await db.stormCheckIn.upsert({
    where: {
      userId_neighborhoodId: {
        userId: user.id,
        neighborhoodId: user.neighborhoodId,
      },
    },
    create: {
      userId: user.id,
      neighborhoodId: user.neighborhoodId,
      status: input.status as StormStatus,
      resource: resource as StormResource | null,
      note,
    },
    update: {
      status: input.status as StormStatus,
      resource: resource as StormResource | null,
      note,
    },
  });

  revalidatePath("/storm");
  revalidatePath("/feed");
}

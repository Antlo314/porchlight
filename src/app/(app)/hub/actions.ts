"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner, requireStaff } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/staff";
import { db } from "@/lib/db";

const roleSchema = z.enum(["MEMBER", "MODERATOR"]);

export async function setModeratorAction(input: {
  userId: string;
  role: "MEMBER" | "MODERATOR";
}): Promise<{ error?: string } | undefined> {
  await requireOwner();

  const parsed = roleSchema.safeParse(input.role);
  if (!parsed.success || !input.userId) {
    return { error: "That isn't a valid staff change." };
  }

  const target = await db.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, role: true, name: true },
  });
  if (!target) return { error: "That neighbor is no longer here." };
  if (isOwnerEmail(target.email)) {
    return { error: "The Steward seat cannot be reassigned." };
  }

  await db.user.update({
    where: { id: target.id },
    data: { role: parsed.data },
  });

  revalidatePath("/hub");
  revalidatePath("/hub/steward");
  revalidatePath("/hub/block");
  revalidatePath("/profile");
}

export async function setVerifiedAction(input: {
  userId: string;
  verified: boolean;
}): Promise<{ error?: string } | undefined> {
  const staff = await requireStaff();

  if (!input.userId) return { error: "Pick a neighbor." };

  const target = await db.user.findUnique({
    where: { id: input.userId },
    select: { id: true, neighborhoodId: true },
  });
  if (!target) return { error: "That neighbor is no longer here." };
  if (target.neighborhoodId !== staff.neighborhoodId) {
    return { error: "You can only verify neighbors on your own block." };
  }

  await db.user.update({
    where: { id: target.id },
    data: { verifiedAt: input.verified ? new Date() : null },
  });

  revalidatePath("/hub/block");
  revalidatePath("/profile");
}

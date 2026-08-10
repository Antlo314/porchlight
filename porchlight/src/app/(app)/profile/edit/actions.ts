"use server";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateProfileSchema } from "@/lib/validators";
import type {
  ProfileActionResult,
  ProfileFormValues,
} from "@/components/profile/types";

// Zod's stock messages ("Invalid url") read like a stack trace on a phone.
const FRIENDLY: Record<string, string> = {
  name: "Names need at least 2 characters.",
  bio: "That bio is too long — keep it under 500 characters.",
  avatarUrl: "Use a full image link starting with https://",
};

function toFieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in out)) {
      out[key] = FRIENDLY[key] ?? issue.message;
    }
  }
  return out;
}

/**
 * Updates the signed-in neighbor's own profile.
 *
 * There is no id in the input by design: the row written is always the session
 * user's, so a crafted request can't edit somebody else's card.
 */
export async function updateProfile(
  input: ProfileFormValues
): Promise<ProfileActionResult> {
  const user = await requireUser();

  const parsed = updateProfileSchema.safeParse({
    name: input?.name ?? "",
    bio: input?.bio ?? "",
    avatarUrl: (input?.avatarUrl ?? "").trim(),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const { name, bio, avatarUrl } = parsed.data;

  await db.user.update({
    where: { id: user.id },
    // Empty strings clear the field rather than storing "".
    data: {
      name,
      bio: bio ? bio : null,
      avatarUrl: avatarUrl ? avatarUrl : null,
    },
  });

  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  revalidatePath(`/profile/${user.id}`);
  // The name and avatar are denormalized into every feed/message row on screen.
  revalidatePath("/feed");
  revalidatePath("/messages");

  return { ok: true };
}

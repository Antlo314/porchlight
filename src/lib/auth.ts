// Server-side auth helpers. Use requireUser() at the top of any protected
// server action or route handler.
import { redirect } from "next/navigation";
import { db } from "./db";
import { getSession } from "./session";
import { isOwner, isOwnerEmail, isStaff } from "./staff";

export async function currentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { neighborhood: true },
  });
  if (!user) return null;
  if (isOwnerEmail(user.email) && user.role !== "ADMIN") {
    return db.user.update({
      where: { id: user.id },
      data: { role: "ADMIN" },
      include: { neighborhood: true },
    });
  }
  return user;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(role: "MODERATOR" | "ADMIN") {
  const user = await requireUser();
  const owner = isOwnerEmail(user.email);
  const allowed =
    owner ||
    user.role === "ADMIN" ||
    (role === "MODERATOR" && user.role === "MODERATOR");
  if (!allowed) redirect("/feed");
  return user;
}

export async function requireStaff() {
  const user = await requireUser();
  if (!isStaff(user)) redirect("/feed");
  return user;
}

export async function requireOwner() {
  const user = await requireUser();
  if (!isOwner(user)) redirect("/hub/block");
  return user;
}

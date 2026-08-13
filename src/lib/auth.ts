// Server-side auth helpers. Use requireUser() at the top of any protected
// server action or route handler.
import { redirect } from "next/navigation";
import { db } from "./db";
import { getSession } from "./session";

export async function currentUser() {
  const session = await getSession();
  if (!session) return null;
  return db.user.findUnique({
    where: { id: session.userId },
    include: { neighborhood: true },
  });
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(role: "MODERATOR" | "ADMIN") {
  const user = await requireUser();
  const allowed =
    user.role === "ADMIN" || (role === "MODERATOR" && user.role === "MODERATOR");
  if (!allowed) redirect("/feed");
  return user;
}

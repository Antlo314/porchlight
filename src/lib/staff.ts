/** The one account that owns Porchlight. Not assignable. Not demotable. */
export const OWNER_EMAIL = "iamwhoiambook@gmail.com";

export function isOwnerEmail(email: string): boolean {
  return email.trim().toLowerCase() === OWNER_EMAIL;
}

export function isOwner(user: { email: string }): boolean {
  return isOwnerEmail(user.email);
}

export function isStaff(user: { email: string; role: string }): boolean {
  return isOwner(user) || user.role === "ADMIN" || user.role === "MODERATOR";
}

export function staffLabel(user: { email: string; role: string }): string {
  if (isOwner(user)) return "Steward";
  if (user.role === "ADMIN") return "Admin";
  if (user.role === "MODERATOR") return "Moderator";
  return "Neighbor";
}

export const PRESENCE_STALE_MS = 12_000;

export type PresenceStatus = "lobby" | "running" | "done";

export type PresencePublic = {
  id: string;
  name: string;
  course: string;
  status: PresenceStatus;
  score: number;
  self: boolean;
};

export function firstName(full: string): string {
  const part = full.trim().split(/\s+/)[0] ?? "Neighbor";
  return part.slice(0, 24);
}

export function isPresenceStatus(v: string): v is PresenceStatus {
  return v === "lobby" || v === "running" || v === "done";
}

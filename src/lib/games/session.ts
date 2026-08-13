import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type RunTicket = {
  runId: string;
  userId: string | null;
  nonce: string;
  levelId: string;
  seed: string;
  iat: number;
};

function secretBytes() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

function signBody(body: string): string {
  return createHmac("sha256", secretBytes()).update(body).digest("base64url");
}

export function mintNonce(): string {
  return randomBytes(18).toString("base64url");
}

export function issueTicket(ticket: RunTicket): string {
  const body = Buffer.from(JSON.stringify(ticket), "utf8").toString("base64url");
  return `${body}.${signBody(body)}`;
}

export function readTicket(token: string): RunTicket | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = signBody(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as RunTicket;
    if (
      typeof parsed.runId !== "string" ||
      typeof parsed.nonce !== "string" ||
      typeof parsed.levelId !== "string" ||
      typeof parsed.seed !== "string" ||
      typeof parsed.iat !== "number" ||
      (parsed.userId !== null && typeof parsed.userId !== "string")
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** 15 minutes is generous for a two-minute course and a pause. */
export const TICKET_TTL_MS = 15 * 60_000;

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mailConfigured } from "@/lib/mail";
import { authSecretConfigured } from "@/lib/session";
import { usingBlobStorage } from "@/lib/uploads";

export const dynamic = "force-dynamic";

/** Public status for deploys. Never returns secrets. */
export async function GET() {
  let database: "ok" | "error" = "error";
  let neighborhoods = 0;
  try {
    neighborhoods = await db.neighborhood.count();
    database = "ok";
  } catch {
    database = "error";
  }
  return NextResponse.json({
    ok: database === "ok" && authSecretConfigured(),
    database,
    neighborhoods,
    authSecret: authSecretConfigured() ? "ok" : "missing",
    mail: mailConfigured() ? "ok" : "missing",
    uploads: usingBlobStorage()
      ? process.env["BLOB_READ_WRITE_TOKEN"]?.trim()
        ? "blob"
        : "oidc"
      : "disk",
    games: true,
  });
}

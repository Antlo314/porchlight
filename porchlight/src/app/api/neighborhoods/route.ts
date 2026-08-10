import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public: powers the neighborhood picker on signup.
export async function GET() {
  const neighborhoods = await db.neighborhood.findMany({
    orderBy: [{ city: "asc" }, { name: "asc" }],
    select: { id: true, name: true, city: true, county: true },
  });
  return NextResponse.json(neighborhoods);
}

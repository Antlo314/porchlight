import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public: powers the neighborhood picker on signup.
export async function GET() {
  try {
    const neighborhoods = await db.neighborhood.findMany({
      orderBy: [{ city: "asc" }, { name: "asc" }],
      select: { id: true, name: true, city: true, county: true },
    });
    return NextResponse.json(neighborhoods);
  } catch {
    return NextResponse.json(
      {
        error:
          "Couldn't reach the neighborhood list. The database isn't connected yet.",
        offline: true,
      },
      { status: 503 }
    );
  }
}

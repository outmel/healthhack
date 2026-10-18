// "Reset demo" on the login page: puts the Mdm Tan story back exactly as seeded, so each
// visitor starts from the same place whatever the last one tapped.
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { secondsSinceSeed, seedDemo } from "@/lib/demoSeed";

export async function POST() {
  const db = await pool.connect();
  try {
    const since = await secondsSinceSeed(db);
    if (since != null && since < 20) return NextResponse.json({ ok: true, skipped: "just reset" });
    await seedDemo(db);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("demo reset failed", e);
    return NextResponse.json({ error: "Couldn't reset the demo. Try again in a moment." }, { status: 500 });
  } finally {
    db.release();
  }
}

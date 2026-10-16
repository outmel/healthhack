import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";

export async function POST(req: Request) {
  const session = await getSession();
  if (session?.role !== "helper") return NextResponse.json({ error: "Helpers only" }, { status: 403 });
  const { mood, rested } = await req.json();
  const m = Math.min(5, Math.max(1, Math.round(Number(mood))));
  await query(`INSERT INTO carer_checkins (helper_id, mood, rested_today) VALUES ($1, $2, $3)`, [session.uid, m, Boolean(rested)]);
  return NextResponse.json({ ok: true });
}

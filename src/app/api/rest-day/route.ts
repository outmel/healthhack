// Family gives the helper a rest day. The helper's home screen and the GP card read it back.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";

export async function POST(req: Request) {
  const session = await getSession();
  if (session?.role !== "family") return NextResponse.json({ error: "Family only" }, { status: 403 });
  const { day } = await req.json();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day))) return NextResponse.json({ error: "day must be YYYY-MM-DD" }, { status: 400 });

  const [helper] = await query<{ id: number; name: string }>(
    `SELECT id, name FROM users WHERE household_id = $1 AND role = 'helper' LIMIT 1`,
    [session.household],
  );
  if (!helper) return NextResponse.json({ error: "No helper in this household" }, { status: 404 });
  await query(
    `INSERT INTO rest_days (helper_id, day, set_by) VALUES ($1, $2, $3)
     ON CONFLICT (helper_id, day) DO UPDATE SET set_by = EXCLUDED.set_by, created_at = now()`,
    [helper.id, day, session.uid],
  );
  return NextResponse.json({ ok: true, day, helper: helper.name });
}

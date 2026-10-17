// Family has booked a GP review for an alert: store the date and acknowledge the alert.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (session?.role !== "family") return NextResponse.json({ error: "Family only" }, { status: 403 });
  const id = Number((await ctx.params).id);
  const { date } = await req.json();
  if (!Number.isInteger(id) || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    return NextResponse.json({ error: "alert id and date (YYYY-MM-DD) required" }, { status: 400 });
  }
  // Only alerts for this family's senior.
  const rows = await query(
    `UPDATE alerts a SET gp_review_at = ($2::date + time '09:00') AT TIME ZONE 'Asia/Singapore', acknowledged = true
       FROM seniors s
      WHERE a.id = $1 AND s.id = a.senior_id AND s.household_id = $3
      RETURNING a.id, a.gp_review_at`,
    [id, date, session.household],
  );
  if (!rows.length) return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  return NextResponse.json({ ok: true, ...rows[0] });
}

// Helper logs a meal %, a chair-stand time, or a voice note. Re-runs the baseline engine.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { getSenior } from "@/lib/data";
import { recompute } from "@/lib/baseline";
import { translateNote } from "@/lib/claude";

export async function POST(req: Request) {
  const session = await getSession();
  if (session?.role !== "helper") return NextResponse.json({ error: "Helpers only" }, { status: 403 });
  const senior = await getSenior(session.household);
  const body = await req.json();

  if (body.type === "meal" || body.type === "mobility") {
    const value = Number(body.value);
    if (!Number.isFinite(value)) return NextResponse.json({ error: "value required" }, { status: 400 });
    await query(`INSERT INTO observations (senior_id, type, value, meta) VALUES ($1, $2, $3, $4)`, [
      senior.id, body.type, value, body.meta ?? {},
    ]);
  } else if (body.type === "voice") {
    const text = String(body.text ?? "").trim();
    if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });
    // Save first so a slow/failed translation never loses the note.
    const [row] = await query<{ id: number }>(
      `INSERT INTO observations (senior_id, type, original_text, meta) VALUES ($1, 'voice', $2, $3) RETURNING id`,
      [senior.id, text, { lang: body.lang ?? session.lang }],
    );
    try {
      const t = await translateNote(text, body.lang ?? session.lang);
      await query(`UPDATE observations SET translated_text = $1, meta = meta || $2 WHERE id = $3`, [
        t.english, { concerns: t.concerns }, row.id,
      ]);
    } catch (e) {
      console.error("translate failed", e);
    }
  } else {
    return NextResponse.json({ error: "unknown type" }, { status: 400 });
  }

  const statuses = await recompute(senior.id);
  return NextResponse.json({ ok: true, statuses });
}

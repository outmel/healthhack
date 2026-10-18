// In-app messages within a household. The family writes to the helper; the GP writes to the helper
// or the family. Whatever reaches the helper is translated into her own language first.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { getFamily, getHelper } from "@/lib/data";
import { translateForHelper } from "@/lib/ai";

export async function POST(req: Request) {
  const session = await getSession();
  if (session?.role !== "family" && session?.role !== "gp") return NextResponse.json({ error: "Family or GP only" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const text = String(body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "Write a message first" }, { status: 400 });
  if (text.length > 500) return NextResponse.json({ error: "Keep it under 500 characters" }, { status: 400 });
  // The family only messages the helper; the GP picks who.
  const to = session.role === "gp" && body.to === "family" ? "family" : "helper";

  if (to === "family") {
    const family = await getFamily(session.household);
    if (!family.length) return NextResponse.json({ error: "No family member has joined this household yet" }, { status: 404 });
    for (const f of family) {
      await query(`INSERT INTO messages (from_user, to_user, original_text, lang) VALUES ($1, $2, $3, 'en')`, [session.uid, f.id, text]);
    }
    return NextResponse.json({ ok: true, translated: null, lang: "en", to: family.map((f) => f.name).join(" and ") });
  }

  const helper = await getHelper(session.household);
  if (!helper) return NextResponse.json({ error: "No helper in this household" }, { status: 404 });
  // A failed translation still delivers the message, in English.
  const translated = await translateForHelper(text, helper.language, session.role === "gp" ? "gp" : "family").catch((e) => {
    console.error("message translation failed", e);
    return null;
  });
  await query(
    `INSERT INTO messages (from_user, to_user, original_text, translated_text, lang) VALUES ($1, $2, $3, $4, $5)`,
    [session.uid, helper.id, text, translated, translated ? helper.language : "en"],
  );
  return NextResponse.json({ ok: true, translated, lang: helper.language, helper: helper.name, to: helper.name });
}

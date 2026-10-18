// Family writes to the helper in English; she reads it in her own language on her home screen.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { getHelper } from "@/lib/data";
import { translateForHelper } from "@/lib/ai";

export async function POST(req: Request) {
  const session = await getSession();
  if (session?.role !== "family") return NextResponse.json({ error: "Family only" }, { status: 403 });
  const text = String((await req.json().catch(() => ({}))).text ?? "").trim();
  if (!text) return NextResponse.json({ error: "Write a message first" }, { status: 400 });
  if (text.length > 500) return NextResponse.json({ error: "Keep it under 500 characters" }, { status: 400 });

  const helper = await getHelper(session.household);
  if (!helper) return NextResponse.json({ error: "No helper in this household" }, { status: 404 });
  // A failed translation still delivers the message, in English.
  const translated = await translateForHelper(text, helper.language).catch((e) => {
    console.error("message translation failed", e);
    return null;
  });
  await query(
    `INSERT INTO messages (from_user, to_user, original_text, translated_text, lang) VALUES ($1, $2, $3, $4, $5)`,
    [session.uid, helper.id, text, translated, translated ? helper.language : "en"],
  );
  return NextResponse.json({ ok: true, translated, lang: helper.language, helper: helper.name });
}

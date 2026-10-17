// Before/after plate photos -> % eaten + boxes around what was left. Saves a meal observation
// and re-runs the engine. Photos are kept in memory only; they are never stored.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { getSenior } from "@/lib/data";
import { recompute } from "@/lib/baseline";
import { estimatePlate } from "@/lib/ai";

const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type MediaType = (typeof TYPES)[number];

async function toImg(f: FormDataEntryValue | null) {
  if (!(f instanceof File) || !TYPES.includes(f.type as MediaType)) throw new Error("Expected a JPEG/PNG/WebP image");
  return { data: Buffer.from(await f.arrayBuffer()).toString("base64"), mediaType: f.type as MediaType };
}

export async function POST(req: Request) {
  const session = await getSession();
  if (session?.role !== "helper") return NextResponse.json({ error: "Helpers only" }, { status: 403 });

  const form = await req.formData();
  let estimate;
  try {
    estimate = await estimatePlate(await toImg(form.get("before")), await toImg(form.get("after")));
  } catch (e) {
    console.error("plate estimate failed", e);
    return NextResponse.json({ error: String((e as Error).message) }, { status: 502 });
  }

  // Shown to users in 25% buckets; the raw estimate is kept for the GP chart.
  const bucket = Math.round(estimate.percent_eaten / 25) * 25;
  const senior = await getSenior(session.household);
  await query(`INSERT INTO observations (senior_id, type, value, meta) VALUES ($1, 'meal', $2, $3)`, [
    senior.id, Math.round(estimate.percent_eaten), { confidence: estimate.confidence, note: estimate.note, bucket },
  ]);
  const statuses = await recompute(senior.id);
  return NextResponse.json({ ...estimate, bucket, status: statuses.find((x) => x.type === "meal") ?? null });
}

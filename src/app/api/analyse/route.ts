// GP asks for a fresh AI analysis. Calls the n8n workflow server-side so the webhook secret
// never reaches the browser; n8n saves the result to ai_analyses and returns it.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSenior } from "@/lib/data";

export async function POST() {
  const session = await getSession();
  if (session?.role !== "gp") return NextResponse.json({ error: "GPs only" }, { status: 403 });
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return NextResponse.json({ error: "N8N_WEBHOOK_URL is not set" }, { status: 500 });

  const senior = await getSenior(session.household);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-teman-secret": process.env.N8N_WEBHOOK_SECRET ?? "" },
      body: JSON.stringify({ senior_id: senior.id }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) return NextResponse.json({ error: `n8n returned ${res.status}` }, { status: 502 });
    return NextResponse.json(await res.json());
  } catch (e) {
    console.error("n8n analyse failed", e);
    return NextResponse.json({ error: "Analysis service unreachable" }, { status: 502 });
  }
}

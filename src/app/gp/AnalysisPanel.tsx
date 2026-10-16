"use client";

import { useState } from "react";
import type { Analysis } from "@/lib/data";

const BADGE: Record<Analysis["urgency"], { label: string; cls: string }> = {
  routine: { label: "Routine", cls: "bg-emerald-100 text-emerald-800" },
  review_soon: { label: "Review soon", cls: "bg-amber-100 text-amber-900" },
  urgent: { label: "Urgent", cls: "bg-red-100 text-red-800" },
};

export default function AnalysisPanel({ initial }: { initial: Analysis | null }) {
  const [result, setResult] = useState(initial);
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [error, setError] = useState("");

  async function run() {
    setState("busy");
    const res = await fetch("/api/analyse", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Analysis failed");
      return setState("error");
    }
    setResult(data);
    setState("idle");
  }

  const a = result?.analysis;
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">AI trend summary</h2>
          {result && <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${BADGE[result.urgency].cls}`}>{BADGE[result.urgency].label}</span>}
        </div>
        <button onClick={run} disabled={state === "busy"} className="rounded-xl bg-teal-700 px-4 py-2 font-semibold text-white disabled:opacity-50">
          {state === "busy" ? "Analysing… (up to a minute)" : result ? "Re-analyse with AI" : "Analyse with AI"}
        </button>
      </div>
      {state === "error" && <p className="mt-2 text-red-700">{error}</p>}
      {!a && state !== "busy" && <p className="mt-3 text-stone-500">No analysis yet. Run one to get a GP-ready summary of the trends and notes.</p>}
      {a && (
        <div className="mt-3 space-y-3">
          {a.headline && <p className="text-lg font-semibold">{a.headline}</p>}
          {a.gp_summary && <p className="text-stone-700">{a.gp_summary}</p>}
          {!!a.symptom_tags?.length && (
            <div className="flex flex-wrap gap-2">
              {a.symptom_tags.map((t) => (
                <span key={t.tag} title={t.dates.join(", ")} className="rounded-full bg-stone-100 px-3 py-1 text-sm">
                  {t.tag} ×{t.count}
                </span>
              ))}
            </div>
          )}
          {!!a.red_flags?.length && (
            <ul className="rounded-xl bg-red-50 p-3 text-red-800">
              {a.red_flags.map((f) => <li key={f}>⚠ {f}</li>)}
            </ul>
          )}
          {!!a.worth_reviewing?.length && (
            <div>
              <p className="text-sm font-semibold text-stone-500">Worth reviewing</p>
              <ul className="list-disc pl-5">{a.worth_reviewing.map((q) => <li key={q}>{q}</li>)}</ul>
            </div>
          )}
          <p className="text-xs text-stone-400">
            Generated {new Date(result!.generated_at).toLocaleString("en-SG", { timeZone: "Asia/Singapore" })}. Statistics are computed in code; the AI only explains them. Not a diagnosis.
          </p>
        </div>
      )}
    </section>
  );
}

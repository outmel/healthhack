"use client";

import { useState } from "react";
import type { Analysis } from "@/lib/data";

const BADGE: Record<Analysis["urgency"], { label: string; cls: string }> = {
  routine: { label: "Routine", cls: "bg-sage-soft text-sage" },
  review_soon: { label: "Review soon", cls: "bg-sun-soft text-sun" },
  urgent: { label: "Urgent", cls: "bg-coral-soft text-coral" },
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
    <section className="rounded-3xl bg-paper p-5 shadow-sm ring-1 ring-line">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold">AI trend summary</h2>
          {result && <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${BADGE[result.urgency].cls}`}>{BADGE[result.urgency].label}</span>}
        </div>
        <button onClick={run} disabled={state === "busy"} className="rounded-full bg-brand px-5 py-2.5 font-bold text-white hover:bg-brand-dark disabled:opacity-60">
          {state === "busy" ? "Analysing… (up to a minute)" : result ? "Re-analyse with AI" : "Analyse with AI"}
        </button>
      </div>
      {state === "error" && <p className="mt-2 text-coral">{error}</p>}
      {!a && state !== "busy" && <p className="mt-3 text-muted">No analysis yet. Run one to get a GP-ready summary of the trends and notes.</p>}
      {a && (
        <div className="mt-3 space-y-3">
          {a.headline && <p className="text-lg font-semibold">{a.headline}</p>}
          {a.gp_summary && <p className="text-ink/80">{a.gp_summary}</p>}
          {!!a.symptom_tags?.length && (
            <div className="flex flex-wrap gap-2">
              {a.symptom_tags.map((t) => (
                <span key={t.tag} title={t.dates.join(", ")} className="rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand-dark">
                  {t.tag} ×{t.count}
                </span>
              ))}
            </div>
          )}
          {!!a.red_flags?.length && (
            <ul className="rounded-2xl bg-coral-soft p-3 text-coral">
              {a.red_flags.map((f) => <li key={f}>⚠ {f}</li>)}
            </ul>
          )}
          {!!a.worth_reviewing?.length && (
            <div>
              <p className="text-sm font-semibold text-muted">Worth reviewing</p>
              <ul className="list-disc pl-5">{a.worth_reviewing.map((q) => <li key={q}>{q}</li>)}</ul>
            </div>
          )}
          <p className="text-xs text-faint">
            Generated {new Date(result!.generated_at).toLocaleString("en-SG", { timeZone: "Asia/Singapore" })}. Statistics are computed in code; the AI only explains them. Not a diagnosis.
          </p>
        </div>
      )}
    </section>
  );
}

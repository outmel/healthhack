"use client";

import { useState } from "react";
import { StatusIcon } from "@/components/Shell";
import { Download } from "@/components/icons";
import type { Analysis } from "@/lib/data";

const BADGE: Record<Analysis["urgency"], { label: string; level: "normal" | "watch" | "urgent"; cls: string }> = {
  routine: { label: "Routine · within her usual", level: "normal", cls: "bg-brand-soft text-brand-dark" },
  review_soon: { label: "Review soon", level: "watch", cls: "bg-sun-soft text-sun" },
  urgent: { label: "Urgent · act now", level: "urgent", cls: "bg-coral text-white" },
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
  const badge = result ? BADGE[result.urgency] : null;
  const updated = result
    ? new Date(result.generated_at).toLocaleTimeString("en-SG", { timeZone: "Asia/Singapore", hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <section className="overflow-hidden rounded-[22px] border border-line bg-paper">
      <div className={`flex flex-wrap items-center justify-between gap-2 px-5 py-3 ${badge?.cls ?? "bg-track text-muted"}`}>
        <p className="flex items-center gap-2 font-extrabold">
          {badge ? <><StatusIcon level={badge.level} /> {badge.label}</> : "No AI summary yet"}
        </p>
        {updated && <p className="text-sm font-semibold opacity-90">AI summary · updated {updated}</p>}
      </div>

      <div className="p-5 text-[15px]">
        {state === "error" && <p className="mb-3 text-coral">{error}</p>}
        {!a && state !== "busy" && <p className="text-muted">Run an analysis to get a GP-ready summary of the trends and notes.</p>}
        {a && (
          <div className="space-y-4">
            {a.headline && <p className="text-[22px] font-extrabold leading-snug">{a.headline}</p>}
            {a.gp_summary && <p className="leading-relaxed text-body">{bold(a.gp_summary)}</p>}
            {!!a.symptom_tags?.length && (
              <div className="flex flex-wrap gap-2">
                {a.symptom_tags.map((t) => (
                  <span key={t.tag} title={t.dates.join(", ")} className="rounded-full border border-line bg-cream px-3 py-1 text-sm font-semibold">
                    {t.tag} ×{t.count}
                  </span>
                ))}
              </div>
            )}
            {!!a.red_flags?.length && (
              <ul className="rounded-2xl bg-coral-soft p-4 font-semibold text-coral">
                {a.red_flags.map((f) => <li key={f}>⚠ {f}</li>)}
              </ul>
            )}
            {!!a.worth_reviewing?.length && (
              <div className="rounded-2xl bg-cream p-4">
                <p className="font-extrabold">Worth checking at the visit</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-body">{a.worth_reviewing.map((q) => <li key={q}>{q}</li>)}</ul>
              </div>
            )}
          </div>
        )}

        <div className="no-print mt-5 flex flex-wrap items-center gap-3">
          <button onClick={run} disabled={state === "busy"} className="min-h-[52px] rounded-2xl bg-brand px-5 font-extrabold text-cream hover:bg-brand-dark disabled:opacity-60">
            {state === "busy" ? "Analysing… (up to a minute)" : result ? "Re-analyse with AI" : "Analyse with AI"}
          </button>
          {a && (
            <button onClick={() => window.print()} className="flex items-center gap-1.5 font-bold text-brand underline underline-offset-4">
              <Download className="h-4 w-4" /> Download 1-page summary
            </button>
          )}
        </div>
        {a && (
          <p className="mt-4 text-xs text-faint">
            Statistics are computed in code; the AI only explains them. Not a diagnosis.
          </p>
        )}
      </div>
    </section>
  );
}

/** Make the figures in the summary easy to scan: bold numbers with their units. */
function bold(text: string) {
  return text.split(/(\d+(?:\.\d+)?\s?(?:%|s\b|sec(?:onds)?\b|days?\b|SD\b)?)/g).map((p, i) => (i % 2 ? <strong key={i} className="text-ink">{p}</strong> : p));
}

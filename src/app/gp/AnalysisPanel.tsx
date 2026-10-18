"use client";

import { useEffect, useState } from "react";
import { StatusIcon } from "@/components/Shell";
import { Clock, Download, Phone, Stethoscope } from "@/components/icons";
import { AreaCard } from "@/components/ActionPlan";
import type { Analysis } from "@/lib/data";

const BADGE: Record<Analysis["urgency"], { label: string; level: "normal" | "watch" | "urgent"; cls: string }> = {
  routine: { label: "Routine · within her usual", level: "normal", cls: "bg-brand-soft text-brand-dark" },
  review_soon: { label: "Review soon", level: "watch", cls: "bg-sun-soft text-sun" },
  urgent: { label: "Urgent · act now", level: "urgent", cls: "bg-coral text-white" },
};

const SEE_GP: Record<NonNullable<NonNullable<Analysis["care_plan"]>["escalation"]>["see_gp"], string> = {
  now: "today",
  within_3_days: "within 3 days",
  next_routine_visit: "next routine visit",
};

export default function AnalysisPanel({ initial, lead, readOnly = false }: { initial: Analysis | null; lead?: string; readOnly?: boolean }) {
  const [result, setResult] = useState(initial);
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [error, setError] = useState("");

  async function run() {
    setState("busy");
    const res = await fetch("/api/analyse", { method: "POST" }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) {
      // Keep whatever summary is on screen; never replace it with an error code.
      setError(result ? "Couldn't refresh, showing last summary." : `${data.error ?? "The AI service isn't available right now."} The trends below are up to date.`);
      return setState("error");
    }
    setResult(data);
    setState("idle");
  }

  const a = result?.analysis;
  const plan = result?.care_plan;
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
        {updated && (
          <p className="text-sm font-semibold opacity-90">
            {result?.source === "prepared" ? `Prepared summary · ${updated}` : `AI summary · updated ${updated}`}
          </p>
        )}
      </div>

      <div className="p-5 text-[15px]">
        {state === "error" && <p role="status" className={`mb-3 font-semibold ${result ? "text-muted" : "text-coral"}`}>{error}</p>}
        {!a && state !== "busy" && <p className="text-muted">{readOnly ? "No AI summary yet. The trends are below." : "Run an analysis to get a GP-ready summary of the trends and notes."}</p>}
        {!a && lead && <LeadLine text={lead} />}
        {a && (
          <div className="space-y-4">
            {a.headline && <p className="text-[22px] font-extrabold leading-snug">{a.headline}</p>}
            {lead && <LeadLine text={lead} />}
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
            {/* The care plan's "Clinical checks" cover the same ground; show these only when it has none. */}
            {!!a.worth_reviewing?.length && !(plan && !plan.parse_error && plan.gp_checks?.length) && (
              <div className="rounded-2xl bg-cream p-4">
                <p className="font-extrabold">Worth checking at the visit</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-body">{a.worth_reviewing.map((q) => <li key={q}>{q}</li>)}</ul>
              </div>
            )}
            {plan && !plan.parse_error && (
              <div className="space-y-3 border-t border-track pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-lg font-extrabold">Care plan</p>
                  {plan.escalation && (
                    <span className="rounded-full bg-sun-soft px-3 py-1 text-sm font-bold text-sun">See GP: {SEE_GP[plan.escalation.see_gp]}</span>
                  )}
                </div>
                <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
                  {!!plan.gp_checks?.length && (
                    <div className="rounded-2xl border-2 border-brand/40 bg-paper p-4">
                      <p className="flex items-center gap-2 font-extrabold text-brand-dark"><Stethoscope className="h-5 w-5" /> Clinical checks to consider</p>
                      <ol className="mt-2 flex flex-col gap-2">
                        {plan.gp_checks.map((q, i) => (
                          <li key={q} className="flex gap-2.5 leading-snug text-body">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-extrabold text-brand-dark">{i + 1}</span>
                            {q}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {!!plan.escalation?.call_995_if.length && (
                    <div className="no-print rounded-2xl bg-coral-soft p-4 text-coral">
                      <p className="flex items-center gap-2 font-extrabold"><Phone className="h-5 w-5" /> Call 995 if</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 font-semibold">{plan.escalation.call_995_if.map((x) => <li key={x}>{x}</li>)}</ul>
                    </div>
                  )}
                </div>
                {!!plan.focus_areas?.length && (
                  <>
                    <p className="no-print eyebrow pt-1 text-muted">What the family and helper are doing at home</p>
                    <div className="no-print grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
                      {plan.focus_areas.map((f) => (
                        <AreaCard key={f.area} area={f} actions={[...(f.family_actions ?? []), ...(f.helper_actions ?? [])]} startLabel="First step at home" />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {state === "busy" && <AnalysisProgress keeping={!!result} />}

        <div className="no-print mt-5 flex flex-wrap items-center gap-3">
          {!readOnly && (
            <button onClick={run} disabled={state === "busy"} className="min-h-[52px] rounded-2xl bg-brand px-5 font-extrabold text-cream hover:bg-brand-dark disabled:opacity-60">
              {state === "busy" ? "Analysing… (up to a minute)" : result ? "Re-analyse with AI" : "Analyse with AI"}
            </button>
          )}
          {(a || readOnly) && (
            <button onClick={() => window.print()} className="flex items-center gap-1.5 font-bold text-brand underline underline-offset-4">
              <Download className="h-4 w-4" /> Download 1-page summary
            </button>
          )}
        </div>
        {a && (
          <p className="mt-4 text-xs text-faint">
            {result?.source === "prepared"
              ? "Prepared from the same statistics for the demo; press Re-analyse for a live AI run. Not a diagnosis."
              : "Statistics are computed in code; the AI only explains them. Not a diagnosis."}
          </p>
        )}
      </div>
    </section>
  );
}

/** How early Teman noticed: dates computed from the data in src/lib/baseline.ts, never typed. */
function LeadLine({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2 rounded-2xl bg-sun-soft px-3 py-2 text-[15px] font-bold text-sun-deep">
      <Clock className="mt-0.5 h-4 w-4 shrink-0" /> {text}
    </p>
  );
}

/** Make the figures in the summary easy to scan: bold numbers with their units. */
function bold(text: string) {
  return text.split(/(\d+(?:\.\d+)?\s?(?:%|s\b|sec(?:onds)?\b|days?\b|SD\b)?)/g).map((p, i) => (i % 2 ? <strong key={i} className="text-ink">{p}</strong> : p));
}

// The n8n workflow's steps, with roughly when each starts (seconds). The run reports no progress,
// so the bar is timed: it eases towards 95% and only fills when the result arrives.
const STEPS: [number, string][] = [
  [0, "Reading her last 4 weeks of data"],
  [3, "Comparing with her own baseline"],
  [6, "Trend analyser is explaining the changes"],
  [30, "Healthcare advisor is writing the care plan"],
  [55, "Checking safety rules and saving"],
];

function AnalysisProgress({ keeping }: { keeping: boolean }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setSecs((Date.now() - start) / 1000), 250);
    return () => clearInterval(id);
  }, []);
  const pct = Math.round(95 * (1 - Math.exp(-secs / 25)));
  const step = STEPS.filter(([at]) => secs >= at).length;
  return (
    <div className="no-print mt-4 rounded-2xl bg-cream p-4" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3 text-[15px]">
        <p className="font-bold">{STEPS[step - 1][1]}…</p>
        <p className="shrink-0 tabular-nums text-sm text-muted">Step {step} of {STEPS.length} · {Math.floor(secs)} s</p>
      </div>
      <div
        role="progressbar"
        aria-label="AI analysis progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-track"
      >
        <div className="h-full rounded-full bg-brand transition-[width] duration-300 ease-out" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-sm text-muted">Usually under a minute.{keeping ? " The current summary stays until the new one is ready." : ""}</p>
    </div>
  );
}

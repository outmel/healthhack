// The GP report: used by the doctor view (/gp) and the read-only share link (/summary/[token]).
import { Card } from "@/components/Shell";
import CareTimeline from "@/components/CareTimeline";
import StandReplay from "@/components/StandReplay";
import {
  getAlerts, getCarerStatus, getHelper, getLatestAnalysis, getLeadTime, getRestDay, getSignals, getStandComparison,
  getStandTests, getVoiceNotes, LANG_EN, sgDay, type Senior,
} from "@/lib/data";
import { agoLabel, fmtDay, lastDays, sgToday } from "@/lib/format";
import { formatReps } from "@/lib/pose";
import TrendChart, { type Reference } from "./TrendChart";
import AnalysisPanel from "./AnalysisPanel";

const SHOWN = 3;
const day = (d: string | Date) => fmtDay(sgDay(d), { weekday: false });

// Buatois S et al. "Five times sit to stand test is a predictor of recurrent falls in healthy
// community-living subjects aged 65 and older." J Am Geriatr Soc 2008;56(8):1575-7. PMID 18808608.
// Cut-off: >= 15 s. Check against the full text before quoting sensitivity/specificity.
const FALLS_CUTOFF: Reference = { value: 15, label: "Falls-risk cut-off" };
const BUATOIS = "https://pubmed.ncbi.nlm.nih.gov/18808608/";

export default async function PatientReport({ senior, household, readOnly = false }: { senior: Senior; household: number; readOnly?: boolean }) {
  const [signals, alerts, notes, analysis, carer, tests, restDay, helper] = await Promise.all([
    getSignals(senior.id),
    getAlerts(senior.id),
    getVoiceNotes(senior.id, 40),
    getLatestAnalysis(senior.id),
    getCarerStatus(household),
    getStandTests(senior.id),
    getRestDay(household),
    getHelper(household),
  ]);
  const helperLang = LANG_EN[helper?.language ?? "id"] ?? "her language";
  const replay = readOnly ? null : await getStandComparison(senior.id, signals.mobility.series);
  const alert = alerts[0];
  const booked = alerts.find((a) => a.gp_review_at);
  const lead = getLeadTime(signals);
  const today = sgToday();

  // Concern tags from translateNote plus the AI's symptom tags; days with any are marked on the charts.
  const aiTags = analysis?.analysis.symptom_tags ?? [];
  const noteDays = [...new Set([
    ...aiTags.flatMap((t) => t.dates.map((d) => String(d).slice(0, 10))),
    ...notes.filter((n) => n.concerns.length).map((n) => sgDay(n.created_at)),
  ])];
  const tagWords = [...aiTags.map((t) => t.tag), ...notes.flatMap((n) => n.concerns)];
  const findings = Object.fromEntries(
    tests.filter((t) => t.findings.includes("used_hands")).map((t) => [t.day, `Pushed up with hands, reps ${formatReps(t.hand_reps)}`]),
  );
  const lastUpdate = notes[0]?.created_at ?? analysis?.generated_at;
  const leadLine = lead.flagged
    ? [
        lead.driftStart && `Change began ${fmtDay(lead.driftStart, { weekday: false })}`,
        `flagged ${fmtDay(lead.flagged, { weekday: false })}`,
        lead.alerted && `family alerted ${fmtDay(lead.alerted, { weekday: false })}`,
        booked?.gp_review_at && `GP review booked for ${fmtDay(sgDay(booked.gp_review_at), { weekday: false })}`,
      ].filter(Boolean).join(" · ")
    : undefined;

  return (
    <div className="flex flex-wrap items-start gap-5">
      {/* Patient summary */}
      <aside className="flex-[1_1_260px] lg:sticky lg:top-6 lg:max-w-[320px]">
        <Card className="text-[15px]">
          <p className="eyebrow text-muted">Patient</p>
          <h1 className="mt-1 text-[26px] font-extrabold tracking-tight">{senior.name}, {senior.age}</h1>
          <dl className="mt-3 flex flex-col gap-2.5">
            <Row label="Conditions">{senior.conditions.length ? senior.conditions.join(", ") : "None recorded"}</Row>
            <Row label="Medications">{senior.medications.length ? senior.medications.join(", ") : "None recorded"}</Row>
            {carer && <Row label="Helper">{carer.name} · {helperLang === "English" ? "notes in English" : `notes in ${helperLang}, translated`}</Row>}
            {lastUpdate && <Row label="Last update">{day(lastUpdate)}</Row>}
            {booked?.gp_review_at && <Row label="GP review">Booked by family for {fmtDay(sgDay(booked.gp_review_at))}</Row>}
          </dl>
          {carer && (
            <>
              <hr className="my-4 border-track" />
              <p className="eyebrow text-rose">Carer wellbeing</p>
              <p className="mt-1 text-body">
                {carer.name} has had no rest day in {carer.daysWithoutRest} days
                {carer.avgMood != null && carer.avgMood <= 2.5 ? " and reports low mood" : ""}.
                {carer.needsNudge ? " Carer strain can affect care at home." : ""}
              </p>
              {restDay && <p className="mt-1 font-semibold text-rose">Rest day set for {fmtDay(restDay.day)} by {restDay.set_by}.</p>}
            </>
          )}
        </Card>
      </aside>

      <div className="flex min-w-0 flex-[3_1_560px] flex-col gap-5">
        <AnalysisPanel initial={analysis} lead={leadLine} readOnly={readOnly} />

        {!analysis && alert && (
          <p className="rounded-2xl bg-sun-soft p-4 text-sun-deep">
            <strong>Flag:</strong> {alert.signals.join(" + ")} outside personal baseline (3-day mean vs. 14-day baseline, &gt;1.5 SD).
          </p>
        )}

        <Card>
          <h2 className="text-lg font-extrabold">Last 28 days</h2>
          <p className="text-sm text-muted">Each mark is a day. Hover for values.</p>
          <div className="mt-3">
            <CareTimeline
              days={lastDays(28, today)}
              meal={signals.meal.series}
              mealStatus={signals.meal.status}
              mobility={signals.mobility.series}
              mobilityStatus={signals.mobility.status}
              notes={notes.map((n) => ({ day: sgDay(n.created_at), text: n.translated_text ?? n.original_text, concerns: n.concerns }))}
              flagDay={lead.flagged}
              driftDay={lead.driftStart}
              showValues
            />
          </div>
        </Card>

        <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
          <TrendChart title="Meal intake" subtitle="% of meal eaten, daily mean" unit="%" series={signals.meal.series} status={signals.meal.status} noteDays={noteDays} />
          <TrendChart
            title="5× sit-to-stand"
            subtitle="seconds, lower is better"
            unit=" s"
            series={signals.mobility.series}
            status={signals.mobility.status}
            noteDays={noteDays}
            reference={FALLS_CUTOFF}
            findings={findings}
          />
        </div>
        <p className="-mt-2 flex flex-wrap gap-x-5 gap-y-1 px-1 text-sm text-muted">
          <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded bg-brand-soft" /> Her usual range (14-day baseline ± 1.5 SD)</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-turmeric" /> Helper note mentions a symptom</span>
          <span className="flex items-center gap-1.5"><span className="h-0 w-5 border-t-2 border-dashed border-coral" /> Falls-risk cut-off ≥{FALLS_CUTOFF.value} s (<a href={BUATOIS} target="_blank" rel="noreferrer" className="underline underline-offset-2">Buatois et al., JAGS 2008</a>)</span>
          <span className="flex items-center gap-1.5">✋ Camera saw her push up with her hands</span>
        </p>

        {replay && (
          <Card className="no-print">
            <h2 className="text-lg font-extrabold">Chair-stand: then vs now</h2>
            <p className="text-sm text-muted">
              A typical day from her baseline window (grey) against the latest test (green), from on-device pose landmarks. No video is stored.
            </p>
            <div className="mt-3 max-w-[520px]">
              <StandReplay
                then={{ seconds: replay.then.seconds, track: replay.then.track }}
                now={{ seconds: replay.now.seconds, track: replay.now.track }}
                thenLabel={`${fmtDay(replay.then.day, { weekday: false })} (${agoLabel(replay.then.day, today)})`}
                nowLabel={replay.now.day === today ? "Today" : fmtDay(replay.now.day, { weekday: false })}
                legend="Grey = baseline day · Green = latest"
              />
            </div>
          </Card>
        )}

        <Card>
          <h2 className="text-lg font-extrabold">What {carer?.name ?? "the helper"} noticed</h2>
          <p className="text-sm text-muted">Translated from the original; original shown underneath. Tags are concerns picked out at translation.</p>
          {notes.length === 0 ? (
            <p className="mt-3 text-muted">No notes recorded.</p>
          ) : (
            <>
              <NoteList notes={notes.slice(0, SHOWN)} tags={tagWords} />
              {notes.length > SHOWN && (
                <details className="group">
                  <summary className="no-print mt-3 inline-flex min-h-11 cursor-pointer list-none items-center rounded-2xl border-2 border-brand px-4 font-bold text-brand group-open:hidden">
                    Show {notes.length - SHOWN} earlier notes
                  </summary>
                  <NoteList notes={notes.slice(SHOWN)} tags={tagWords} />
                </details>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  );
}

type Note = { id: number; created_at: string; translated_text: string | null; original_text: string; concerns: string[] };

function NoteList({ notes, tags }: { notes: Note[]; tags: string[] }) {
  return (
    <ul className="mt-3 divide-y divide-track">
      {notes.map((n) => (
        <li key={n.id} className="grid gap-1 py-3 sm:grid-cols-[72px_1fr]">
          <span className="text-sm font-bold text-muted">{day(n.created_at)}</span>
          <span>
            <span className="block text-body">{n.translated_text ? highlight(n.translated_text, tags) : "—"}</span>
            <span className="mt-0.5 block text-sm italic text-muted">“{n.original_text}”</span>
            {n.concerns.length > 0 && (
              <span className="mt-1.5 flex flex-wrap gap-1.5">
                {n.concerns.map((c) => (
                  <span key={c} className="rounded-full border border-sun-line bg-sun-soft px-2.5 py-0.5 text-xs font-bold text-sun-deep">{c}</span>
                ))}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Highlight symptom words the AI tagged, where they appear literally in the note. */
function highlight(text: string, tags: string[]) {
  const words = [...new Set(tags)].filter((t) => t.length > 2).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length) return text;
  const re = new RegExp(`(${words.join("|")})`, "gi");
  return text.split(re).map((part, i) =>
    i % 2 ? <mark key={i} className="rounded bg-sun-soft px-0.5 text-sun-deep">{part}</mark> : part,
  );
}

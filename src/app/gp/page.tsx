import Shell, { Card } from "@/components/Shell";
import LogoutButton from "@/components/LogoutButton";
import { requireRole } from "@/lib/auth";
import { getAlerts, getCarerStatus, getLatestAnalysis, getSenior, getSignals, getVoiceNotes } from "@/lib/data";
import TrendChart from "./TrendChart";
import AnalysisPanel from "./AnalysisPanel";

const TZ = "Asia/Singapore";
const day = (d: string) => new Date(d).toLocaleDateString("en-SG", { timeZone: TZ, day: "numeric", month: "short" });
const SHOWN = 3;

export default async function GpPage() {
  const session = await requireRole("gp");
  const senior = await getSenior(session.household);
  const [signals, alerts, notes, analysis, carer] = await Promise.all([
    getSignals(senior.id),
    getAlerts(senior.id),
    getVoiceNotes(senior.id, 10),
    getLatestAnalysis(senior.id),
    getCarerStatus(session.household),
  ]);
  const alert = alerts[0];
  const tags = analysis?.analysis.symptom_tags ?? [];
  // Days the helper's notes mention a symptom, marked on the charts.
  const noteDays = [...new Set(tags.flatMap((t) => t.dates.map((d) => String(d).slice(0, 10))))];
  const lastUpdate = notes[0]?.created_at ?? analysis?.generated_at;

  return (
    <Shell
      wide
      badge={<span className="rounded-full bg-brand-soft px-3 py-1 text-sm font-bold text-brand-dark">Doctor view</span>}
      right={
        <span className="flex items-center gap-4 text-[15px] text-muted">
          <span className="hidden sm:inline">Signed in as {session.name}</span>
          <LogoutButton />
        </span>
      }
    >
      <div className="flex flex-wrap items-start gap-5">
        {/* Patient summary */}
        <aside className="flex-[1_1_260px] lg:sticky lg:top-6 lg:max-w-[320px]">
          <Card className="text-[15px]">
            <p className="eyebrow text-muted">Patient</p>
            <h1 className="mt-1 text-[26px] font-extrabold tracking-tight">{senior.name}, {senior.age}</h1>
            <dl className="mt-3 flex flex-col gap-2.5">
              <Row label="Conditions">{senior.conditions.length ? senior.conditions.join(", ") : "None recorded"}</Row>
              {carer && <Row label="Helper">{carer.name} · notes in Bahasa, translated</Row>}
              {lastUpdate && <Row label="Last update">{day(lastUpdate)}</Row>}
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
              </>
            )}
          </Card>
        </aside>

        <div className="flex min-w-0 flex-[3_1_560px] flex-col gap-5">
          <AnalysisPanel initial={analysis} />

          {!analysis && alert && (
            <p className="rounded-2xl bg-sun-soft p-4 text-sun-deep">
              <strong>Flag:</strong> {alert.signals.join(" + ")} outside personal baseline (3-day mean vs. 14-day baseline, &gt;1.5 SD).
            </p>
          )}

          <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
            <TrendChart title="Meal intake" subtitle="% of meal eaten, daily mean" unit="%" series={signals.meal.series} status={signals.meal.status} noteDays={noteDays} />
            <TrendChart title="5× sit-to-stand" subtitle="seconds, lower is better" unit=" s" series={signals.mobility.series} status={signals.mobility.status} noteDays={noteDays} />
          </div>
          <p className="-mt-2 flex flex-wrap gap-x-5 gap-y-1 px-1 text-sm text-muted">
            <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded bg-brand-soft" /> Her usual range (14-day baseline ± 1.5 SD)</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-turmeric" /> Helper note mentions a symptom</span>
          </p>

          <Card>
            <h2 className="text-lg font-extrabold">What {carer?.name ?? "the helper"} noticed</h2>
            <p className="text-sm text-muted">Translated from the original; original shown underneath.</p>
            {notes.length === 0 ? (
              <p className="mt-3 text-muted">No notes recorded.</p>
            ) : (
              <>
                <NoteList notes={notes.slice(0, SHOWN)} tags={tags.map((t) => t.tag)} />
                {notes.length > SHOWN && (
                  <details className="group">
                    <summary className="mt-3 inline-flex min-h-11 cursor-pointer list-none items-center rounded-2xl border-2 border-brand px-4 font-bold text-brand group-open:hidden">
                      Show {notes.length - SHOWN} earlier notes
                    </summary>
                    <NoteList notes={notes.slice(SHOWN)} tags={tags.map((t) => t.tag)} />
                  </details>
                )}
              </>
            )}
          </Card>
        </div>
      </div>
    </Shell>
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

type Note = { id: number; created_at: string; translated_text: string | null; original_text: string };

function NoteList({ notes, tags }: { notes: Note[]; tags: string[] }) {
  return (
    <ul className="mt-3 divide-y divide-track">
      {notes.map((n) => (
        <li key={n.id} className="grid gap-1 py-3 sm:grid-cols-[72px_1fr]">
          <span className="text-sm font-bold text-muted">{day(n.created_at)}</span>
          <span>
            <span className="block text-body">{n.translated_text ? highlight(n.translated_text, tags) : "—"}</span>
            <span className="mt-0.5 block text-sm italic text-muted">“{n.original_text}”</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Highlight symptom words the AI tagged, where they appear literally in the note. */
function highlight(text: string, tags: string[]) {
  const words = tags.filter((t) => t.length > 2).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length) return text;
  const re = new RegExp(`(${words.join("|")})`, "gi");
  return text.split(re).map((part, i) =>
    i % 2 ? <mark key={i} className="rounded bg-sun-soft px-0.5 text-sun-deep">{part}</mark> : part,
  );
}

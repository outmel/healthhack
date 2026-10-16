import Shell, { Card } from "@/components/Shell";
import { Download, Message } from "@/components/icons";
import { requireRole } from "@/lib/auth";
import { getAlerts, getCarerStatus, getLatestAnalysis, getSenior, getSignals, getVoiceNotes } from "@/lib/data";
import TrendChart from "./TrendChart";
import AnalysisPanel from "./AnalysisPanel";

const day = (d: string) => new Date(d).toLocaleDateString("en-SG", { timeZone: "Asia/Singapore", day: "numeric", month: "short" });

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

  return (
    <Shell
      wide
      eyebrow={`Patient · ${session.name}`}
      title={senior.name}
      subtitle={
        <span className="flex flex-wrap items-center gap-2 text-base">
          <Chip>{senior.age} years</Chip>
          {senior.conditions.map((c) => <Chip key={c}>{c}</Chip>)}
          {carer && <Chip>Helper: {carer.name}</Chip>}
        </span>
      }
    >
      <AnalysisPanel initial={analysis} />

      {!analysis && alert && (
        <p className="rounded-2xl bg-sun-soft p-4 ring-1 ring-sun-line">
          <strong>Flag:</strong> {alert.signals.join(" + ")} outside personal baseline (3-day mean vs. 14-day baseline, &gt;1.5 SD).
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <TrendChart title="Meal intake" subtitle="% of meal eaten, daily mean" unit="%" series={signals.meal.series} status={signals.meal.status} />
        <TrendChart title="5× sit-to-stand" subtitle="seconds, lower is better" unit=" s" series={signals.mobility.series} status={signals.mobility.status} />
      </div>

      <Card>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
          <Message className="h-5 w-5 text-brand" /> Helper notes
          <span className="text-sm font-normal text-faint">translated from the original</span>
        </h2>
        {notes.length === 0 ? (
          <p className="text-muted">No notes recorded.</p>
        ) : (
          <ul className="divide-y divide-line">
            {notes.map((n) => (
              <li key={n.id} className="grid gap-1 py-3 sm:grid-cols-[5rem_1fr]">
                <span className="text-sm font-semibold text-faint">{day(n.created_at)}</span>
                <span>
                  <span className="block">{n.translated_text ?? "—"}</span>
                  <span className="block text-sm italic text-muted">“{n.original_text}”</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Lane 1/4: wire this to /api/export (FHIR-style JSON) — nice-to-have */}
      <button disabled className="flex items-center gap-2 self-start rounded-full border border-line bg-paper px-4 py-2 font-semibold text-faint">
        <Download className="h-4 w-4" /> Export NEHR-ready summary (coming soon)
      </button>
    </Shell>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-paper px-3 py-1 font-semibold text-muted ring-1 ring-line">{children}</span>;
}

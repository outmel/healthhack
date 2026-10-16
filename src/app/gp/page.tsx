import Shell from "@/components/Shell";
import { requireRole } from "@/lib/auth";
import { getAlerts, getSenior, getSignals, getVoiceNotes } from "@/lib/data";
import TrendChart from "./TrendChart";

export default async function GpPage() {
  const session = await requireRole("gp");
  const senior = await getSenior(session.household);
  const [signals, alerts, notes] = await Promise.all([getSignals(senior.id), getAlerts(senior.id), getVoiceNotes(senior.id, 10)]);

  return (
    <Shell title={`${senior.name}, ${senior.age}`} subtitle={senior.conditions.join(", ")}>
      {alerts[0] && (
        <p className="rounded-xl bg-amber-100 p-3">
          <strong>Flag:</strong> {alerts[0].signals.join(" + ")} below personal baseline (3-day mean vs. 14-day baseline, &gt;1.5 SD).
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <TrendChart title="Meal intake (% eaten, daily mean)" unit="%" series={signals.meal.series} status={signals.meal.status} />
        <TrendChart title="5× sit-to-stand (seconds)" unit="s" series={signals.mobility.series} status={signals.mobility.status} />
      </div>
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold">Helper notes (translated)</h2>
        <ul className="divide-y divide-stone-100">
          {notes.map((n) => (
            <li key={n.id} className="py-2">
              <p>{n.translated_text ?? "—"}</p>
              <p className="text-sm italic text-stone-500">“{n.original_text}”</p>
              <p className="text-xs text-stone-400">{new Date(n.created_at).toLocaleDateString("en-SG", { timeZone: "Asia/Singapore" })}</p>
            </li>
          ))}
        </ul>
      </section>
      {/* Lane 1/4: wire this to /api/export (FHIR-style JSON) — nice-to-have */}
      <button disabled className="self-start rounded-xl border border-stone-300 px-4 py-2 text-stone-400">Export NEHR-ready summary (coming)</button>
    </Shell>
  );
}

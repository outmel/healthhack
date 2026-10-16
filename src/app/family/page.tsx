import Shell from "@/components/Shell";
import { requireRole } from "@/lib/auth";
import { getAlerts, getCarerStatus, getLatestAnalysis, getSenior, getSignals, getVoiceNotes } from "@/lib/data";

const sgDate = (d: string | Date) =>
  new Date(d).toLocaleString("en-SG", { timeZone: "Asia/Singapore", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default async function FamilyPage() {
  const session = await requireRole("family");
  const senior = await getSenior(session.household);
  const [signals, alerts, notes, carer, ai] = await Promise.all([
    getSignals(senior.id),
    getAlerts(senior.id),
    getVoiceNotes(senior.id, 3),
    getCarerStatus(session.household),
    getLatestAnalysis(senior.id),
  ]);
  const meal = signals.meal.status;
  const mob = signals.mobility.status;

  return (
    <Shell title={`${senior.name} this week`} subtitle={`Hi ${session.name}. Here's what ${carer?.name ?? "the helper"} noticed.`}>
      {alerts.filter((a) => !a.acknowledged).slice(0, 1).map((a) => (
        <section key={a.id} className={`rounded-2xl p-5 ${a.severity === "review" ? "bg-amber-100 ring-2 ring-amber-400" : "bg-sky-50"}`}>
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-800">{a.severity === "review" ? "Worth a GP visit" : "Keep an eye on"}</p>
          <p className="mt-1 text-xl font-semibold">{a.message}</p>
          {ai?.analysis.family_message && <p className="mt-2 text-stone-700">{ai.analysis.family_message}</p>}
          <p className="mt-2 text-sm text-stone-600">{sgDate(a.created_at)} · signals: {a.signals.join(" + ")}</p>
        </section>
      ))}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Eating" value={meal?.recent != null ? `${Math.round(meal.recent)}%` : "—"} usual={meal ? `usually ${Math.round(meal.mean)}%` : "building her baseline"} flagged={meal?.flagged} />
        <Card title="Chair-stand (5×)" value={mob?.recent != null ? `${mob.recent.toFixed(1)} s` : "—"} usual={mob ? `usually ${mob.mean.toFixed(1)} s` : "building her baseline"} flagged={mob?.flagged} />
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-2 font-semibold">Notes from {carer?.name ?? "the helper"}</h2>
        {notes.length === 0 && <p className="text-stone-500">No notes yet.</p>}
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id}>
              <p>{n.translated_text ?? <span className="italic text-stone-500">Translating…</span>}</p>
              <p className="text-xs text-stone-500">{sgDate(n.created_at)}</p>
            </li>
          ))}
        </ul>
      </section>

      {carer?.needsNudge && (
        <section className="rounded-2xl bg-rose-50 p-5 ring-1 ring-rose-200">
          <p className="text-sm font-semibold uppercase tracking-wide text-rose-700">Teman cares for the carer</p>
          <p className="mt-1 text-lg">
            {carer.name} hasn&apos;t had a rest day in {carer.daysWithoutRest} days. Could you plan a day off for her this week?
          </p>
          {ai?.analysis.carer_wellbeing && <p className="mt-1 text-stone-600">{ai.analysis.carer_wellbeing}</p>}
        </section>
      )}
    </Shell>
  );
}

function Card({ title, value, usual, flagged }: { title: string; value: string; usual: string; flagged?: boolean }) {
  return (
    <section className={`rounded-2xl bg-white p-5 shadow-sm ${flagged ? "ring-2 ring-amber-400" : ""}`}>
      <p className="text-sm text-stone-500">{title} · last 3 days</p>
      <p className="text-4xl font-bold">{value}</p>
      <p className={flagged ? "text-amber-700" : "text-stone-500"}>{flagged ? `⚠ ${usual}` : usual}</p>
    </section>
  );
}

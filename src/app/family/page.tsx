import Shell, { Card } from "@/components/Shell";
import Sparkline from "@/components/Sparkline";
import { Alert, Chair, Check, Heart, Message, Sparkle, Utensils } from "@/components/icons";
import { requireRole } from "@/lib/auth";
import { getAlerts, getCarerStatus, getLatestAnalysis, getSenior, getSignals, getVoiceNotes } from "@/lib/data";

const when = (d: string | Date) =>
  new Date(d).toLocaleString("en-SG", { timeZone: "Asia/Singapore", weekday: "short", day: "numeric", month: "short" });

export default async function FamilyPage() {
  const session = await requireRole("family");
  const senior = await getSenior(session.household);
  const [signals, alerts, notes, carer, ai] = await Promise.all([
    getSignals(senior.id),
    getAlerts(senior.id),
    getVoiceNotes(senior.id, 4),
    getCarerStatus(session.household),
    getLatestAnalysis(senior.id),
  ]);
  const meal = signals.meal.status;
  const mob = signals.mobility.status;
  const alert = alerts.find((a) => !a.acknowledged);
  const helper = carer?.name ?? "the helper";

  return (
    <Shell eyebrow={`Hi ${session.name}`} title={`How ${senior.name} is doing`} subtitle={`Based on what ${helper} noticed this week.`}>
      {/* 1. The one thing to know */}
      {alert ? (
        <section className="rounded-3xl bg-sun-soft p-5 ring-1 ring-sun-line">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-sun">
              <Alert />
            </span>
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-sun">
                {alert.severity === "review" ? "Worth a doctor's visit" : "Worth keeping an eye on"}
              </p>
              <p className="mt-1 text-xl font-bold leading-snug">{alert.message}</p>
              {ai?.analysis.family_message && <p className="mt-2 text-ink/80">{ai.analysis.family_message}</p>}
              <p className="mt-3 text-sm text-muted">Noticed {when(alert.created_at)}</p>
            </div>
          </div>
        </section>
      ) : (
        <section className="flex items-center gap-3 rounded-3xl bg-sage-soft p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-sage"><Check /></span>
          <p className="text-xl font-bold">{senior.name} is doing like her usual self this week.</p>
        </section>
      )}

      {/* 2. Each signal, in plain words, against her own usual */}
      <div className="grid gap-4 sm:grid-cols-2">
        <SignalCard
          Icon={Utensils}
          title={meal?.flagged ? "Eating less than usual" : "Eating as usual"}
          flagged={meal?.flagged}
          big={meal?.recent != null ? `${Math.round(meal.recent)}%` : "—"}
          bigLabel="of her meals eaten, last 3 days"
          usual={meal ? `Usually about ${Math.round(meal.mean)}%` : "Still learning her usual"}
          spark={<Sparkline series={signals.meal.series} status={meal} label="Meals eaten over the last 2 weeks" color={meal?.flagged ? "#b86e00" : "#0e6b63"} />}
        />
        <SignalCard
          Icon={Chair}
          title={mob?.flagged ? "Slower getting up from a chair" : "Getting up as usual"}
          flagged={mob?.flagged}
          big={mob?.recent != null ? `${Math.round(mob.recent)} sec` : "—"}
          bigLabel="to stand up 5 times, last 3 days"
          usual={mob ? `Usually about ${Math.round(mob.mean)} sec` : "Still learning her usual"}
          spark={<Sparkline series={signals.mobility.series} status={mob} label="Stand-up test times over the last 2 weeks" color={mob?.flagged ? "#b86e00" : "#0e6b63"} />}
        />
      </div>
      <p className="-mt-2 px-1 text-sm text-faint">The shaded band is her own usual range, not a textbook average.</p>

      {/* 3. Notes from the helper, as speech bubbles */}
      <Card>
        <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
          <Message className="h-5 w-5 text-brand" /> Notes from {helper}
        </h2>
        {notes.length === 0 ? (
          <p className="text-muted">No notes yet. They&apos;ll appear here, translated into English.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {notes.map((n) => (
              <li key={n.id} className="max-w-[90%]">
                <p className="rounded-3xl rounded-tl-md bg-brand-soft px-4 py-3 text-lg leading-snug">
                  {n.translated_text ?? <span className="italic text-muted">Translating…</span>}
                </p>
                <p className="mt-1 px-2 text-xs text-faint">{when(n.created_at)} · translated</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 4. The second patient: the carer */}
      {carer?.needsNudge && (
        <section className="rounded-3xl bg-lilac-soft p-5">
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[#6b4fa0]">
            <Heart className="h-4 w-4" /> Caring for the carer
          </p>
          <p className="mt-2 text-xl font-bold leading-snug">
            {helper} hasn&apos;t had a rest day in {carer.daysWithoutRest} days.
          </p>
          <p className="mt-1 text-ink/80">
            {ai?.analysis.carer_wellbeing || `Looking after ${senior.name} is tiring work. Could you plan a day off for ${helper} this week?`}
          </p>
        </section>
      )}

      {ai && (
        <p className="flex items-center gap-1.5 px-1 text-sm text-faint">
          <Sparkle className="h-4 w-4" /> Summary written with AI from the numbers above.
        </p>
      )}
    </Shell>
  );
}

function SignalCard({
  Icon, title, flagged, big, bigLabel, usual, spark,
}: {
  Icon: (p: { className?: string }) => React.ReactElement;
  title: string; flagged?: boolean; big: string; bigLabel: string; usual: string; spark: React.ReactNode;
}) {
  return (
    <Card className={flagged ? "ring-2 ring-sun-line" : ""}>
      <div className="flex items-center gap-2">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${flagged ? "bg-sun-soft text-sun" : "bg-brand-soft text-brand"}`}>
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="text-lg font-bold leading-tight">{title}</h2>
      </div>
      <p className="mt-3 text-4xl font-extrabold tracking-tight">{big}</p>
      <p className="text-muted">{bigLabel}</p>
      <div className="mt-2">{spark}</div>
      <p className={`mt-1 font-semibold ${flagged ? "text-sun" : "text-muted"}`}>{usual}</p>
    </Card>
  );
}

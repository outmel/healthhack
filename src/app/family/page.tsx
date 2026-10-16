import Shell, { Card, StatusIcon } from "@/components/Shell";
import LogoutButton from "@/components/LogoutButton";
import { Calendar, Phone } from "@/components/icons";
import { requireRole } from "@/lib/auth";
import type { DailyPoint, SignalStatus } from "@/lib/baseline";
import { getAlerts, getCarerStatus, getLatestAnalysis, getSenior, getSignals, getVoiceNotes } from "@/lib/data";
import CarerActions from "./CarerActions";

const TZ = "Asia/Singapore";
const when = (d: string | Date) => new Date(d).toLocaleDateString("en-SG", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
const isoDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });

const LEVEL = {
  normal: { label: "Normal for her", strip: "bg-brand-soft text-brand-dark" },
  watch: { label: "Changing · keep watch", strip: "bg-sun-soft text-sun" },
  urgent: { label: "Act now · call 995", strip: "bg-coral text-white" },
} as const;

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
  const level = ai?.urgency === "urgent" ? "urgent" : alert ? "watch" : "normal";
  const week = weekTiles(signals.meal.series, meal, signals.mobility.series, mob);

  return (
    <Shell
      right={
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-lg font-extrabold text-brand-dark" aria-label={session.name}>
          {session.name[0]}
        </span>
      }
    >
      <header>
        <p className="text-[15px] text-muted">Hi {session.name} · {when(new Date())}</p>
        <h1 className="text-[28px] font-extrabold tracking-tight">How Mum is doing</h1>
      </header>

      {/* 1. The one thing to know */}
      <section className="overflow-hidden rounded-[22px] border border-line bg-paper">
        <p className={`flex items-center gap-2 px-5 py-2.5 text-[15px] font-extrabold ${LEVEL[level].strip}`}>
          <StatusIcon level={level} /> {LEVEL[level].label}
        </p>
        <div className="p-5">
          <p className="text-[21px] font-extrabold leading-snug">
            {alert?.message ?? `${senior.name} is doing like her usual self this week.`}
          </p>
          <p className="mt-2 text-body">
            {ai?.analysis.family_message ?? `Based on what ${helper} noticed, compared with her own usual.`}
          </p>
          {alert && <p className="mt-2 text-sm text-faint">Noticed {when(alert.created_at)}</p>}
          {alert?.severity === "review" && (
            <a
              href="https://www.healthhub.sg/"
              target="_blank"
              rel="noreferrer"
              className="mt-4 flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-brand text-[17px] font-extrabold text-cream hover:bg-brand-dark"
            >
              <Calendar className="h-5 w-5" /> Book a GP visit
            </a>
          )}
        </div>
      </section>
      <a href="tel:995" className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border-2 border-coral font-extrabold text-coral">
        <Phone className="h-5 w-5" /> Fall or not responding? Call 995
      </a>

      {/* 2. The week at a glance */}
      <Card>
        <h2 className="eyebrow text-muted">This week</h2>
        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {week.map((d) => (
            <div key={d.day} className="flex flex-col items-center gap-1">
              <span className="text-xs font-semibold text-muted">{d.label}</span>
              <span
                title={d.level === "watch" ? "Changing" : d.level === "normal" ? "Normal for her" : "No readings"}
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  d.today
                    ? `bg-turmeric text-sun-deep ring-2 ring-turmeric ring-offset-2`
                    : d.level === "watch" ? "bg-sun-soft text-sun" : d.level === "normal" ? "bg-brand-soft text-brand-dark" : "bg-track"
                }`}
              >
                {d.level !== "none" && <StatusIcon level={d.level} className="h-3.5 w-3.5" />}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-brand-soft" /> Normal for her</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-sun-soft ring-1 ring-sun-line" /> Changing</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-turmeric" /> Today</span>
        </p>
      </Card>

      {/* 3. Each signal against her own usual */}
      <div className="grid grid-cols-2 gap-3">
        <Metric
          title="Eating"
          big={meal?.recent != null ? `${Math.round(meal.recent)}%` : "—"}
          sub={meal ? `of each meal · usually ${Math.round(meal.mean)}%` : "Still learning her usual"}
          status={meal}
          scale={[0, 100]}
        />
        <Metric
          title="Standing up"
          big={mob ? (mob.flagged ? "Slower" : "As usual") : "—"}
          sub={mob?.recent != null ? `${Math.round(mob.recent)} s · usually ${Math.round(mob.mean)} s` : "Still learning her usual"}
          status={mob}
          scale={[0, Math.max(mob ? mob.mean + 2 * mob.sd : 0, mob?.recent ?? 0) * 1.25]}
        />
      </div>
      <p className="-mt-1 px-1 text-sm text-muted">Green band = what&apos;s normal for Mum</p>

      {/* 4. Notes from the helper */}
      <Card>
        <h2 className="text-lg font-extrabold">What {helper} noticed</h2>
        {notes.length === 0 ? (
          <p className="mt-2 text-muted">No notes yet. They&apos;ll appear here, translated into English.</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-track">
            {notes.map((n) => (
              <li key={n.id} className="py-3 first:pt-0 last:pb-0">
                <p className="text-[17px] leading-snug text-body">
                  {n.translated_text ? `“${n.translated_text}”` : <span className="italic text-muted">Translating…</span>}
                </p>
                <p className="mt-1 text-sm text-faint">{when(n.created_at)} · translated from Bahasa</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 5. The second patient: the carer */}
      {carer?.needsNudge && (
        <section className="rounded-[22px] bg-rose-soft p-5 text-rose-deep">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-rose text-lg font-extrabold text-white">{helper[0]}</span>
            <h2 className="text-lg font-extrabold">Looking after {helper} too</h2>
          </div>
          <p className="mt-3 text-[17px] font-bold">
            {helper} hasn&apos;t had a rest day in {carer.daysWithoutRest} days.
          </p>
          <p className="mt-1 text-rose-dark">
            {ai?.analysis.carer_wellbeing || `Looking after ${senior.name} is tiring work. Could you plan a day off for ${helper} this week?`}
          </p>
          <CarerActions helper={helper} />
        </section>
      )}

      {ai && <p className="px-1 text-sm text-faint">Summary written with AI from the numbers above.</p>}
      <div className="flex justify-center"><LogoutButton /></div>
    </Shell>
  );
}

type Tile = { day: string; label: string; today: boolean; level: "normal" | "watch" | "none" };

/** Last 7 days: amber if a reading fell outside her usual band in the bad direction. */
function weekTiles(meal: DailyPoint[], mealSt: SignalStatus | null, mob: DailyPoint[], mobSt: SignalStatus | null): Tile[] {
  const m = new Map(meal.map((p) => [p.day, p.value]));
  const s = new Map(mob.map((p) => [p.day, p.value]));
  const today = isoDay(new Date());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86_400_000);
    const day = isoDay(d);
    const mv = m.get(day), sv = s.get(day);
    const low = mv != null && mealSt != null && mv < mealSt.mean - 1.5 * mealSt.sd;
    const slow = sv != null && mobSt != null && sv > mobSt.mean + 1.5 * mobSt.sd;
    return {
      day,
      label: d.toLocaleDateString("en-SG", { timeZone: TZ, weekday: "narrow" }),
      today: day === today,
      level: low || slow ? "watch" : mv != null || sv != null ? "normal" : "none",
    };
  });
}

function Metric({ title, big, sub, status, scale }: { title: string; big: string; sub: string; status: SignalStatus | null; scale: [number, number] }) {
  const [lo, hi] = scale;
  const pct = (v: number) => `${Math.min(100, Math.max(0, ((v - lo) / (hi - lo || 1)) * 100))}%`;
  const flagged = status?.flagged;
  return (
    <section className="flex flex-col rounded-[22px] border border-line bg-paper p-4">
      <h2 className="eyebrow text-muted">{title}</h2>
      <p className={`mt-1 text-[28px] font-extrabold leading-tight ${flagged ? "text-sun" : ""}`}>{big}</p>
      <p className="text-[15px] leading-snug text-body">{sub}</p>
      {status && (
        <div className="relative mt-auto h-3 rounded-full bg-track pt-0" aria-hidden style={{ marginTop: 14 }}>
          <span
            className="absolute inset-y-0 rounded-full bg-brand-soft ring-1 ring-brand/30"
            style={{ left: pct(status.mean - 1.5 * status.sd), right: `calc(100% - ${pct(status.mean + 1.5 * status.sd)})` }}
          />
          {status.recent != null && (
            <span className={`absolute -inset-y-1 w-1 -translate-x-1/2 rounded-full ${flagged ? "bg-sun" : "bg-brand-dark"}`} style={{ left: pct(status.recent) }} />
          )}
        </div>
      )}
    </section>
  );
}

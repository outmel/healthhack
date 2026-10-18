import Shell, { Card, StatusIcon } from "@/components/Shell";
import LogoutButton from "@/components/LogoutButton";
import CareTimeline from "@/components/CareTimeline";
import WhyFlagged from "@/components/WhyFlagged";
import StandReplay from "@/components/StandReplay";
import { Message, Phone, Standing, Utensils } from "@/components/icons";
import { requireRole } from "@/lib/auth";
import type { DailyPoint, SignalStatus } from "@/lib/baseline";
import {
  getAlerts, getCarerDays, getCarerStatus, getCircle, getHelper, getLatestAnalysis, getLatestPerSender, getLeadTime, getRestDay, getSenior, getSignals,
  getStandComparison, getVoiceNotes, sgDay, translatedFrom, type VoiceNote,
} from "@/lib/data";
import { agoLabel, fmtDay, lastDays, sgToday } from "@/lib/format";
import { formatReps } from "@/lib/pose";
import { makeSummaryToken } from "@/lib/summaryToken";
import CarerActions from "./CarerActions";
import BookReview from "./BookReview";
import ActionPlan from "@/components/ActionPlan";

const TZ = "Asia/Singapore";
const when = (d: string | Date) => new Date(d).toLocaleDateString("en-SG", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });

type Level = "normal" | "watch" | "urgent";
const LEVEL = {
  normal: { label: "Normal for her", strip: "bg-brand-soft text-brand-dark" },
  watch: { label: "Changing · keep watch", strip: "bg-sun-soft text-sun" },
  urgent: { label: "Act now · call 995", strip: "bg-coral text-white" },
} as const;
const PICTO: Record<Level, string> = {
  normal: "bg-brand-soft text-brand-dark",
  watch: "bg-sun-soft text-sun ring-2 ring-turmeric",
  urgent: "bg-coral-soft text-coral ring-2 ring-coral",
};

export default async function FamilyPage() {
  const session = await requireRole("family");
  const senior = await getSenior(session.household);
  const [signals, alerts, notes, carer, ai, restDay, circle, helperUser, carerDays, inbox] = await Promise.all([
    getSignals(senior.id),
    getAlerts(senior.id),
    getVoiceNotes(senior.id, 40),
    getCarerStatus(session.household),
    getLatestAnalysis(senior.id),
    getRestDay(session.household),
    getCircle(session.household),
    getHelper(session.household),
    getCarerDays(session.household),
    getLatestPerSender(session.uid),
  ]);
  const replay = await getStandComparison(senior.id, signals.mobility.series);
  const plan = ai?.care_plan?.parse_error ? undefined : ai?.care_plan;
  const meal = signals.meal.status;
  const mob = signals.mobility.status;
  // A booked review keeps the alert visible (in its "booked" state) until the visit has passed.
  const today = sgToday();
  const [yesterday] = lastDays(2, today);
  const booked = alerts.find((a) => a.gp_review_at && sgDay(a.gp_review_at) >= yesterday);
  const alert = alerts.find((a) => !a.acknowledged) ?? booked;
  const helper = carer?.name ?? "the helper";
  const level: Level = ai?.urgency === "urgent" ? "urgent" : alert ? "watch" : "normal";
  const week = weekTiles(signals.meal.series, meal, signals.mobility.series, mob);
  const lead = getLeadTime(signals);

  // Pictograms: each signal against her own usual.
  const [fourDaysAgo] = lastDays(4, today);
  const recentConcern = notes.find((n) => n.concerns.length && sgDay(n.created_at) >= fourDaysAgo);
  const picto: { Icon: typeof Utensils; title: string; level: Level; word: string }[] = [
    { Icon: Utensils, title: "Eating", level: meal?.flagged ? "watch" : "normal", word: meal ? (meal.flagged ? "Eating less" : "As usual") : "Learning" },
    { Icon: Standing, title: "Standing up", level: mob?.flagged ? "watch" : "normal", word: mob ? (mob.flagged ? "Slower" : "As usual") : "Learning" },
    {
      Icon: Message,
      title: `${helper}'s notes`,
      level: ai?.urgency === "urgent" ? "urgent" : recentConcern ? "watch" : "normal",
      word: ai?.urgency === "urgent" ? "Red flag" : recentConcern ? "Concern noted" : "Nothing worrying",
    },
  ];

  // "Teman noticed this on Tue 13 Oct, before ..." the most serious note after the flag.
  const serious = lead.flagged ? mostSerious(notes, lead.flagged) : null;

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

      {/* Messages to the family: from the GP's contact card (last 7 days) */}
      {inbox.map((m) => (
        <section key={m.id} className="rounded-[22px] border-2 border-brand bg-paper p-5">
          <p className="eyebrow flex items-center gap-1.5 text-brand">
            <Message className="h-4 w-4" /> Message from {m.from_name}
          </p>
          <p className="mt-1.5 text-[19px] font-bold leading-snug">{m.original_text}</p>
          <p className="mt-1 text-sm text-faint">
            {new Date(m.created_at).toLocaleString("en-SG", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
          </p>
        </section>
      ))}

      {/* 1. Mum today: three pictograms against her own usual, one plain sentence */}
      <section className="overflow-hidden rounded-[22px] border border-line bg-paper">
        <p className={`flex items-center gap-2 px-5 py-2.5 text-[15px] font-extrabold ${LEVEL[level].strip}`}>
          <StatusIcon level={level} /> Mum today · {LEVEL[level].label}
        </p>
        <div className="p-5">
          <ul className="grid grid-cols-3 gap-2">
            {picto.map(({ Icon, title, level: l, word }) => (
              <li key={title} className="flex flex-col items-center gap-1.5 text-center">
                <span className={`flex h-16 w-16 items-center justify-center rounded-2xl ${PICTO[l]}`}>
                  <Icon className="h-8 w-8" />
                </span>
                <span className="text-xs font-semibold text-muted">{title}</span>
                <span className={`flex items-center gap-1 text-sm font-extrabold ${l === "normal" ? "text-brand-dark" : l === "watch" ? "text-sun" : "text-coral"}`}>
                  <StatusIcon level={l} className="h-3.5 w-3.5" /> {word}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[19px] font-extrabold leading-snug">
            {alert?.message ?? `${senior.name} is doing like her usual self this week.`}
          </p>
          <p className="mt-2 text-body">
            {ai?.analysis.family_message ?? `Based on what ${helper} noticed, compared with her own usual.`}
          </p>
          {alert && <WhyFlagged statuses={{ meal, mobility: mob }} variant="family" />}
          {alert && lead.flagged && (
            <p className="mt-3 rounded-2xl bg-cream p-3 text-[15px] leading-snug text-body">
              <strong>Teman noticed this on {fmtDay(lead.flagged)}</strong>
              {serious ? (
                <>, before {helper}&apos;s note on {fmtDay(sgDay(serious.created_at))}: <em>“{serious.translated_text}”</em></>
              ) : (
                "."
              )}
            </p>
          )}
          {alert?.severity === "review" && (
            <div id="book-gp" className="scroll-mt-4">
              <BookReview
                alertId={alert.id}
                summaryPath={`/summary/${makeSummaryToken(senior.id)}`}
                reviewDay={booked?.gp_review_at ? sgDay(booked.gp_review_at) : null}
                gpName={circle.gp}
                seniorName={senior.name}
                familyName={session.name}
              />
            </div>
          )}
        </div>
      </section>
      <a href="tel:995" className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border-2 border-coral font-extrabold text-coral">
        <Phone className="h-5 w-5" /> Fall or not responding? Call 995
      </a>

      {/* 2. A week of plates */}
      <Card>
        <h2 className="eyebrow text-muted">Eating · last 7 days</h2>
        <ul className="mt-3 grid grid-cols-7 gap-1">
          {week.map((d) => (
            <li key={d.day} className="flex flex-col items-center gap-1">
              <Plate pct={d.meal} low={d.lowMeal} today={d.today} />
              <span className={`text-xs ${d.today ? "font-extrabold text-ink" : "font-semibold text-muted"}`}>{d.today ? "Today" : d.label}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[15px] text-body">
          {meal ? <>Usually eats <strong>{Math.round(meal.mean)}%</strong> of each meal{meal.flagged ? <> · <span className="font-bold text-sun">less than usual lately</span></> : null}</> : "Still learning her usual"}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted"><span className="h-3 w-3 rounded-full border-2 border-turmeric" /> Amber rim = below her usual</p>
      </Card>

      {/* 3. Standing up, with the then-vs-now replay */}
      <Card>
        <Metric
          title="Standing up"
          big={mob ? (mob.flagged ? "Slower" : "As usual") : "—"}
          sub={mob?.recent != null ? `${Math.round(mob.recent)} s for 5 stands · usually ${Math.round(mob.mean)} s` : "Still learning her usual"}
          status={mob}
          scale={[0, Math.max(mob ? mob.mean + 2 * mob.sd : 0, mob?.recent ?? 0) * 1.25]}
        />
        {replay?.now.findings.includes("used_hands") && (
          <p className="mt-3 rounded-2xl bg-sun-soft px-3 py-2 font-bold text-sun-deep">
            ✋ The camera saw her push up with her hands (stands {formatReps(replay.now.hand_reps)}).
          </p>
        )}
        {replay && (
          <details className="group mt-3">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-2xl border-2 border-brand px-4 font-bold text-brand">
              <span className="group-open:hidden">See the difference</span>
              <span className="hidden group-open:inline">Hide</span>
            </summary>
            <div className="mt-3">
              <StandReplay
                then={{ seconds: replay.then.seconds, track: replay.then.track }}
                now={{ seconds: replay.now.seconds, track: replay.now.track }}
                thenLabel={agoLabel(replay.then.day, today)}
                nowLabel={replay.now.day === today ? "Today" : fmtDay(replay.now.day)}
                legend="Grey = a usual day · Green = latest"
              />
            </div>
          </details>
        )}
      </Card>

      {/* 4. The week at a glance */}
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

      {/* 5. Four weeks on one line: when it changed, and when Teman noticed */}
      <Card>
        <h2 className="text-lg font-extrabold">The last 4 weeks</h2>
        <div className="mt-3">
          <CareTimeline
            days={lastDays(28, today)}
            meal={signals.meal.series}
            mealStatus={meal}
            mobility={signals.mobility.series}
            mobilityStatus={mob}
            notes={notes.map((n) => ({ day: sgDay(n.created_at), text: n.translated_text ?? n.original_text, concerns: n.concerns }))}
            flagDay={lead.flagged}
            driftDay={lead.driftStart}
            carer={carerDays}
            carerName={helper}
          />
        </div>
      </Card>

      {/* 6. Notes from the helper */}
      <Card>
        <h2 className="text-lg font-extrabold">What {helper} noticed</h2>
        {notes.length === 0 ? (
          <p className="mt-2 text-muted">No notes yet. They&apos;ll appear here, translated into English.</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-track">
            {notes.slice(0, 4).map((n) => (
              <li key={n.id} className="py-3 first:pt-0 last:pb-0">
                <p className="text-[17px] leading-snug text-body">
                  {n.translated_text ? `“${n.translated_text}”` : <span className="italic text-muted">Translating…</span>}
                </p>
                {n.concerns.length > 0 && (
                  <p className="mt-1.5 flex flex-wrap gap-1.5">
                    {n.concerns.map((c) => <span key={c} className="rounded-full bg-sun-soft px-2.5 py-0.5 text-sm font-semibold text-sun-deep">{c}</span>)}
                  </p>
                )}
                <p className="mt-1 text-sm text-faint">{when(n.created_at)} · {translatedFrom(n.lang)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 7. What the family can do, from the healthcare advisor agent */}
      {!!(plan?.focus_areas?.length || plan?.resources?.length) && (
        <ActionPlan plan={plan} gpName={circle.gp} canBook={alert?.severity === "review"} />
      )}

      {/* 8. The second patient: the carer */}
      {carer && (
        <section className="rounded-[22px] bg-rose-soft p-5 text-rose-deep">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-rose text-lg font-extrabold text-white">{helper[0]}</span>
            <h2 className="text-lg font-extrabold">Looking after {helper} too</h2>
          </div>
          {carer?.needsNudge && (
            <>
              <p className="mt-3 text-[17px] font-bold">
                {helper} hasn&apos;t had a rest day in {carer.daysWithoutRest} days.
              </p>
              <p className="mt-1 text-rose-dark">
                {ai?.analysis.carer_wellbeing || `Looking after ${senior.name} is tiring work. Could you plan a day off for ${helper} this week?`}
              </p>
            </>
          )}
          <CarerActions helper={helper} restDay={restDay?.day ?? null} helperLang={helperUser?.language ?? "id"} />
        </section>
      )}

      {ai && (
        <p className="px-1 text-sm text-faint">
          {ai.source === "prepared" ? "Summary prepared from the numbers above." : "Summary written with AI from the numbers above."}
        </p>
      )}
      <div className="flex justify-center"><LogoutButton /></div>
    </Shell>
  );
}

/** The note after the flag day with the most concerns (ties: the latest). */
function mostSerious(notes: VoiceNote[], flagDay: string) {
  return notes
    .filter((n) => sgDay(n.created_at) >= flagDay && n.concerns.length && n.translated_text)
    .sort((a, b) => b.concerns.length - a.concerns.length || +new Date(b.created_at) - +new Date(a.created_at))[0] ?? null;
}

/** A plate filled to how much she ate that day; amber rim when below her usual. */
function Plate({ pct, low, today }: { pct: number | null; low: boolean; today: boolean }) {
  const r = 15, c = 18;
  const p = pct == null ? 0 : Math.min(100, Math.max(0, pct)) / 100;
  const a = p * 2 * Math.PI;
  const x = c + r * 0.72 * Math.sin(a), y = c - r * 0.72 * Math.cos(a);
  const label = pct == null ? (today ? "Today: no meal logged yet" : "No meal logged") : `Ate ${Math.round(pct)}%${low ? ", below her usual" : ""}`;
  return (
    <svg viewBox="0 0 36 36" className="h-11 w-11" role="img" aria-label={label}>
      <title>{label}</title>
      <circle cx={c} cy={c} r={r + 1.5} fill="#fff" stroke={pct == null ? "#E6DCC8" : low ? "#E8A317" : "#DCEBDF"} strokeWidth={low ? 3 : 2} strokeDasharray={pct == null ? "3 3" : undefined} />
      <circle cx={c} cy={c} r={r * 0.72} fill="#F1ECE1" />
      {p >= 0.999 ? (
        <circle cx={c} cy={c} r={r * 0.72} fill={low ? "#E8A317" : "#1F5C45"} />
      ) : p > 0 ? (
        <path d={`M${c} ${c}L${c} ${c - r * 0.72}A${r * 0.72} ${r * 0.72} 0 ${p > 0.5 ? 1 : 0} 1 ${x} ${y}Z`} fill={low ? "#E8A317" : "#1F5C45"} />
      ) : null}
    </svg>
  );
}

type Tile = { day: string; label: string; today: boolean; level: "normal" | "watch" | "none"; meal: number | null; lowMeal: boolean };

/** Last 7 days: amber if a reading fell outside her usual band in the bad direction. */
function weekTiles(meal: DailyPoint[], mealSt: SignalStatus | null, mob: DailyPoint[], mobSt: SignalStatus | null): Tile[] {
  const m = new Map(meal.map((p) => [p.day, p.value]));
  const s = new Map(mob.map((p) => [p.day, p.value]));
  const today = sgToday();
  return lastDays(7, today).map((day) => {
    const mv = m.get(day), sv = s.get(day);
    const low = mv != null && mealSt != null && mv < mealSt.mean - 1.5 * mealSt.sd;
    const slow = sv != null && mobSt != null && sv > mobSt.mean + 1.5 * mobSt.sd;
    return {
      day,
      label: new Date(`${day}T12:00:00+08:00`).toLocaleDateString("en-SG", { timeZone: TZ, weekday: "narrow" }),
      today: day === today,
      level: low || slow ? "watch" : mv != null || sv != null ? "normal" : "none",
      meal: mv ?? null,
      lowMeal: low,
    };
  });
}

function Metric({ title, big, sub, status, scale }: { title: string; big: string; sub: string; status: SignalStatus | null; scale: [number, number] }) {
  const [lo, hi] = scale;
  const pct = (v: number) => `${Math.min(100, Math.max(0, ((v - lo) / (hi - lo || 1)) * 100))}%`;
  const flagged = status?.flagged;
  return (
    <div className="flex flex-col">
      <h2 className="eyebrow text-muted">{title}</h2>
      <p className={`mt-1 flex items-center gap-2 text-[28px] font-extrabold leading-tight ${flagged ? "text-sun" : ""}`}>
        {status && <StatusIcon level={flagged ? "watch" : "normal"} className="h-6 w-6" />} {big}
      </p>
      <p className="text-[15px] leading-snug text-body">{sub}</p>
      {status && (
        <>
          <div className="relative h-3 rounded-full bg-track" aria-hidden style={{ marginTop: 14 }}>
            <span
              className="absolute inset-y-0 rounded-full bg-brand-soft ring-1 ring-brand/30"
              style={{ left: pct(status.mean - 1.5 * status.sd), right: `calc(100% - ${pct(status.mean + 1.5 * status.sd)})` }}
            />
            {status.recent != null && (
              <span className={`absolute -inset-y-1 w-1 -translate-x-1/2 rounded-full ${flagged ? "bg-sun" : "bg-brand-dark"}`} style={{ left: pct(status.recent) }} />
            )}
          </div>
          <p className="mt-1.5 text-sm text-muted">Green band = what&apos;s normal for Mum</p>
        </>
      )}
    </div>
  );
}

"use client";

// Phone-first helper view: three big tasks, three languages, nothing to chat with.
import { useEffect, useMemo, useRef, useState } from "react";
import { DATE_LOCALE, DICTS, LANG_SHORT, SPEECH_LOCALE, type Dict, type Lang } from "@/lib/i18n";
import type { SignalStatus } from "@/lib/baseline";
import type { StandClip } from "@/lib/data";
import { formatReps, type Track } from "@/lib/pose";
import { agoLabel, sgToday } from "@/lib/format";
import LogoutButton from "@/components/LogoutButton";
import StandReplay from "@/components/StandReplay";
import { StatusPill, Wordmark } from "@/components/Shell";
import { Bulb, Calendar, Camera, Chair, Check, ChevronLeft, ChevronRight, Heart, Message, Mic, Phone, Play, Users, Utensils } from "@/components/icons";
import PoseStandTest, { type PoseResult } from "./PoseStandTest";

type Screen = "home" | "meal" | "stand" | "voice";
type Tip = { text: string; en: string } | null;
type Done = { meal: boolean; stand: boolean; voice: boolean; checkin: boolean };
type IconT = (p: { className?: string }) => React.ReactElement;
const TZ = "Asia/Singapore";
const LANG_NAME: Record<Lang, string> = { id: "Bahasa Indonesia", tl: "Tagalog", en: "English" };
type Circle = { family: string; gp: string };
type FamilyMessage = { from: string; text: string; original: string } | null;

export default function HelperApp({
  name, seniorName, initialLang, initialDone, daysWithoutRest, tip, checks: initialChecks, restDay, circle, message, careSteps,
}: {
  name: string; seniorName: string; initialLang: Lang; initialDone: Done; daysWithoutRest: number | null; tip: Tip;
  checks: number; restDay: { day: string; set_by: string } | null; circle: Circle; message: FamilyMessage; careSteps: Tip;
}) {
  const [lang, setLang] = useState<Lang>(initialLang in DICTS ? initialLang : "id");
  const [screen, setScreen] = useState<Screen>("home");
  const [done, setDone] = useState(initialDone);
  const t = DICTS[lang];
  const [checks, setChecks] = useState(initialChecks);
  const markDone = (k: keyof Done) => {
    setDone((d) => ({ ...d, [k]: true }));
    if (k !== "checkin") setChecks((n) => n + 1);
  };
  const back = () => {
    setScreen("home");
    window.scrollTo({ top: 0 });
  };
  const count = [done.meal, done.stand, done.voice].filter(Boolean).length;

  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: TZ }).format(now));
  const greet = hour < 11 ? t.greetMorning : hour < 18 ? t.greetAfternoon : t.greetEvening;
  const date = now.toLocaleDateString(DATE_LOCALE[lang], { weekday: "long", day: "numeric", month: "long", timeZone: TZ });

  const tasks: { key: Exclude<Screen, "home">; Icon: IconT; label: string; hint: string; done: boolean }[] = [
    { key: "meal", Icon: Utensils, label: t.meal, hint: t.mealHint, done: done.meal },
    { key: "stand", Icon: Chair, label: t.stand, hint: t.standHint, done: done.stand },
    { key: "voice", Icon: Mic, label: t.voice, hint: t.voiceHint, done: done.voice },
  ];
  const current = tasks.find((k) => !k.done)?.key;

  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col pb-28">
      <header className="rounded-b-[28px] bg-brand px-5 pb-6 pt-4 text-cream">
        <div className="flex items-center justify-between gap-2">
          <Wordmark light />
          <div role="group" aria-label="Language" className="flex rounded-full bg-white/[.14] p-1">
            {(Object.keys(LANG_SHORT) as Lang[]).map((k) => (
              <button
                key={k}
                onClick={() => setLang(k)}
                aria-pressed={lang === k}
                aria-label={LANG_NAME[k]}
                className={`min-w-11 rounded-full px-3 py-1.5 text-sm font-extrabold transition ${lang === k ? "bg-cream text-brand" : "text-cream/85"}`}
              >
                {LANG_SHORT[k]}
              </button>
            ))}
          </div>
        </div>
        {screen === "home" && (
          <>
            <p className="mt-6 text-[15px] text-cream/80" suppressHydrationWarning>{date}</p>
            <h1 className="mt-1 text-[28px] font-extrabold leading-tight tracking-tight" suppressHydrationWarning>{greet}, {name}</h1>
            <p className="text-[17px] text-cream/85">{t.tasksFor.replace("{name}", seniorName)}</p>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/20" aria-hidden>
              <div className="h-full rounded-full bg-turmeric transition-all" style={{ width: `${(count / 3) * 100}%` }} />
            </div>
            <p className="mt-2 flex flex-wrap justify-between gap-x-3 text-[15px] font-semibold">
              <span>{count === 3 ? t.allDone : t.progress.replace("{n}", String(count))}</span>
              <span className="text-cream/80">{t.checksMonth.replace("{n}", String(checks))}</span>
            </p>
          </>
        )}
      </header>

      <div className="flex flex-col gap-4 px-4 pt-5">
        {screen === "home" && (
          <>
            {restDay && (
              <p className="flex items-center gap-3 rounded-[22px] bg-rose-soft p-4 text-[17px] font-bold text-rose-deep">
                <Calendar className="h-6 w-6 shrink-0 text-rose" />
                {t.restDayBanner
                  .replace("{day}", new Date(`${restDay.day}T12:00:00+08:00`).toLocaleDateString(DATE_LOCALE[lang], { weekday: "long", timeZone: TZ }))
                  .replace("{name}", restDay.set_by)}
              </p>
            )}
            {message && (
              <section className="rounded-[22px] border-2 border-rose bg-paper p-4">
                <p className="eyebrow flex items-center gap-1.5 text-rose">
                  <Message className="h-4 w-4" /> {t.messageFrom.replace("{name}", message.from)}
                </p>
                <p className="mt-1.5 text-[19px] font-bold leading-snug text-ink">{lang === "en" ? message.original : message.text}</p>
                {lang !== "en" && message.text !== message.original && (
                  <details className="mt-2 text-[15px] text-muted">
                    <summary className="cursor-pointer font-semibold">{t.showOriginal}</summary>
                    <p className="mt-1">{message.original}</p>
                  </details>
                )}
              </section>
            )}
            <section aria-label={t.todayTitle} className="flex flex-col gap-3">
              {tasks.map((k) => (
                <TaskCard key={k.key} Icon={k.Icon} label={k.label} hint={k.hint} done={k.done} current={k.key === current} t={t} onClick={() => setScreen(k.key)} />
              ))}
            </section>

            {tip && (
              <section className="rounded-[22px] bg-sun-soft p-5 text-sun-deep">
                <p className="eyebrow flex items-center gap-1.5 text-sun">
                  <Bulb className="h-4 w-4" /> {t.tipToday}
                </p>
                <p className="mt-1.5 text-[17px] leading-snug">{lang === "en" && tip.en ? tip.en : tip.text}</p>
              </section>
            )}

            {careSteps && <CareSteps t={t} steps={splitSteps(lang === "en" && careSteps.en ? careSteps.en : careSteps.text)} />}

            <CheckIn t={t} name={name} done={done.checkin} daysWithoutRest={daysWithoutRest} onDone={() => markDone("checkin")} />
            <p className="text-center text-sm text-faint">{t.notDiagnosis}</p>
            <div className="flex justify-center"><LogoutButton /></div>
          </>
        )}
        {screen === "meal" && <MealCapture t={t} circle={circle} onBack={back} onSaved={() => markDone("meal")} />}
        {screen === "stand" && <StandTest t={t} circle={circle} onBack={back} onSaved={() => markDone("stand")} />}
        {screen === "voice" && <VoiceNote t={t} lang={lang} circle={circle} onBack={back} onSaved={() => markDone("voice")} />}
      </div>

      {/* Always reachable, never in the way. */}
      <a
        href="tel:995"
        className="fixed inset-x-4 bottom-4 mx-auto flex min-h-[60px] max-w-[398px] items-center justify-center gap-2 rounded-2xl bg-coral px-4 text-center text-[17px] font-extrabold text-white shadow-lg"
      >
        <Phone className="h-5 w-5 shrink-0" /> {t.emergency}
      </a>
    </main>
  );
}

function TaskCard({ Icon, label, hint, done, current, t, onClick }: { Icon: IconT; label: string; hint: string; done: boolean; current: boolean; t: Dict; onClick: () => void }) {
  if (current) {
    return (
      <div className="rounded-[22px] border-2 border-brand bg-paper p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-cream"><Icon className="h-6 w-6" /></span>
          <span>
            <span className="eyebrow block text-brand">{t.now}</span>
            <span className="block text-xl font-extrabold leading-tight">{label}</span>
          </span>
        </div>
        <p className="mt-3 rounded-2xl bg-cream px-4 py-3 text-[17px] text-body">{hint}</p>
        <button onClick={onClick} className="mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-lg font-extrabold text-cream hover:bg-brand-dark">
          <Play className="h-5 w-5" /> {t.start}
        </button>
      </div>
    );
  }
  return (
    <button onClick={onClick} className="flex items-center gap-3 rounded-[22px] border border-line bg-paper p-4 text-left transition active:scale-[0.99]">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${done ? "bg-brand-soft text-brand-dark" : "border-2 border-brand text-brand"}`}>
        {done ? <Check className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
      </span>
      <span className="flex-1">
        <span className="block text-lg font-extrabold leading-tight">{label}</span>
        <span className={`block text-[15px] ${done ? "font-semibold text-brand" : "text-muted"}`}>{done ? t.doneToday : hint}</span>
      </span>
      <ChevronRight className="h-6 w-6 text-faint" />
    </button>
  );
}

function Screen({ title, Icon, onBack, t, children }: { title: string; Icon: IconT; onBack: () => void; t: Dict; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <button onClick={onBack} className="flex min-h-11 items-center gap-1 self-start rounded-full border border-line bg-paper px-3 font-bold text-brand">
        <ChevronLeft className="h-5 w-5" /> {t.back}
      </button>
      <h1 className="flex items-center gap-3 text-[28px] font-extrabold tracking-tight">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-cream"><Icon className="h-6 w-6" /></span>
        {title}
      </h1>
      {children}
    </section>
  );
}

const primary = "min-h-14 w-full rounded-2xl bg-brand text-lg font-extrabold text-cream hover:bg-brand-dark disabled:bg-track disabled:text-faint";

type Statuses = SignalStatus[] | undefined;
type Compare = { level: "normal" | "watch" | null; text: string; key: string };

/** How today compares with her own usual, in her helper's words (never colour alone). */
function compareWith(statuses: Statuses, type: "meal" | "mobility", t: Dict): Compare {
  const st = statuses?.find((x) => x.type === type);
  if (!st) return { level: null, text: t.stillLearning, key: `${type}.ok` };
  if (st.flagged) return { level: "watch", text: type === "meal" ? t.lessThanUsual : t.slowerThanUsual, key: `${type}.watch` };
  return { level: "normal", text: t.likeUsual, key: `${type}.ok` };
}

/** After every check: what Teman saw, how it compares, one thing to do, and who can see it. */
function ResultCard({
  t, circle, saw, compare, action, footnote, onBack,
}: {
  t: Dict; circle: Circle; saw: React.ReactNode; compare?: Compare; action: string; footnote?: string; onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-[22px] border border-line bg-paper p-4">
        <p className="eyebrow text-muted">{t.temanSaw}</p>
        <div className="mt-2">{saw}</div>
        {footnote && <p className="mt-2 text-sm text-muted">{footnote}</p>}
      </section>
      {compare && (
        <section className="rounded-[22px] border border-line bg-paper p-4">
          <p className="eyebrow text-muted">{t.comparedUsual}</p>
          <div className="mt-2">
            {compare.level ? (
              <StatusPill level={compare.level} className="text-[17px]">{compare.text}</StatusPill>
            ) : (
              <p className="font-semibold text-muted">{compare.text}</p>
            )}
          </div>
        </section>
      )}
      <section className="rounded-[22px] bg-sun-soft p-4 text-sun-deep">
        <p className="eyebrow flex items-center gap-1.5 text-sun"><Bulb className="h-4 w-4" /> {t.oneThing}</p>
        <p className="mt-1 text-[19px] font-bold leading-snug">{action}</p>
      </section>
      <p className="flex items-center justify-center gap-2 text-center font-semibold text-brand-dark">
        <Users className="h-5 w-5 shrink-0" /> {t.canNowSee.replace("{family}", circle.family).replace("{gp}", circle.gp)}
      </p>
      <button className={primary} onClick={onBack}>OK</button>
    </div>
  );
}

type Leftover = { label: string; box: [number, number, number, number] };
type PlateResult = { bucket: number; confidence: "low" | "medium" | "high"; leftovers?: Leftover[]; status: SignalStatus | null };

function MealCapture({ t, circle, onBack, onSaved }: { t: Dict; circle: Circle; onBack: () => void; onSaved: () => void }) {
  const [before, setBefore] = useState<File | null>(null);
  const [after, setAfter] = useState<File | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [result, setResult] = useState<PlateResult | null>(null);
  const [problem, setProblem] = useState("");

  // Checks that need no AI: right kind of file, not huge, not the same photo twice.
  function pick(which: "before" | "after", f: File) {
    setProblem("");
    setState("idle");
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return setProblem(t.notFood);
    if (f.size > 12 * 1024 * 1024) return setProblem(t.photoTooBig);
    const other = which === "before" ? after : before;
    if (other && other.name === f.name && other.size === f.size && other.lastModified === f.lastModified) return setProblem(t.samePhoto);
    (which === "before" ? setBefore : setAfter)(f);
  }

  async function submit() {
    if (!before || !after) return;
    setState("busy");
    setProblem("");
    const fd = new FormData();
    fd.set("before", before);
    fd.set("after", after);
    const res = await fetch("/api/plate", { method: "POST", body: fd }).catch(() => null);
    if (!res?.ok) {
      const code = res ? (await res.json().catch(() => ({}))).code : undefined;
      const msg = { not_food: t.notFood, not_image: t.notFood, not_same: t.notSamePlate, too_big: t.photoTooBig }[code as string];
      setState(msg ? "idle" : "error");
      if (msg) setProblem(msg);
      return;
    }
    setResult(await res.json());
    setState("idle");
    onSaved();
  }

  if (result && after) {
    const cmp = compareWith(result.status ? [result.status] : [], "meal", t);
    // Boxes only when the model is confident and found something; never boxes that look wrong.
    const boxes = result.confidence !== "low" ? (result.leftovers ?? []) : [];
    return (
      <Screen title={t.meal} Icon={Utensils} onBack={onBack} t={t}>
        <ResultCard
          t={t}
          circle={circle}
          saw={
            <div className="flex flex-col items-center gap-2 text-center">
              <LeftoverPhoto file={after} leftovers={boxes} label={t.wasLeft} />
              <p className="mt-1 text-lg text-muted">{t.ate}</p>
              <p className="text-6xl font-extrabold text-brand">{result.bucket}%</p>
              <MealBar pct={result.bucket} />
            </div>
          }
          footnote={t.photosNotStored}
          compare={cmp}
          action={t.actions[cmp.key]}
          onBack={onBack}
        />
      </Screen>
    );
  }

  return (
    <Screen title={t.meal} Icon={Utensils} onBack={onBack} t={t}>
      <div className="grid grid-cols-2 gap-3">
        <PhotoPicker step={1} label={t.stepBefore} hint={t.takePhoto} file={before} onFile={(f) => pick("before", f)} />
        <PhotoPicker step={2} label={t.stepAfter} hint={t.takePhoto} file={after} onFile={(f) => pick("after", f)} />
      </div>
      {problem && <p role="alert" className="rounded-2xl bg-sun-soft p-3 text-center font-semibold text-sun-deep">{problem}</p>}
      <p className="text-center text-sm text-muted">{t.photosNotStored}</p>
      <button className={primary} disabled={!before || !after || state === "busy"} onClick={submit}>
        {state === "busy" ? t.working : t.estimate}
      </button>
      {state === "error" && <p className="rounded-2xl bg-coral-soft p-3 text-center font-semibold text-coral">{t.failed}</p>}
    </Screen>
  );
}

/** The after photo with soft amber boxes around what was left. The photo stays in memory only. */
function LeftoverPhoto({ file, leftovers, label }: { file: File; leftovers: Leftover[]; label: string }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <figure className="w-full">
      <div className="relative overflow-hidden rounded-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={leftovers.length ? `${label}: ${leftovers.map((l) => l.label).join(", ")}` : label} className="block h-auto w-full" />
        {leftovers.map((l, i) => (
          <span
            key={i}
            className="absolute rounded-xl border-[3px] border-turmeric bg-turmeric/15"
            style={{ left: `${l.box[0] * 100}%`, top: `${l.box[1] * 100}%`, width: `${l.box[2] * 100}%`, height: `${l.box[3] * 100}%` }}
          >
            <span className="absolute left-1 top-1 rounded-md bg-turmeric px-1.5 text-sm font-bold text-sun-deep">{l.label}</span>
          </span>
        ))}
      </div>
      {leftovers.length > 0 && (
        <figcaption className="mt-1.5 text-left text-[15px] font-semibold text-sun">{label}: {leftovers.map((l) => l.label).join(", ")}</figcaption>
      )}
    </figure>
  );
}

/** Plate drawn as four quarters so "how much was eaten" reads without numbers. */
function MealBar({ pct }: { pct: number }) {
  const filled = Math.round(pct / 25);
  return (
    <div className="flex gap-1.5" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className={`h-3 w-10 rounded-full ${i < filled ? "bg-brand" : "bg-track"}`} />
      ))}
    </div>
  );
}

function PhotoPicker({ step, label, hint, file, onFile }: { step: number; label: string; hint: string; file: File | null; onFile: (f: File) => void }) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : undefined), [file]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return (
    <label className="flex cursor-pointer flex-col gap-2">
      {/* Fixed two-line label height so the before/after boxes line up even when one label wraps. */}
      <span className="flex min-h-12 items-start gap-2 font-bold leading-6">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${file ? "bg-brand text-cream" : "bg-brand-soft text-brand-dark"}`}>
          {file ? <Check className="h-4 w-4" /> : step}
        </span>
        {label}
      </span>
      <span className="relative flex aspect-square items-center justify-center overflow-hidden rounded-[22px] border-2 border-dashed border-line bg-paper">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-2 p-3 text-center text-muted">
            <Camera className="h-10 w-10 text-brand" />
            <span className="text-sm font-semibold">{hint}</span>
          </span>
        )}
      </span>
      {/* capture opens the camera on phones; desktop judges get a file picker */}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onFile(f);
        }}
      />
    </label>
  );
}

type StandSaved = {
  seconds: number;
  method: "pose" | "tap";
  findings: string[];
  handReps: number[];
  track: Track | null;
  then: StandClip | null;
  statuses: Statuses;
};

/** Chair-stand: the camera counts by default; tap-to-count stays one link away. */
function StandTest({ t, circle, onBack, onSaved }: { t: Dict; circle: Circle; onBack: () => void; onSaved: () => void }) {
  const [mode, setMode] = useState<"pose" | "tap">("pose");
  const [saved, setSaved] = useState<StandSaved | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [pending, setPending] = useState<Omit<StandSaved, "then" | "statuses"> & { meta: object } | null>(null);
  const [problem, setProblem] = useState("");

  async function save(r: NonNullable<typeof pending>) {
    setPending(r);
    setProblem("");
    setState("busy");
    const res = await fetch("/api/observations", {
      method: "POST",
      body: JSON.stringify({ type: "mobility", value: r.seconds, meta: r.meta }),
    }).catch(() => null);
    if (res?.status === 422) {
      // Not plausible (e.g. five stands in 3 s): not saved, so it can't skew her usual. Start over.
      const { code } = await res.json().catch(() => ({}));
      setProblem(code === "too_slow" ? t.standTooSlow : t.standTooFast);
      setPending(null);
      return setState("idle");
    }
    if (!res?.ok) return setState("error");
    const data = await res.json();
    setSaved({ ...r, then: data.then ?? null, statuses: data.statuses });
    setState("idle");
    onSaved();
  }

  const fromPose = (p: PoseResult) =>
    save({
      seconds: p.seconds, method: "pose", findings: p.findings, handReps: p.handReps, track: p.track,
      meta: { reps: p.reps, method: "pose", findings: p.findings, hand_reps: p.handReps, rep_times: p.repTimes, landmarks: p.track },
    });
  const fromTap = (seconds: number, reps: number) =>
    save({ seconds, method: "tap", findings: [], handReps: [], track: null, meta: { reps, method: "tap" } });

  if (saved) {
    const cmp = compareWith(saved.statuses, "mobility", t);
    const finding = saved.method === "pose" && (saved.findings.includes("used_hands") ? t.usedHands.replace("{reps}", formatReps(saved.handReps)) : t.noHands);
    const debug = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debug");
    return (
      <Screen title={t.stand} Icon={Chair} onBack={onBack} t={t}>
        <ResultCard
          t={t}
          circle={circle}
          saw={
            <div className="flex flex-col gap-3">
              <p className="text-center">
                <span className="text-6xl font-extrabold tabular-nums text-brand">{Math.round(saved.seconds)}</span>
                <span className="text-lg text-muted"> {t.seconds}</span>
              </p>
              {finding && (
                <p className={`rounded-2xl px-3 py-2 text-center text-[17px] font-bold ${saved.findings.length ? "bg-sun-soft text-sun-deep" : "bg-brand-soft text-brand-dark"}`}>
                  {saved.findings.length ? "✋ " : "✓ "}{finding}
                </p>
              )}
              {saved.track && saved.then?.track && (
                <StandReplay
                  then={{ seconds: saved.then.seconds, track: saved.then.track }}
                  now={{ seconds: saved.seconds, track: saved.track }}
                  thenLabel={agoLabel(saved.then.day, sgToday(), t)}
                  nowLabel={t.today}
                  replayLabel={t.replay}
                  legend={t.ghostLegend}
                  autoPlay
                />
              )}
              {debug && saved.track && (
                <a
                  className="text-sm font-bold text-brand underline"
                  download="stand-track.json"
                  href={`data:application/json,${encodeURIComponent(JSON.stringify({ source: "recorded", seconds: saved.seconds, hand_reps: saved.handReps, findings: saved.findings, rep_times: [], track: saved.track }))}`}
                >
                  Download track
                </a>
              )}
            </div>
          }
          footnote={saved.method === "pose" ? t.videoStays : undefined}
          compare={cmp}
          action={t.actions[cmp.key]}
          onBack={onBack}
        />
      </Screen>
    );
  }

  return (
    <Screen title={t.stand} Icon={Chair} onBack={onBack} t={t}>
      {problem && <p role="alert" className="rounded-2xl bg-sun-soft p-3 text-center font-semibold text-sun-deep">{problem}</p>}
      {state === "busy" ? (
        <p className="rounded-[22px] bg-paper p-6 text-center text-lg font-bold text-muted ring-1 ring-line">{t.working}</p>
      ) : state === "error" && pending ? (
        <>
          <p className="rounded-2xl bg-coral-soft p-3 text-center font-semibold text-coral">{t.failed}</p>
          <button className={primary} onClick={() => save(pending)}>{t.tryAgain}</button>
        </>
      ) : mode === "pose" ? (
        <PoseStandTest t={t} onResult={fromPose} onTapInstead={() => setMode("tap")} />
      ) : (
        <TapStandTest t={t} onDone={fromTap} />
      )}
    </Screen>
  );
}

// Tap-to-count: the fallback when the camera can't see her clearly (or at the go/no-go).
function TapStandTest({ t, onDone }: { t: Dict; onDone: (seconds: number, reps: number) => void }) {
  const [start, setStart] = useState<number | null>(null);
  const [reps, setReps] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  const finished = reps >= 5;

  useEffect(() => {
    if (start === null || finished) return;
    timer.current = setInterval(() => setElapsed((Date.now() - start) / 1000), 100);
    return () => clearInterval(timer.current);
  }, [start, finished]);

  return (
    <>
      {start === null && (
        <div className="rounded-[22px] bg-paper p-4 text-[17px] leading-snug text-body ring-1 ring-line">
          <p>{t.standIntro}</p>
          <p className="mt-3 rounded-2xl bg-sun-soft px-3 py-2 font-bold text-sun-deep">⚠ {t.stayClose}</p>
        </div>
      )}
      <div className="rounded-[22px] border border-line bg-paper p-6 text-center">
        <p className="text-7xl font-extrabold tabular-nums tracking-tight">{elapsed.toFixed(1)}</p>
        <p className="text-lg text-muted">{t.seconds}</p>
        <div className="mt-4 flex justify-center gap-2" aria-label={`${reps} / 5`}>
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold ${i < reps ? "bg-brand text-cream" : "bg-track text-faint"}`}>
              {i + 1}
            </span>
          ))}
        </div>
      </div>
      {start === null ? (
        <button className={`${primary} flex items-center justify-center gap-2`} onClick={() => setStart(Date.now())}><Play className="h-5 w-5" /> {t.start}</button>
      ) : !finished ? (
        <button className="min-h-44 rounded-[22px] bg-turmeric text-2xl font-extrabold text-sun-deep active:scale-[0.98]" onClick={() => setReps((r) => r + 1)}>
          {t.tapEachStand}
        </button>
      ) : (
        <button className={primary} onClick={() => onDone(Math.round(elapsed * 10) / 10, reps)}>{t.save}</button>
      )}
    </>
  );
}

type SpeechRec = {
  lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onerror: (e: { error: string }) => void;
  onend: () => void;
};

function VoiceNote({ t, lang, circle, onBack, onSaved }: { t: Dict; lang: Lang; circle: Circle; onBack: () => void; onSaved: () => void }) {
  const [text, setText] = useState("");
  const [concerns, setConcerns] = useState<string[]>([]);
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "saved" | "error">("idle");
  const rec = useRef<SpeechRec | null>(null);
  const wanted = useRef(false); // true from "start" until she taps stop
  const textRef = useRef("");
  const w = typeof window !== "undefined" ? (window as unknown as Record<string, new () => SpeechRec>) : {};
  const Speech = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  const updateText = (v: string) => {
    textRef.current = v;
    setText(v);
  };

  // Browsers end recognition after a pause. While she hasn't tapped stop, start a new session
  // and append to what's already there, so a pause never loses or replaces her words.
  function listen() {
    const base = textRef.current ? textRef.current.trimEnd() + " " : "";
    const r = new Speech();
    r.lang = SPEECH_LOCALE[lang];
    r.interimResults = true;
    r.continuous = true;
    r.onresult = (e) => updateText(base + Array.from(e.results).map((res) => res[0].transcript).join(" ").trim());
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "audio-capture") {
        wanted.current = false;
        setMicError(true);
      }
    };
    r.onend = () => {
      if (wanted.current) {
        try {
          return listen();
        } catch {
          wanted.current = false;
        }
      }
      setListening(false);
    };
    rec.current = r;
    r.start();
  }

  function toggle() {
    if (wanted.current) {
      wanted.current = false;
      rec.current?.stop();
      setListening(false);
      return;
    }
    setMicError(false);
    wanted.current = true;
    setListening(true);
    try {
      listen();
    } catch {
      wanted.current = false;
      setListening(false);
      setMicError(true);
    }
  }

  // Stop the microphone when leaving the screen.
  useEffect(() => () => {
    wanted.current = false;
    rec.current?.stop();
  }, []);

  async function save() {
    if (wanted.current) toggle();
    setState("busy");
    const res = await fetch("/api/observations", { method: "POST", body: JSON.stringify({ type: "voice", text, lang }) });
    if (res.ok) setConcerns((await res.json()).concerns ?? []);
    setState(res.ok ? "saved" : "error");
    if (res.ok) onSaved();
  }

  if (state === "saved") {
    return (
      <Screen title={t.voice} Icon={Mic} onBack={onBack} t={t}>
        <ResultCard
          t={t}
          circle={circle}
          saw={
            <div>
              <p className="text-[17px] italic leading-snug text-body">“{text}”</p>
              {concerns.length > 0 && (
                <p className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="font-bold text-sun">{t.noteSaved}:</span>
                  {concerns.map((c) => (
                    <span key={c} className="rounded-full bg-sun-soft px-3 py-1 text-sm font-bold text-sun-deep">{c}</span>
                  ))}
                </p>
              )}
            </div>
          }
          action={t.actions[concerns.length ? "voice.concern" : "voice.ok"]}
          onBack={onBack}
        />
      </Screen>
    );
  }

  return (
    <Screen title={t.voice} Icon={Mic} onBack={onBack} t={t}>
      <p className="text-[17px] leading-snug text-body">{t.voiceIntro}</p>
      {Speech && (
        <button
          type="button"
          onClick={toggle}
          aria-pressed={listening}
          className={`flex select-none flex-col items-center gap-3 rounded-[22px] border py-7 text-xl font-extrabold transition ${listening ? "border-coral bg-coral-soft text-coral" : "border-line bg-paper text-brand"}`}
        >
          <span className={`flex h-20 w-20 items-center justify-center rounded-full ${listening ? "bg-coral text-white" : "border-2 border-brand"}`}>
            {listening ? <span className="h-7 w-7 rounded-md bg-white" aria-hidden /> : <Mic className="h-9 w-9" />}
          </span>
          <span className="flex items-center gap-2">
            {listening && <span className="h-3 w-3 animate-pulse rounded-full bg-coral" aria-hidden />}
            {listening ? t.recording : t.record}
          </span>
        </button>
      )}
      {micError && <p role="alert" className="rounded-2xl bg-sun-soft p-3 text-center font-semibold text-sun-deep">{t.micBlocked}</p>}
      <label className="flex flex-col gap-2">
        <span className="font-bold">{t.orType}</span>
        <textarea value={text} onChange={(e) => updateText(e.target.value)} rows={4} className="rounded-[22px] border border-line bg-paper p-4 text-[17px]" />
      </label>
      <button className={primary} disabled={!text.trim() || state === "busy"} onClick={save}>{state === "busy" ? t.working : t.save}</button>
      {state === "error" && <p className="rounded-2xl bg-coral-soft p-3 text-center font-semibold text-coral">{t.failed}</p>}
    </Screen>
  );
}

// Three plain choices, stored on the existing 1–5 mood scale.
const MOODS = [
  { face: "🙂", value: 4 },
  { face: "😮‍💨", value: 2 },
  { face: "😢", value: 1 },
];

function CheckIn({ t, name, done, daysWithoutRest, onDone }: { t: Dict; name: string; done: boolean; daysWithoutRest: number | null; onDone: () => void }) {
  const [mood, setMood] = useState<number | null>(null);
  async function send(rested: boolean) {
    await fetch("/api/checkin", { method: "POST", body: JSON.stringify({ mood, rested }) });
    onDone();
  }
  const restLine = daysWithoutRest != null && (
    <p className="mt-3 text-[15px] font-semibold text-rose-dark">{t.noRest.replace("{n}", String(daysWithoutRest))}</p>
  );
  if (done) {
    return (
      <section className="rounded-[22px] bg-rose-soft p-5 text-rose-deep">
        <p className="text-lg font-bold">{t.thanksCheckin}</p>
        {restLine}
      </section>
    );
  }
  return (
    <section className="rounded-[22px] bg-rose-soft p-5 text-rose-deep">
      <h2 className="text-xl font-extrabold">{t.andYou.replace("{name}", name)}</h2>
      <p className="text-rose-dark">{t.howAreYou}</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {MOODS.map((m, i) => (
          <button
            key={m.value}
            onClick={() => setMood(m.value)}
            aria-pressed={mood === m.value}
            className={`flex min-h-[72px] flex-col items-center justify-center gap-0.5 rounded-2xl bg-paper font-bold transition ${mood === m.value ? "border-2 border-rose" : "border-2 border-transparent"}`}
          >
            <span className="text-2xl" aria-hidden>{m.face}</span>
            <span className="text-[15px]">{t.moodWords[i]}</span>
          </button>
        ))}
      </div>
      {mood && (
        <div className="mt-4">
          <p className="mb-2 font-bold">{t.restedToday}</p>
          <div className="grid grid-cols-2 gap-2">
            <button className="min-h-[52px] rounded-2xl bg-rose text-lg font-bold text-white" onClick={() => send(true)}>{t.yes}</button>
            <button className="min-h-[52px] rounded-2xl border-2 border-rose bg-paper text-lg font-bold text-rose" onClick={() => send(false)}>{t.no}</button>
          </div>
        </div>
      )}
      {restLine}
    </section>
  );
}

/** The care plan's tips arrive as one string ("1. ... 2. ..." or sentences); one card per step. */
function splitSteps(text: string): string[] {
  const lines = text.split(/\n+|\s*(?=\b\d[.)]\s)/).map((x) => x.replace(/^\s*(?:\d+[.)]|[-•*])\s*/, "").trim()).filter(Boolean);
  const parts = lines.length > 1 ? lines : text.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
  return parts.slice(0, 4);
}

function CareSteps({ t, steps }: { t: Dict; steps: string[] }) {
  if (!steps.length) return null;
  return (
    <section aria-labelledby="care-steps" className="flex flex-col gap-2">
      <h2 id="care-steps" className="eyebrow flex items-center gap-1.5 px-1 text-brand">
        <Heart className="h-4 w-4" /> {t.careSteps}
      </h2>
      <ol className="flex flex-col gap-2">
        {steps.map((step, i) => (
          <li key={step} className="flex items-start gap-3 rounded-[22px] border border-line bg-paper p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-lg font-extrabold text-brand-dark">{i + 1}</span>
            <span className="pt-1 text-[17px] font-semibold leading-snug text-ink">{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

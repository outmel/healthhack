"use client";

// Phone-first helper view: three big tasks, three languages, nothing to chat with.
import { useEffect, useMemo, useRef, useState } from "react";
import { DATE_LOCALE, DICTS, LANG_SHORT, SPEECH_LOCALE, type Dict, type Lang } from "@/lib/i18n";
import LogoutButton from "@/components/LogoutButton";
import { Wordmark } from "@/components/Shell";
import { Bulb, Camera, Chair, Check, ChevronLeft, ChevronRight, Mic, Phone, Play, Utensils } from "@/components/icons";

type Screen = "home" | "meal" | "stand" | "voice";
type Tip = { text: string; en: string } | null;
type Done = { meal: boolean; stand: boolean; voice: boolean; checkin: boolean };
type IconT = (p: { className?: string }) => React.ReactElement;
const TZ = "Asia/Singapore";
const LANG_NAME: Record<Lang, string> = { id: "Bahasa Indonesia", tl: "Tagalog", en: "English" };

export default function HelperApp({
  name, seniorName, initialLang, initialDone, daysWithoutRest, tip,
}: { name: string; seniorName: string; initialLang: Lang; initialDone: Done; daysWithoutRest: number | null; tip: Tip }) {
  const [lang, setLang] = useState<Lang>(initialLang in DICTS ? initialLang : "id");
  const [screen, setScreen] = useState<Screen>("home");
  const [done, setDone] = useState(initialDone);
  const t = DICTS[lang];
  const markDone = (k: keyof Done) => setDone((d) => ({ ...d, [k]: true }));
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
            <p className="mt-2 text-[15px] font-semibold">{count === 3 ? t.allDone : t.progress.replace("{n}", String(count))}</p>
          </>
        )}
      </header>

      <div className="flex flex-col gap-4 px-4 pt-5">
        {screen === "home" && (
          <>
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

            <CheckIn t={t} name={name} done={done.checkin} daysWithoutRest={daysWithoutRest} onDone={() => markDone("checkin")} />
            <p className="text-center text-sm text-faint">{t.notDiagnosis}</p>
            <div className="flex justify-center"><LogoutButton /></div>
          </>
        )}
        {screen === "meal" && <MealCapture t={t} onBack={back} onSaved={() => markDone("meal")} />}
        {screen === "stand" && <StandTest t={t} onBack={back} onSaved={() => markDone("stand")} />}
        {screen === "voice" && <VoiceNote t={t} lang={lang} onBack={back} onSaved={() => markDone("voice")} />}
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

function Saved({ text, onBack }: { text: string; onBack: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-[22px] bg-brand-soft p-6 text-center text-brand-dark">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-paper text-brand"><Check className="h-9 w-9" /></span>
      <p className="text-xl font-bold">{text}</p>
      <button className={primary} onClick={onBack}>OK</button>
    </div>
  );
}

function MealCapture({ t, onBack, onSaved }: { t: Dict; onBack: () => void; onSaved: () => void }) {
  const [before, setBefore] = useState<File | null>(null);
  const [after, setAfter] = useState<File | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [result, setResult] = useState<{ bucket: number } | null>(null);

  async function submit() {
    if (!before || !after) return;
    setState("busy");
    const fd = new FormData();
    fd.set("before", before);
    fd.set("after", after);
    const res = await fetch("/api/plate", { method: "POST", body: fd });
    if (!res.ok) return setState("error");
    setResult(await res.json());
    setState("idle");
    onSaved();
  }

  return (
    <Screen title={t.meal} Icon={Utensils} onBack={onBack} t={t}>
      <div className="grid grid-cols-2 gap-3">
        <PhotoPicker step={1} label={t.stepBefore} hint={t.takePhoto} file={before} onFile={setBefore} />
        <PhotoPicker step={2} label={t.stepAfter} hint={t.takePhoto} file={after} onFile={setAfter} />
      </div>
      {result ? (
        <div className="flex flex-col items-center gap-2 rounded-[22px] border border-line bg-paper p-6 text-center">
          <p className="text-lg text-muted">{t.ate}</p>
          <p className="text-6xl font-extrabold text-brand">{result.bucket}%</p>
          <MealBar pct={result.bucket} />
          <button className={`${primary} mt-3`} onClick={onBack}>{t.done}</button>
        </div>
      ) : (
        <button className={primary} disabled={!before || !after || state === "busy"} onClick={submit}>
          {state === "busy" ? t.working : t.estimate}
        </button>
      )}
      {state === "error" && <p className="rounded-2xl bg-coral-soft p-3 text-center font-semibold text-coral">{t.failed}</p>}
    </Screen>
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
      <span className="flex items-center gap-2 font-bold">
        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${file ? "bg-brand text-cream" : "bg-brand-soft text-brand-dark"}`}>
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
      <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
    </label>
  );
}

// Tap-to-count fallback. Lane 2 replaces/extends this with the MediaPipe pose module.
function StandTest({ t, onBack, onSaved }: { t: Dict; onBack: () => void; onSaved: () => void }) {
  const [start, setStart] = useState<number | null>(null);
  const [reps, setReps] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  const finished = reps >= 5;

  useEffect(() => {
    if (start === null || finished) return;
    timer.current = setInterval(() => setElapsed((Date.now() - start) / 1000), 100);
    return () => clearInterval(timer.current);
  }, [start, finished]);

  async function save() {
    await fetch("/api/observations", {
      method: "POST",
      body: JSON.stringify({ type: "mobility", value: Math.round(elapsed * 10) / 10, meta: { reps, method: "tap" } }),
    });
    setSaved(true);
    onSaved();
  }

  if (saved) return <Screen title={t.stand} Icon={Chair} onBack={onBack} t={t}><Saved text={t.saved} onBack={onBack} /></Screen>;

  return (
    <Screen title={t.stand} Icon={Chair} onBack={onBack} t={t}>
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
        <button className={primary} onClick={save}>{t.save}</button>
      )}
    </Screen>
  );
}

type SpeechRec = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void };

function VoiceNote({ t, lang, onBack, onSaved }: { t: Dict; lang: Lang; onBack: () => void; onSaved: () => void }) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "saved" | "error">("idle");
  const rec = useRef<SpeechRec | null>(null);
  const w = typeof window !== "undefined" ? (window as unknown as Record<string, new () => SpeechRec>) : {};
  const Speech = w.SpeechRecognition ?? w.webkitSpeechRecognition;

  function toggle() {
    if (listening) return rec.current?.stop();
    const r = new Speech();
    r.lang = SPEECH_LOCALE[lang];
    r.interimResults = true;
    r.continuous = true;
    r.onresult = (e) => setText(Array.from(e.results).map((res) => res[0].transcript).join(" "));
    r.onend = () => setListening(false);
    rec.current = r;
    r.start();
    setListening(true);
  }

  async function save() {
    setState("busy");
    const res = await fetch("/api/observations", { method: "POST", body: JSON.stringify({ type: "voice", text, lang }) });
    setState(res.ok ? "saved" : "error");
    if (res.ok) onSaved();
  }

  if (state === "saved") return <Screen title={t.voice} Icon={Mic} onBack={onBack} t={t}><Saved text={t.saved} onBack={onBack} /></Screen>;

  return (
    <Screen title={t.voice} Icon={Mic} onBack={onBack} t={t}>
      <p className="text-[17px] leading-snug text-body">{t.voiceIntro}</p>
      {Speech && (
        <button
          onClick={toggle}
          className={`flex flex-col items-center gap-3 rounded-[22px] border border-line bg-paper py-7 text-xl font-extrabold ${listening ? "text-brand-dark" : "text-brand"}`}
        >
          <span className={`flex h-20 w-20 items-center justify-center rounded-full ${listening ? "animate-pulse bg-brand text-cream" : "border-2 border-brand"}`}>
            <Mic className="h-9 w-9" />
          </span>
          {listening ? t.recording : t.record}
        </button>
      )}
      <label className="flex flex-col gap-2">
        <span className="font-bold">{t.orType}</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="rounded-[22px] border border-line bg-paper p-4 text-[17px]" />
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

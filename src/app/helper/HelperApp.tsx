"use client";

// Phone-first helper view: three big tasks, three languages, nothing to chat with.
import { useEffect, useMemo, useRef, useState } from "react";
import { DICTS, LANG_SHORT, SPEECH_LOCALE, type Dict, type Lang } from "@/lib/i18n";
import LogoutButton from "@/components/LogoutButton";
import { Camera, Chair, Check, ChevronLeft, ChevronRight, Logo, Mic, Phone, Sparkle, Utensils } from "@/components/icons";

type Screen = "home" | "meal" | "stand" | "voice";
type Tip = { text: string; en: string } | null;
type Done = { meal: boolean; stand: boolean; voice: boolean; checkin: boolean };
type IconT = (p: { className?: string }) => React.ReactElement;

export default function HelperApp({
  name, seniorName, initialLang, initialDone, tip,
}: { name: string; seniorName: string; initialLang: Lang; initialDone: Done; tip: Tip }) {
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

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-28 pt-4">
      <nav className="flex items-center justify-between gap-2">
        <Logo className="h-9 w-9" />
        <div role="group" aria-label="Language" className="flex rounded-full bg-paper p-1 ring-1 ring-line">
          {(Object.keys(LANG_SHORT) as Lang[]).map((k) => (
            <button
              key={k}
              onClick={() => setLang(k)}
              aria-pressed={lang === k}
              className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${lang === k ? "bg-brand text-white" : "text-muted"}`}
            >
              {LANG_SHORT[k]}
            </button>
          ))}
        </div>
      </nav>

      {screen === "home" && (
        <>
          <header>
            <h1 className="text-3xl font-extrabold tracking-tight">{t.hello}, {name} 👋</h1>
            <p className="text-lg text-muted">{t.caringFor} {seniorName}</p>
          </header>

          {tip && (
            <section className="rounded-3xl bg-sun-soft p-4 ring-1 ring-sun-line">
              <p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-sun">
                <Sparkle className="h-4 w-4" /> {t.tipTitle}
              </p>
              <p className="mt-1 text-lg leading-snug">{lang === "en" && tip.en ? tip.en : tip.text}</p>
            </section>
          )}

          <section aria-labelledby="today" className="flex flex-col gap-3">
            <div className="flex items-end justify-between">
              <h2 id="today" className="text-xl font-extrabold">{t.todayTitle}</h2>
              <span className="text-muted">{count === 3 ? t.allDone : t.progress.replace("{n}", String(count))}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-line" aria-hidden>
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(count / 3) * 100}%` }} />
            </div>
            <TaskTile Icon={Utensils} label={t.meal} hint={t.mealHint} done={done.meal} doneLabel={t.doneToday} onClick={() => setScreen("meal")} />
            <TaskTile Icon={Chair} label={t.stand} hint={t.standHint} done={done.stand} doneLabel={t.doneToday} onClick={() => setScreen("stand")} />
            <TaskTile Icon={Mic} label={t.voice} hint={t.voiceHint} done={done.voice} doneLabel={t.doneToday} onClick={() => setScreen("voice")} />
          </section>

          <CheckIn t={t} name={name} done={done.checkin} onDone={() => markDone("checkin")} />
          <p className="text-center text-sm text-faint">{t.notDiagnosis}</p>
          <div className="flex justify-center"><LogoutButton /></div>
        </>
      )}
      {screen === "meal" && <MealCapture t={t} onBack={back} onSaved={() => markDone("meal")} />}
      {screen === "stand" && <StandTest t={t} onBack={back} onSaved={() => markDone("stand")} />}
      {screen === "voice" && <VoiceNote t={t} lang={lang} onBack={back} onSaved={() => markDone("voice")} />}

      {/* Always reachable, never in the way. */}
      <a
        href="tel:995"
        className="fixed inset-x-4 bottom-4 mx-auto flex max-w-md items-center justify-center gap-2 rounded-2xl bg-coral py-4 text-lg font-extrabold text-white shadow-lg"
      >
        <Phone className="h-5 w-5" /> {t.emergency}
      </a>
    </main>
  );
}

function TaskTile({ Icon, label, hint, done, doneLabel, onClick }: { Icon: IconT; label: string; hint: string; done: boolean; doneLabel: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex min-h-24 items-center gap-4 rounded-3xl p-4 text-left shadow-sm ring-1 transition active:scale-[0.99] ${
        done ? "bg-paper ring-line" : "bg-brand text-white ring-brand"
      }`}
    >
      <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${done ? "bg-sage-soft text-sage" : "bg-white/15"}`}>
        {done ? <Check className="h-8 w-8" /> : <Icon className="h-8 w-8" />}
      </span>
      <span className="flex-1">
        <span className="block text-2xl font-extrabold leading-tight">{label}</span>
        <span className={`block ${done ? "font-semibold text-sage" : "text-white/80"}`}>{done ? doneLabel : hint}</span>
      </span>
      <ChevronRight className={`h-6 w-6 ${done ? "text-faint" : "text-white/70"}`} />
    </button>
  );
}

function Screen({ title, Icon, onBack, t, children }: { title: string; Icon: IconT; onBack: () => void; t: Dict; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5">
      <button onClick={onBack} className="flex items-center gap-1 self-start rounded-full bg-paper px-3 py-2 font-bold text-brand ring-1 ring-line">
        <ChevronLeft className="h-5 w-5" /> {t.back}
      </button>
      <h1 className="flex items-center gap-3 text-3xl font-extrabold tracking-tight">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand"><Icon className="h-7 w-7" /></span>
        {title}
      </h1>
      {children}
    </section>
  );
}

const primary = "w-full rounded-2xl bg-brand py-4 text-xl font-extrabold text-white shadow-sm hover:bg-brand-dark disabled:bg-line disabled:text-faint disabled:shadow-none";

function Saved({ text, onBack }: { text: string; onBack: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl bg-sage-soft p-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-sage"><Check className="h-9 w-9" /></span>
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
        <div className="flex flex-col items-center gap-2 rounded-3xl bg-paper p-6 text-center ring-1 ring-line">
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
        <span key={i} className={`h-3 w-10 rounded-full ${i < filled ? "bg-brand" : "bg-line"}`} />
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
        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${file ? "bg-sage text-white" : "bg-brand-soft text-brand"}`}>
          {file ? <Check className="h-4 w-4" /> : step}
        </span>
        {label}
      </span>
      <span className="relative flex aspect-square items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-line bg-paper">
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
        <div className="rounded-3xl bg-paper p-4 text-lg leading-snug ring-1 ring-line">
          <p>{t.standIntro}</p>
          <p className="mt-2 font-bold text-sun">⚠ {t.stayClose}</p>
        </div>
      )}
      <div className="rounded-3xl bg-paper p-6 text-center ring-1 ring-line">
        <p className="text-7xl font-extrabold tabular-nums tracking-tight">{elapsed.toFixed(1)}</p>
        <p className="text-lg text-muted">{t.seconds}</p>
        <div className="mt-4 flex justify-center gap-2" aria-label={`${reps} / 5`}>
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold ${i < reps ? "bg-brand text-white" : "bg-line text-faint"}`}>
              {i + 1}
            </span>
          ))}
        </div>
      </div>
      {start === null ? (
        <button className={primary} onClick={() => setStart(Date.now())}>{t.start}</button>
      ) : !finished ? (
        <button className="min-h-44 rounded-3xl bg-sun text-2xl font-extrabold text-white shadow-md active:scale-[0.98]" onClick={() => setReps((r) => r + 1)}>
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
      <p className="text-lg leading-snug text-muted">{t.voiceIntro}</p>
      {Speech && (
        <button
          onClick={toggle}
          className={`flex flex-col items-center gap-2 rounded-3xl py-8 text-xl font-extrabold text-white shadow-md ${listening ? "animate-pulse bg-coral" : "bg-brand"}`}
        >
          <Mic className="h-12 w-12" />
          {listening ? t.recording : t.record}
        </button>
      )}
      <label className="flex flex-col gap-2">
        <span className="font-bold">{t.orType}</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="rounded-3xl border border-line bg-paper p-4 text-lg" />
      </label>
      <button className={primary} disabled={!text.trim() || state === "busy"} onClick={save}>{state === "busy" ? t.working : t.save}</button>
      {state === "error" && <p className="rounded-2xl bg-coral-soft p-3 text-center font-semibold text-coral">{t.failed}</p>}
    </Screen>
  );
}

const FACES = ["😣", "🙁", "😐", "🙂", "😄"];

function CheckIn({ t, name, done, onDone }: { t: Dict; name: string; done: boolean; onDone: () => void }) {
  const [mood, setMood] = useState<number | null>(null);
  async function send(rested: boolean) {
    await fetch("/api/checkin", { method: "POST", body: JSON.stringify({ mood, rested }) });
    onDone();
  }
  if (done) {
    return (
      <p className="flex items-center gap-3 rounded-3xl bg-lilac-soft p-4 text-lg font-semibold">
        <span aria-hidden>💜</span> {t.thanksCheckin}
      </p>
    );
  }
  return (
    <section className="rounded-3xl bg-lilac-soft p-5">
      <h2 className="text-xl font-extrabold">{t.andYou.replace("{name}", name)}</h2>
      <p className="text-muted">{t.howAreYou}</p>
      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {FACES.map((f, i) => (
          <button
            key={f}
            onClick={() => setMood(i + 1)}
            aria-pressed={mood === i + 1}
            className={`flex flex-col items-center gap-1 rounded-2xl py-2 transition ${mood === i + 1 ? "bg-white shadow ring-2 ring-[#6b4fa0]" : "bg-white/50"}`}
          >
            <span className="text-3xl">{f}</span>
            <span className="text-[11px] font-semibold leading-tight text-muted">{t.moodWords[i]}</span>
          </button>
        ))}
      </div>
      {mood && (
        <div className="mt-4">
          <p className="mb-2 font-bold">{t.restedToday}</p>
          <div className="grid grid-cols-2 gap-2">
            <button className="rounded-2xl bg-[#6b4fa0] py-3 text-lg font-bold text-white" onClick={() => send(true)}>{t.yes}</button>
            <button className="rounded-2xl bg-white py-3 text-lg font-bold" onClick={() => send(false)}>{t.no}</button>
          </div>
        </div>
      )}
    </section>
  );
}

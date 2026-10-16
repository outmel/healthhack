"use client";

// Phone-first helper view: three big buttons, three languages, nothing to chat with.
import { useEffect, useMemo, useRef, useState } from "react";
import { DICTS, LANGS, SPEECH_LOCALE, type Dict, type Lang } from "@/lib/i18n";
import LogoutButton from "@/components/LogoutButton";

type Screen = "home" | "meal" | "stand" | "voice";

export default function HelperApp({ name, seniorName, initialLang }: { name: string; seniorName: string; initialLang: Lang }) {
  const [lang, setLang] = useState<Lang>(initialLang in DICTS ? initialLang : "id");
  const [screen, setScreen] = useState<Screen>("home");
  const t = DICTS[lang];
  const back = () => setScreen("home");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <p className="text-2xl font-bold">{t.hello}, {name}</p>
          <p className="text-stone-600">{t.caringFor} {seniorName}</p>
        </div>
        <select aria-label="Language" value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="rounded-lg border border-stone-300 bg-white p-2 text-sm">
          {Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </header>

      {screen === "home" && (
        <>
          <BigButton emoji="🍽️" label={t.meal} hint={t.mealHint} onClick={() => setScreen("meal")} />
          <BigButton emoji="🪑" label={t.stand} hint={t.standHint} onClick={() => setScreen("stand")} />
          <BigButton emoji="🎙️" label={t.voice} hint={t.voiceHint} onClick={() => setScreen("voice")} />
          <CheckIn t={t} />
        </>
      )}
      {screen === "meal" && <MealCapture t={t} onDone={back} />}
      {screen === "stand" && <StandTest t={t} onDone={back} />}
      {screen === "voice" && <VoiceNote t={t} lang={lang} onDone={back} />}

      <footer className="mt-auto flex items-center justify-between gap-2 pt-4 text-sm">
        <a href="tel:995" className="rounded-lg bg-red-700 px-3 py-2 font-semibold text-white">{t.emergency}</a>
        <LogoutButton />
      </footer>
      <p className="text-xs text-stone-500">{t.notDiagnosis}</p>
    </main>
  );
}

function BigButton({ emoji, label, hint, onClick }: { emoji: string; label: string; hint: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex min-h-28 items-center gap-4 rounded-2xl bg-teal-700 p-5 text-left text-white shadow active:scale-[0.99]">
      <span className="text-5xl" aria-hidden>{emoji}</span>
      <span>
        <span className="block text-2xl font-bold">{label}</span>
        <span className="block text-teal-100">{hint}</span>
      </span>
    </button>
  );
}

function Panel({ title, onBack, t, children }: { title: string; onBack: () => void; t: Dict; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{title}</h2>
        <button onClick={onBack} className="text-teal-700">← {t.back}</button>
      </div>
      {children}
    </section>
  );
}

const primary = "rounded-xl bg-teal-700 p-4 text-lg font-semibold text-white disabled:opacity-40";

function MealCapture({ t, onDone }: { t: Dict; onDone: () => void }) {
  const [before, setBefore] = useState<File | null>(null);
  const [after, setAfter] = useState<File | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [result, setResult] = useState<{ bucket: number; note: string } | null>(null);

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
  }

  return (
    <Panel title={t.meal} onBack={onDone} t={t}>
      <div className="grid grid-cols-2 gap-3">
        <PhotoPicker label={t.before} hint={t.takePhoto} file={before} onFile={setBefore} />
        <PhotoPicker label={t.after} hint={t.takePhoto} file={after} onFile={setAfter} />
      </div>
      {!result && (
        <button className={primary} disabled={!before || !after || state === "busy"} onClick={submit}>
          {state === "busy" ? t.working : t.estimate}
        </button>
      )}
      {state === "error" && <p className="text-red-700">{t.failed}</p>}
      {result && (
        <div className="rounded-xl bg-teal-50 p-4 text-center">
          <p className="text-stone-600">{t.ate}</p>
          <p className="text-5xl font-bold text-teal-800">{result.bucket}%</p>
          <button className={`${primary} mt-4 w-full`} onClick={onDone}>{t.done}</button>
        </div>
      )}
    </Panel>
  );
}

function PhotoPicker({ label, hint, file, onFile }: { label: string; hint: string; file: File | null; onFile: (f: File) => void }) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : undefined), [file]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return (
    <label className="flex aspect-square cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 text-center">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label} className="h-full w-full object-cover" />
      ) : (
        <>
          <span className="text-lg font-semibold">{label}</span>
          <span className="text-sm text-stone-500">{hint}</span>
        </>
      )}
      {/* capture opens the camera on phones; desktop judges get a file picker */}
      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
    </label>
  );
}

// Tap-to-count fallback. Lane 2 replaces/extends this with the MediaPipe pose module.
function StandTest({ t, onDone }: { t: Dict; onDone: () => void }) {
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
  }

  return (
    <Panel title={t.stand} onBack={onDone} t={t}>
      <div className="text-center">
        <p className="text-6xl font-bold tabular-nums">{elapsed.toFixed(1)}<span className="text-2xl"> {t.seconds}</span></p>
        <p className="text-2xl">{reps} / 5 {t.reps}</p>
      </div>
      {start === null ? (
        <button className={primary} onClick={() => setStart(Date.now())}>{t.start}</button>
      ) : !finished ? (
        <button className="min-h-40 rounded-2xl bg-amber-500 text-2xl font-bold text-white" onClick={() => setReps((r) => r + 1)}>
          {t.tapEachStand}
        </button>
      ) : saved ? (
        <button className={primary} onClick={onDone}>{t.saved}</button>
      ) : (
        <button className={primary} onClick={save}>{t.save}</button>
      )}
    </Panel>
  );
}

type SpeechRec = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void };

function VoiceNote({ t, lang, onDone }: { t: Dict; lang: Lang; onDone: () => void }) {
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
  }

  return (
    <Panel title={t.voice} onBack={onDone} t={t}>
      {Speech && (
        <button onClick={toggle} className={`min-h-24 rounded-2xl text-xl font-bold text-white ${listening ? "bg-red-600" : "bg-teal-700"}`}>
          🎙️ {listening ? t.recording : t.record}
        </button>
      )}
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t.orType} rows={4} className="rounded-xl border border-stone-300 p-3 text-lg" />
      {state === "saved" ? (
        <button className={primary} onClick={onDone}>{t.saved}</button>
      ) : (
        <button className={primary} disabled={!text.trim() || state === "busy"} onClick={save}>{state === "busy" ? t.working : t.save}</button>
      )}
      {state === "error" && <p className="text-red-700">{t.failed}</p>}
    </Panel>
  );
}

function CheckIn({ t }: { t: Dict }) {
  const [mood, setMood] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  async function send(rested: boolean) {
    await fetch("/api/checkin", { method: "POST", body: JSON.stringify({ mood, rested }) });
    setDone(true);
  }
  if (done) return <p className="rounded-2xl bg-white p-4 text-center text-teal-800 shadow">💚 {t.saved}</p>;
  return (
    <section className="rounded-2xl bg-white p-4 shadow">
      <p className="mb-2 font-semibold">{t.howAreYou}</p>
      <div className="flex justify-between text-3xl">
        {["😣", "🙁", "😐", "🙂", "😄"].map((f, i) => (
          <button key={f} onClick={() => setMood(i + 1)} className={`rounded-xl p-2 ${mood === i + 1 ? "bg-teal-100 ring-2 ring-teal-600" : ""}`}>{f}</button>
        ))}
      </div>
      {mood && (
        <div className="mt-3">
          <p className="mb-2 font-semibold">{t.restedToday}</p>
          <div className="grid grid-cols-2 gap-2">
            <button className={primary} onClick={() => send(true)}>{t.yes}</button>
            <button className="rounded-xl border border-stone-300 p-4 text-lg font-semibold" onClick={() => send(false)}>{t.no}</button>
          </div>
        </div>
      )}
    </section>
  );
}

"use client";

import { useState } from "react";
import { Wordmark } from "@/components/Shell";
import { setTour } from "@/lib/demo";
import { LANGS, type Lang } from "@/lib/i18n";
import type { Role } from "@/lib/session";

type Mode = "create" | "join";

const ROLES: { role: Role; label: string; desc: string }[] = [
  { role: "family", label: "Family", desc: "A son, daughter or relative" },
  { role: "helper", label: "Helper", desc: "The live-in carer" },
  { role: "gp", label: "Doctor (GP)", desc: "The family doctor" },
];

const field = "min-h-[52px] rounded-2xl border border-line bg-cream px-3";
const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

export default function SignupPage() {
  const [mode, setMode] = useState<Mode>("create");
  const [role, setRole] = useState<Role>("family");
  const [language, setLanguage] = useState<Lang>("id");
  const [f, setF] = useState({ name: "", email: "", password: "", code: "", seniorName: "", age: "", conditions: "", medications: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setError("");
    const body = {
      mode, role, language, name: f.name, email: f.email, password: f.password,
      ...(mode === "create"
        ? { senior: { name: f.seniorName, age: f.age, conditions: list(f.conditions), medications: list(f.medications) } }
        : { code: f.code }),
    };
    const res = await fetch("/api/signup", { method: "POST", body: JSON.stringify(body) }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (res?.ok) {
      setTour(false);
      window.location.assign(data.redirect);
    } else {
      setError(data?.error ?? "That didn't work. Please try again.");
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col">
      <section className="bg-brand text-cream">
        <div className="mx-auto max-w-[640px] px-6 pb-16 pt-7">
          <a href="/login" aria-label="Back to the start"><Wordmark light /></a>
          <h1 className="mt-10 text-[36px] font-extrabold leading-tight tracking-tight">Create your account</h1>
          <p className="mt-3 text-lg text-cream/85">Start a household for the parent you care for, or join one you&apos;ve been invited to.</p>
        </div>
      </section>

      <div className="mx-auto -mt-8 w-full max-w-[640px] px-6 pb-12">
        <form onSubmit={submit} className="flex flex-col gap-5 rounded-[22px] border border-line bg-paper p-5">
          <div role="tablist" aria-label="Household" className="grid grid-cols-2 gap-1 rounded-2xl bg-cream p-1">
            {(["create", "join"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`min-h-11 rounded-xl font-bold ${mode === m ? "bg-paper text-brand-dark shadow-sm" : "text-muted"}`}
              >
                {m === "create" ? "Start a household" : "Join with a code"}
              </button>
            ))}
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-semibold">I am the…</legend>
            <div className="mt-1 grid gap-2 sm:grid-cols-3">
              {ROLES.map((r) => (
                <label
                  key={r.role}
                  className={`flex cursor-pointer flex-col rounded-2xl border-2 p-3 ${role === r.role ? "border-brand bg-brand-soft/40" : "border-line"}`}
                >
                  <input type="radio" name="role" value={r.role} checked={role === r.role} onChange={() => setRole(r.role)} className="sr-only" />
                  <span className="font-extrabold">{r.label}</span>
                  <span className="text-sm text-muted">{r.desc}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {role === "helper" && (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold">Language for your app</span>
              <select className={field} value={language} onChange={(e) => setLanguage(e.target.value as Lang)}>
                {Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">Your name</span>
            <input className={field} autoComplete="name" value={f.name} onChange={set("name")} required maxLength={60} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">Email</span>
            <input className={field} type="email" autoComplete="email" value={f.email} onChange={set("email")} required />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">Password</span>
            <input className={field} type="password" autoComplete="new-password" value={f.password} onChange={set("password")} required minLength={8} />
            <span className="text-sm text-muted">At least 8 characters.</span>
          </label>

          {mode === "create" ? (
            <fieldset className="flex flex-col gap-3 rounded-2xl bg-cream p-4">
              <legend className="px-1 text-sm font-extrabold">Who you&apos;re caring for</legend>
              <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-semibold">Name</span>
                  <input className={`${field} bg-paper`} placeholder="e.g. Mdm Tan" value={f.seniorName} onChange={set("seniorName")} required maxLength={60} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-semibold">Age</span>
                  <input className={`${field} bg-paper`} type="number" inputMode="numeric" min={40} max={120} value={f.age} onChange={set("age")} required />
                </label>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold">Conditions <span className="font-normal text-muted">(optional, separate with commas)</span></span>
                <input className={`${field} bg-paper`} placeholder="e.g. Mild hypertension" value={f.conditions} onChange={set("conditions")} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold">Medications <span className="font-normal text-muted">(optional, separate with commas)</span></span>
                <input className={`${field} bg-paper`} placeholder="e.g. Amlodipine 5 mg once daily" value={f.medications} onChange={set("medications")} />
              </label>
              <p className="text-sm text-muted">You&apos;ll get an invite code to share with the helper and GP once you&apos;re in.</p>
            </fieldset>
          ) : (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold">Invite code</span>
              <input
                className={`${field} font-mono text-lg uppercase tracking-[0.3em]`}
                placeholder="ABC234"
                autoCapitalize="characters"
                value={f.code}
                onChange={set("code")}
                required
                maxLength={12}
              />
              <span className="text-sm text-muted">Ask whoever set up the household. It&apos;s shown at the top of their screen.</span>
            </label>
          )}

          {error && <p role="alert" className="text-coral">{error}</p>}
          <button disabled={busy} className="min-h-[52px] rounded-2xl bg-brand text-lg font-bold text-cream hover:bg-brand-dark disabled:opacity-60">
            {busy ? "Creating your account…" : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-center text-[15px] text-muted">
          Already have an account? <a href="/login#roles" className="font-bold text-brand underline underline-offset-4">Sign in</a>
          {" · "}
          <a href="/login" className="font-bold text-brand underline underline-offset-4">Try the demo</a>
        </p>
      </div>
    </main>
  );
}

"use client";

import { useState } from "react";
import { Wordmark } from "@/components/Shell";

const DEMO_PASSWORD = "teman2026";

const STEPS = [
  { title: "Siti snaps, films or speaks", desc: "A meal photo, a 30-second stand test, or a voice note in her own language." },
  { title: "Teman compares with her usual", desc: "Every reading is checked against Mum’s own normal, not a textbook average." },
  { title: "Family and GP get a clear alert", desc: "Plain words for the family, a one-page trend summary for the doctor." },
];

const ROLES = [
  { email: "siti@teman.demo", who: "Siti", initial: "S", role: "Helper · Bahasa Indonesia", desc: "Three quick tasks a day, in her own language. Plus a check-in on how she’s doing.", featured: true },
  { email: "rachel@teman.demo", who: "Rachel", initial: "R", role: "Daughter", desc: "One glance at how Mum is doing this week, and what to do about it." },
  { email: "drlim@teman.demo", who: "Dr Lim", initial: "L", role: "Family doctor (GP)", desc: "Trends against her baseline, the helper’s notes translated, and an AI summary for the visit." },
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function login(e: string, p: string) {
    setBusy(e);
    setError("");
    const res = await fetch("/api/login", { method: "POST", body: JSON.stringify({ email: e, password: p }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) window.location.assign(data.redirect);
    else {
      setError(data.error ?? "That didn't work. Please try again.");
      setBusy(null);
    }
  }

  return (
    <main className="flex flex-1 flex-col">
      <section className="bg-brand text-cream">
        <div className="mx-auto max-w-[1120px] px-6 pb-[72px] pt-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Wordmark light />
            <span className="text-[15px] text-cream/80">Teman = “friend” in Malay &amp; Bahasa</span>
          </div>
          <h1 className="mt-12 max-w-3xl text-[40px] font-extrabold leading-[1.08] tracking-tight sm:text-[52px]">
            The helper sees it first.{" "}
            <span className="text-turmeric">Teman makes sure everyone else does too.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-cream/85">
            In Singapore, a live-in helper often notices first when an older parent starts eating less or getting slower. Teman turns
            what she sees into a clear signal for the family and the GP, before it becomes a fall or a hospital stay.
          </p>
          <a
            href="#roles"
            className="mt-7 inline-flex min-h-[52px] items-center rounded-2xl bg-turmeric px-6 text-[17px] font-extrabold text-sun-deep hover:brightness-105"
          >
            Start guided demo →
          </a>
        </div>
      </section>

      <div className="mx-auto -mt-10 w-full max-w-[1120px] px-6">
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-[22px] border border-line bg-paper p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-lg font-extrabold text-brand-dark">{i + 1}</span>
              <p className="mt-3 text-lg font-extrabold">{s.title}</p>
              <p className="mt-1 text-body">{s.desc}</p>
            </li>
          ))}
        </ol>

        <section id="roles" aria-labelledby="try" className="scroll-mt-6 py-12">
          <h2 id="try" className="text-[28px] font-extrabold tracking-tight">Try it as…</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {ROLES.map(({ email: e, who, initial, role, desc, featured }) => (
              <button
                key={e}
                disabled={!!busy}
                onClick={() => login(e, DEMO_PASSWORD)}
                className={`flex flex-col items-start gap-3 rounded-[22px] bg-paper p-5 text-left transition hover:-translate-y-0.5 disabled:opacity-60 ${
                  featured ? "border-2 border-brand" : "border border-line hover:border-brand/50"
                }`}
              >
                <span className="flex items-center gap-3">
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-extrabold ${
                      featured ? "bg-brand text-cream" : "bg-brand-soft text-brand-dark"
                    }`}
                  >
                    {initial}
                  </span>
                  <span>
                    <span className="block text-lg font-extrabold">{who}</span>
                    <span className="block text-[15px] text-muted">{role}</span>
                  </span>
                </span>
                <span className="flex-1 text-body">{desc}</span>
                <span className="font-extrabold text-brand">{busy === e ? "Opening…" : `Sign in as ${who} →`}</span>
              </button>
            ))}
          </div>
          {error && !email && <p className="mt-3 text-coral">{error}</p>}

          <p className="mt-5 text-[15px] text-muted">All data is made up for this demo. One tap signs you in; no password needed.</p>

          <details className="mt-6 max-w-md rounded-[22px] border border-line bg-paper p-4">
            <summary className="cursor-pointer font-semibold text-muted">Sign in with email instead</summary>
            <form
              className="mt-4 flex flex-col gap-3"
              onSubmit={(ev) => {
                ev.preventDefault();
                login(email, password);
              }}
            >
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold">Email</span>
                <input className="min-h-[52px] rounded-2xl border border-line bg-cream px-3" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold">Password</span>
                <input className="min-h-[52px] rounded-2xl border border-line bg-cream px-3" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </label>
              {error && email && <p className="text-coral">{error}</p>}
              <button disabled={!!busy} className="min-h-[52px] rounded-2xl bg-brand text-lg font-bold text-cream hover:bg-brand-dark disabled:opacity-60">
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </details>
        </section>
      </div>
    </main>
  );
}

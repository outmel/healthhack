"use client";

import { useState } from "react";
import { ChevronRight, Heart, Logo, Stethoscope, Users } from "@/components/icons";

const DEMO_PASSWORD = "teman2026";

const ROLES = [
  { email: "siti@teman.demo", who: "Siti", title: "I'm the helper", desc: "Log meals, a quick stand test and voice notes", Icon: Heart, tint: "bg-brand-soft text-brand" },
  { email: "rachel@teman.demo", who: "Rachel", title: "I'm family", desc: "See how Mum is doing this week", Icon: Users, tint: "bg-sun-soft text-sun" },
  { email: "drlim@teman.demo", who: "Dr Lim", title: "I'm the doctor", desc: "Trends, notes and a summary for the visit", Icon: Stethoscope, tint: "bg-lilac-soft text-[#6b4fa0]" },
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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-4 py-10">
      <header className="flex flex-col items-center gap-3 text-center">
        <Logo className="h-14 w-14" />
        <h1 className="text-4xl font-extrabold tracking-tight text-brand-dark">Teman</h1>
        <p className="max-w-xs text-lg text-muted">
          The helper sees it first. Teman makes sure everyone else sees it too.
        </p>
      </header>

      <section aria-labelledby="who" className="flex flex-col gap-3">
        <h2 id="who" className="text-center text-sm font-bold uppercase tracking-wider text-faint">Who are you?</h2>
        {ROLES.map(({ email: e, who, title, desc, Icon, tint }) => (
          <button
            key={e}
            disabled={!!busy}
            onClick={() => login(e, DEMO_PASSWORD)}
            className="flex min-h-20 items-center gap-4 rounded-3xl border border-line bg-paper p-4 text-left shadow-sm transition hover:border-brand/40 hover:shadow-md active:scale-[0.99] disabled:opacity-60"
          >
            <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${tint}`}>
              <Icon className="h-7 w-7" />
            </span>
            <span className="flex-1">
              <span className="block text-lg font-bold">{title}</span>
              <span className="block text-muted">{busy === e ? "Opening…" : `${desc} · ${who}`}</span>
            </span>
            <ChevronRight className="h-5 w-5 text-faint" />
          </button>
        ))}
        {error && !email && <p className="text-center text-coral">{error}</p>}
      </section>

      <details className="rounded-3xl border border-line bg-paper p-4">
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
            <input className="rounded-2xl border border-line bg-cream p-3" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">Password</span>
            <input className="rounded-2xl border border-line bg-cream p-3" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && email && <p className="text-coral">{error}</p>}
          <button disabled={!!busy} className="rounded-2xl bg-brand p-3 text-lg font-bold text-white hover:bg-brand-dark disabled:opacity-60">
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </details>

      <p className="text-center text-sm text-faint">
        Demo with made-up data. Teman notices changes; it doesn&apos;t diagnose. Emergency? Call <strong className="text-coral">995</strong>.
      </p>
    </main>
  );
}

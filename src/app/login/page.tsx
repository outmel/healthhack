"use client";

import { useState } from "react";

const DEMO = [
  { email: "siti@teman.demo", label: "Siti", role: "Helper" },
  { email: "rachel@teman.demo", label: "Rachel", role: "Family" },
  { email: "drlim@teman.demo", label: "Dr Lim", role: "GP" },
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function login(e: string, p: string) {
    setBusy(true);
    setError("");
    const res = await fetch("/api/login", { method: "POST", body: JSON.stringify({ email: e, password: p }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) window.location.href = data.redirect;
    else {
      setError(data.error ?? "Login failed");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-4xl font-bold text-teal-700">Teman</h1>
        <p className="mt-1 text-stone-600">The helper sees it first. Teman makes sure everyone else sees it too.</p>
      </div>

      <form
        className="flex flex-col gap-3"
        onSubmit={(ev) => {
          ev.preventDefault();
          login(email, password);
        }}
      >
        <input className="rounded-xl border border-stone-300 p-3" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="rounded-xl border border-stone-300 p-3" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button disabled={busy} className="rounded-xl bg-teal-700 p-3 font-semibold text-white disabled:opacity-50">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div>
        <p className="mb-2 text-sm text-stone-500">Demo accounts (password: teman2026)</p>
        <div className="grid grid-cols-3 gap-2">
          {DEMO.map((d) => (
            <button key={d.email} disabled={busy} onClick={() => login(d.email, "teman2026")} className="rounded-xl border border-stone-300 bg-white p-3 text-left disabled:opacity-50">
              <div className="font-semibold">{d.label}</div>
              <div className="text-xs text-stone-500">{d.role}</div>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}

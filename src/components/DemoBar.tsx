"use client";

// Slim bar on every signed-in page: who you're viewing as, one tap to switch role,
// and the guided demo's current step.
import { useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { DEMO_USERS, TOUR, setTour, signInAs, tourOn } from "@/lib/demo";
import type { Role } from "@/lib/session";

export default function DemoBar({ role, name, demo, code }: { role: Role; name: string; demo: boolean; code: string | null }) {
  const path = usePathname();
  // localStorage only exists in the browser; the server render never shows the tour.
  const stored = useSyncExternalStore(noSubscribe, tourOn, () => false);
  const [ended, setEnded] = useState(false);
  const tour = stored && !ended;
  const [busy, setBusy] = useState<string | null>(null);

  // The read-only GP summary link is for the clinic, not part of the demo.
  if (path.startsWith("/summary")) return null;

  // A signed-up household: no role switching, reset or tour; just the code to invite others.
  if (!demo) {
    return (
      <div className="no-print bg-ink text-cream">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
          <span>
            Signed in as <strong>{name}</strong>
          </span>
          {code && (
            <span>
              <span className="text-cream/60">· Invite your helper, family or GP with code </span>
              <strong className="font-mono tracking-widest text-turmeric">{code}</strong>
            </span>
          )}
          <button onClick={signOut} className="ml-auto text-cream/70 underline underline-offset-2 hover:text-cream">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const others = DEMO_USERS.filter((u) => u.role !== role);
  const step = TOUR[role];
  const nextUser = DEMO_USERS[step.step]; // TOUR steps are 1-based, so this is the next role

  async function go(email: string) {
    setBusy(email);
    await signInAs(email).catch(() => setBusy(null));
  }
  async function signOut() {
    setTour(false);
    await fetch("/api/login", { method: "DELETE" });
    window.location.assign("/login");
  }
  async function resetDemo() {
    if (!window.confirm("Put the demo story back to its starting point? Anything tried here (meals, stand tests, messages, rest days) is cleared for everyone.")) return;
    setBusy("reset");
    await fetch("/api/demo/reset", { method: "POST" }).catch(() => null);
    window.location.reload();
  }
  function finish() {
    setTour(false);
    setEnded(true);
  }

  return (
    <div className="no-print bg-ink text-cream">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
        <span>
          Viewing as <strong>{name}</strong>
        </span>
        <span className="flex flex-wrap items-center gap-x-2" aria-label="Switch role">
          <span className="text-cream/60">· Switch to</span>
          {others.map((u, i) => (
            <span key={u.email}>
              <button onClick={() => go(u.email)} disabled={!!busy} className="font-bold text-turmeric underline underline-offset-2 disabled:opacity-60">
                {busy === u.email ? "Opening…" : u.who}
              </button>
              {i < others.length - 1 && <span className="text-cream/60"> /</span>}
            </span>
          ))}
        </span>
        <span className="ml-auto flex items-center gap-3">
          <button onClick={resetDemo} disabled={!!busy} className="text-cream/70 underline underline-offset-2 hover:text-cream disabled:opacity-60">
            {busy === "reset" ? "Resetting…" : "Reset demo"}
          </button>
          <button onClick={signOut} className="text-cream/70 underline underline-offset-2 hover:text-cream">
            Sign out
          </button>
        </span>
      </div>
      {tour && (
        <div className="bg-turmeric text-sun-deep">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
            <span className="rounded-full bg-sun-deep px-2.5 py-0.5 text-xs font-extrabold text-turmeric">Step {step.step} of 3</span>
            <span className="flex-1 font-bold">{step.text}</span>
            {step.next && nextUser ? (
              <button
                onClick={() => go(nextUser.email)}
                disabled={!!busy}
                className="min-h-10 rounded-xl bg-sun-deep px-3 font-extrabold text-cream disabled:opacity-60"
              >
                {busy === nextUser.email ? "Opening…" : `Next: ${step.next} →`}
              </button>
            ) : (
              <button onClick={finish} className="min-h-10 rounded-xl bg-sun-deep px-3 font-extrabold text-cream">
                Finish tour
              </button>
            )}
            {step.next && (
              <button onClick={finish} className="text-sm underline underline-offset-2">
                Exit tour
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const noSubscribe = () => () => {};

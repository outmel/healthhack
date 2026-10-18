"use client";

// The GP messages the helper or the family from the report. Messages to the helper are translated
// into her language; she sees them on her home screen, the family on theirs.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Shell";
import { Check, Message } from "@/components/icons";
import type { SentMessage } from "@/lib/data";

const LANG_EN: Record<string, string> = { id: "Indonesian", tl: "Tagalog", en: "English" };

type Contact = { key: "helper" | "family"; name: string; role: string; lang: string } | null;

export default function ContactHousehold({
  seniorName, helper, family, sent,
}: {
  seniorName: string;
  helper: { name: string; language: string } | null;
  family: string | null;
  sent: SentMessage[];
}) {
  const router = useRouter();
  const contacts = [
    helper && { key: "helper" as const, name: helper.name, role: "Helper", lang: helper.language },
    family && { key: "family" as const, name: family, role: "Family", lang: "en" },
  ].filter(Boolean) as NonNullable<Contact>[];
  const [to, setTo] = useState<NonNullable<Contact> | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ to: string; translated: string | null } | null>(null);

  const suggestions: Record<"helper" | "family", string[]> = {
    helper: [
      `Please help ${seniorName} sit for a moment before standing, and stay close when she walks.`,
      `Please offer ${seniorName} a drink every hour and note how much she drinks.`,
      `If ${seniorName} falls, faints or is hard to wake, call 995 straight away.`,
    ],
    family: [
      `I'd like to see ${seniorName} this week. Please book a review at the clinic.`,
      `Please bring all of ${seniorName}'s medicines to the next visit.`,
      `Her readings look stable. Nothing urgent; please keep logging as usual.`,
    ],
  };

  function pick(c: NonNullable<Contact>) {
    setTo(c);
    setText("");
    setError("");
    setDone(null);
  }

  async function send() {
    if (!to) return;
    setSending(true);
    setError("");
    const res = await fetch("/api/messages", { method: "POST", body: JSON.stringify({ to: to.key, text }) }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setSending(false);
    if (!res?.ok) return setError(data.error ?? "Couldn't send. Try again.");
    setDone({ to: data.to ?? to.name, translated: data.translated ?? null });
    setTo(null);
    router.refresh();
  }

  return (
    <Card className="no-print">
      <h2 id="contact" className="scroll-mt-6 text-lg font-extrabold">Contact the household</h2>
      <p className="text-sm text-muted">Send a message in the app. Messages to the helper are translated into her language.</p>

      {contacts.length === 0 ? (
        <p className="mt-3 text-muted">Nobody else has joined this household yet.</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {contacts.map((c) => (
            <button
              key={c.key}
              onClick={() => pick(c)}
              aria-pressed={to?.key === c.key}
              className={`flex min-h-[52px] items-center gap-3 rounded-2xl border-2 px-4 text-left ${
                to?.key === c.key ? "border-brand bg-brand-soft/50" : "border-line hover:border-brand/50"
              }`}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft font-extrabold text-brand-dark">{c.name[0]}</span>
              <span>
                <span className="block font-extrabold">Message {c.name}</span>
                <span className="block text-sm text-muted">
                  {c.role}{c.lang !== "en" ? ` · reads ${LANG_EN[c.lang] ?? "her language"}` : ""}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {to && (
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-sm font-semibold text-muted">Start from a suggestion, or write your own:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions[to.key].map((s) => (
              <button key={s} onClick={() => setText(s)} className="rounded-full border border-line bg-cream px-3 py-1.5 text-left text-sm hover:border-brand/50">
                {s}
              </button>
            ))}
          </div>
          <label className="mt-1 flex flex-col gap-1.5">
            <span className="font-bold">
              To {to.name}
              {to.lang !== "en" && <span className="font-normal text-muted"> · write in English, we translate it into {LANG_EN[to.lang] ?? "her language"}</span>}
            </span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              rows={3}
              className="rounded-2xl border border-line bg-cream p-3 text-[16px]"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={send}
              disabled={sending || !text.trim()}
              className="min-h-11 rounded-2xl bg-brand px-5 font-bold text-cream hover:bg-brand-dark disabled:opacity-60"
            >
              {sending ? (to.lang !== "en" ? "Translating and sending…" : "Sending…") : `Send to ${to.name}`}
            </button>
            <button onClick={() => setTo(null)} className="text-sm font-semibold text-muted underline underline-offset-2">
              Cancel
            </button>
          </div>
          {error && <p role="alert" className="text-coral">{error}</p>}
        </div>
      )}

      {done && (
        <div role="status" className="mt-4 rounded-2xl bg-brand-soft/60 p-3 text-brand-dark">
          <p className="flex items-center gap-2 font-bold"><Check className="h-5 w-5 shrink-0" /> Sent to {done.to}. They&apos;ll see it when they open Teman.</p>
          {done.translated && <p className="mt-1 text-sm italic">As they&apos;ll read it: “{done.translated}”</p>}
        </div>
      )}

      {sent.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-muted">Sent in the last 2 weeks ({sent.length})</summary>
          <ul className="mt-2 divide-y divide-track">
            {sent.map((m) => (
              <li key={m.id} className="flex gap-2 py-2 text-[15px]">
                <Message className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                <span>
                  <span className="font-semibold">To {m.to_name}</span>
                  <span className="text-muted"> · {new Date(m.created_at).toLocaleString("en-SG", { timeZone: "Asia/Singapore", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                  <span className="block text-body">{m.original_text}</span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

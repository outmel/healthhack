"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "@/components/icons";
import { fmtDay, sgToday } from "@/lib/format";

/** The coming Sunday (Singapore), or next week's if today is Sunday. */
function nextSunday() {
  const today = new Date(`${sgToday()}T12:00:00+08:00`);
  const add = 7 - today.getUTCDay() || 7;
  return new Date(today.getTime() + add * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
}

const LANG_NAME: Record<string, string> = { id: "Indonesian", tl: "Tagalog", en: "English" };

// Both actions are real: the rest day and the message are saved, and the helper sees them on
// her home screen. The message is translated into her language first.
export default function CarerActions({ helper, restDay, helperLang }: { helper: string; restDay: string | null; helperLang: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState(`Thank you for looking after Mum so well, ${helper}. Please rest this Sunday, I'll come over.`);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ translated: string | null } | null>(null);

  async function send() {
    setSending(true);
    setNote("");
    const res = await fetch("/api/messages", { method: "POST", body: JSON.stringify({ text }) }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setSending(false);
    if (!res?.ok) return setNote(data.error ?? "Couldn't send. Try again.");
    setSent({ translated: data.translated ?? null });
    setWriting(false);
  }

  async function giveSunday() {
    setBusy(true);
    const res = await fetch("/api/rest-day", { method: "POST", body: JSON.stringify({ day: nextSunday() }) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return setNote("Couldn't save the rest day. Try again.");
    router.refresh();
  }

  return (
    <div className="mt-4 flex flex-col gap-2">
      {restDay ? (
        <p className="flex items-center gap-2 rounded-2xl bg-paper p-3 font-bold text-rose-deep">
          <Check className="h-5 w-5 shrink-0 text-rose" /> {fmtDay(restDay)} is {helper}&apos;s rest day. She can see it on her phone.
        </p>
      ) : (
        <button
          onClick={giveSunday}
          disabled={busy}
          className="min-h-[52px] rounded-2xl bg-rose text-[17px] font-extrabold text-white hover:bg-rose-dark disabled:opacity-60"
        >
          {busy ? "Saving…" : `Give ${helper} Sunday off`}
        </button>
      )}
      {sent && (
        <div role="status" className="rounded-2xl bg-paper p-3 text-rose-deep">
          <p className="flex items-center gap-2 font-bold">
            <Check className="h-5 w-5 shrink-0 text-rose" /> Sent. {helper} sees it on her phone{sent.translated && helperLang !== "en" ? ` in ${LANG_NAME[helperLang] ?? "her language"}` : ""}:
          </p>
          <p className="mt-1.5 italic">“{sent.translated ?? text}”</p>
        </div>
      )}
      {writing ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-paper p-3">
          <label className="flex flex-col gap-1.5">
            <span className="font-bold text-rose-deep">Write in English. We translate it for {helper}.</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              rows={3}
              className="rounded-2xl border border-line bg-cream p-3 text-[17px] text-ink"
            />
          </label>
          <button
            onClick={send}
            disabled={sending || !text.trim()}
            className="min-h-[52px] rounded-2xl bg-rose text-[17px] font-extrabold text-white hover:bg-rose-dark disabled:opacity-60"
          >
            {sending ? "Translating and sending…" : `Send to ${helper}`}
          </button>
        </div>
      ) : (
        <button
          onClick={() => {
            setWriting(true);
            setSent(null);
          }}
          className="min-h-[52px] rounded-2xl border-2 border-rose bg-paper text-[17px] font-extrabold text-rose"
        >
          {sent ? `Send ${helper} another message` : `Message ${helper} · we translate it`}
        </button>
      )}
      {note && <p role="status" className="text-sm text-rose-dark">{note}</p>}
    </div>
  );
}

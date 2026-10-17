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

// Giving a rest day is real: it's saved, and the helper sees it on her home screen.
// Messaging is still a demo, and says so.
export default function CarerActions({ helper, restDay }: { helper: string; restDay: string | null }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

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
      <button
        onClick={() => setNote(`Demo: in the full app you'd write in English and ${helper} reads it in Bahasa.`)}
        className="min-h-[52px] rounded-2xl border-2 border-rose bg-paper text-[17px] font-extrabold text-rose"
      >
        Message {helper} · we translate it
      </button>
      {note && <p role="status" className="text-sm text-rose-dark">{note}</p>}
    </div>
  );
}

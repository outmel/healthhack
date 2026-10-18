"use client";

// "Book a GP visit", made real: share Dr Lim's read-only 1-page summary, then record the date.
// The booked state shows on the family and GP views.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Check, Share } from "@/components/icons";
import { fmtDay, sgToday } from "@/lib/format";

export default function BookReview({
  alertId, summaryPath, reviewDay, gpName, seniorName, familyName,
}: { alertId: number; summaryPath: string; reviewDay: string | null; gpName: string; seniorName: string; familyName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [shared, setShared] = useState("");

  if (reviewDay) {
    return (
      <p className="mt-4 flex items-center gap-2 rounded-2xl bg-brand-soft p-3 font-bold text-brand-dark">
        <Check className="h-5 w-5 shrink-0" /> GP review booked for {fmtDay(reviewDay)}. {gpName} has the summary.
      </p>
    );
  }

  // A ready-to-send message to the clinic, naming the GP, with the summary link.
  const clinicMessage = (url: string) =>
    `Hello, this is ${familyName}. I'd like to book a review with ${gpName} for my mother, ${seniorName}, this week. ` +
    `She has been eating less and getting up more slowly, and has felt dizzy when standing. ` +
    `Here is a 1-page summary for ${gpName}: ${url}`;

  async function share() {
    const url = `${window.location.origin}${summaryPath}`;
    const data = { title: `Booking with ${gpName}`, text: clinicMessage(url) };
    try {
      if (navigator.share) {
        await navigator.share(data);
        setShared("Shared.");
      } else {
        await navigator.clipboard.writeText(clinicMessage(url));
        setShared(`Message copied. Paste it into WhatsApp or an email to ${gpName}'s clinic.`);
      }
    } catch (e) {
      // Cancelled share sheet: nothing to do. Anything else: fall back to printing.
      if ((e as Error).name !== "AbortError") window.open(summaryPath, "_blank");
    }
  }

  async function book() {
    setState("busy");
    const res = await fetch(`/api/alerts/${alertId}/review`, { method: "POST", body: JSON.stringify({ date }) }).catch(() => null);
    if (!res?.ok) return setState("error");
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-brand text-[17px] font-extrabold text-cream hover:bg-brand-dark"
      >
        <Calendar className="h-5 w-5" /> Book a visit with {gpName}
      </button>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-cream p-4">
      <p className="font-bold">1. Message {gpName}&apos;s clinic</p>
      <p className="-mt-1 rounded-2xl bg-paper p-3 text-[15px] italic text-body">
        “{clinicMessage("[link to the 1-page summary]")}”
      </p>
      <button onClick={share} className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border-2 border-brand bg-paper font-extrabold text-brand">
        <Share className="h-5 w-5" /> Send this message
      </button>
      <p className="-mt-1 text-sm text-muted">The summary link is read-only and works for 7 days. {shared}</p>
      <label className="flex flex-col gap-1.5">
        <span className="font-bold">2. When is the visit?</span>
        <input
          type="date"
          min={sgToday()}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="min-h-[52px] rounded-2xl border border-line bg-paper px-3 text-[17px]"
        />
      </label>
      <button
        onClick={book}
        disabled={!date || state === "busy"}
        className="min-h-[52px] rounded-2xl bg-brand text-[17px] font-extrabold text-cream hover:bg-brand-dark disabled:bg-track disabled:text-faint"
      >
        {state === "busy" ? "Saving…" : "Mark GP review as booked"}
      </button>
      {state === "error" && <p className="text-sm font-semibold text-coral">Couldn&apos;t save. Try again.</p>}
    </div>
  );
}

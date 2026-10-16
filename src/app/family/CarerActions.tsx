"use client";

import { useState } from "react";

// Demo only: these actions aren't connected to a backend yet, so we say so instead of pretending.
export default function CarerActions({ helper }: { helper: string }) {
  const [note, setNote] = useState("");
  return (
    <div className="mt-4 flex flex-col gap-2">
      <button
        onClick={() => setNote(`Demo: in the full app ${helper} would be told Sunday is her day off.`)}
        className="min-h-[52px] rounded-2xl bg-rose text-[17px] font-extrabold text-white hover:bg-rose-dark"
      >
        Give {helper} Sunday off
      </button>
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

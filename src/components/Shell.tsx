import { Logo } from "./icons";

/** Page frame for the family (phone) and GP (wide) views. */
export default function Shell({
  wide = false,
  badge,
  right,
  children,
}: {
  wide?: boolean;
  badge?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const width = wide ? "max-w-[1200px]" : "max-w-[430px]";
  return (
    <>
      <nav className={wide ? "no-print border-b border-line bg-paper" : ""}>
        <div className={`mx-auto flex w-full items-center justify-between gap-3 px-4 py-3.5 ${width} ${wide ? "sm:px-6" : ""}`}>
          <span className="flex items-center gap-2.5">
            <Wordmark />
            {badge}
          </span>
          {right}
        </div>
      </nav>
      <div className={`mx-auto flex w-full flex-1 flex-col gap-4 px-4 pb-10 pt-3 ${width} ${wide ? "sm:px-6 sm:pt-6" : ""}`}>
        {children}
        <p className="mt-auto pt-4 text-center text-sm text-faint">Teman notices changes over time. It doesn&apos;t diagnose.</p>
      </div>
    </>
  );
}

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <span className={`flex items-center gap-2.5 text-[22px] font-extrabold tracking-tight ${light ? "text-cream" : "text-brand-dark"}`}>
      <Logo className="h-10 w-10" /> Teman
    </span>
  );
}

/** Rounded content card used across views. */
export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <section className={`rounded-[22px] border border-line bg-paper p-5 ${className}`}>{children}</section>;
}

type Level = "normal" | "watch" | "urgent";
const PILL: Record<Level, string> = {
  normal: "bg-brand-soft text-brand-dark",
  watch: "bg-sun-soft text-sun",
  urgent: "bg-coral text-white",
};

/** Status always shown as icon + words, never colour alone. */
export function StatusPill({ level, children, className = "" }: { level: Level; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${PILL[level]} ${className}`}>
      <StatusIcon level={level} /> {children}
    </span>
  );
}

export function StatusIcon({ level, className = "h-4 w-4" }: { level: Level; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {level === "normal" && <path d="M20 6 9 17l-5-5" />}
      {level === "watch" && <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}
      {level === "urgent" && <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4M12 17h.01" /></>}
    </svg>
  );
}

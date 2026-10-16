import LogoutButton from "./LogoutButton";
import { Logo, Phone } from "./icons";

/** Page frame for the family and GP views. */
export default function Shell({
  eyebrow,
  title,
  subtitle,
  wide = false,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`mx-auto flex w-full flex-1 flex-col gap-5 px-4 pb-8 pt-4 ${wide ? "max-w-6xl" : "max-w-2xl"}`}>
      <nav className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-lg font-extrabold text-brand-dark">
          <Logo className="h-8 w-8" /> Teman
        </span>
        <LogoutButton />
      </nav>
      <header>
        {eyebrow && <p className="text-sm font-bold uppercase tracking-wider text-faint">{eyebrow}</p>}
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-lg text-muted">{subtitle}</p>}
      </header>
      {children}
      <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-paper p-4 text-sm text-muted ring-1 ring-line">
        <span>Teman notices changes over time. It doesn&apos;t diagnose.</span>
        <a href="tel:995" className="flex items-center gap-1.5 rounded-full bg-coral px-3 py-1.5 font-bold text-white">
          <Phone className="h-4 w-4" /> Emergency: 995
        </a>
      </footer>
    </div>
  );
}

/** Rounded content card used across views. */
export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <section className={`rounded-3xl bg-paper p-5 shadow-sm ring-1 ring-line ${className}`}>{children}</section>;
}

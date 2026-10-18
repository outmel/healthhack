// "Why Teman flagged this": the baseline engine's own numbers, so the alert shows its working.
// Family: plain words ("6.6 times her normal day-to-day swing"). GP: mean ± SD, z and the rule.
import { LAG_DAYS, RECENT_DAYS, WINDOW_DAYS, Z_THRESHOLD, type Signal, type SignalStatus } from "@/lib/baseline";
import { StatusIcon } from "./Shell";

const r0 = (x: number) => Math.round(x);
const r1 = (x: number) => (Math.round(x * 10) / 10).toFixed(1);

export default function WhyFlagged({ statuses, variant }: { statuses: Partial<Record<Signal, SignalStatus | null>>; variant: "family" | "gp" }) {
  const rows = (["meal", "mobility"] as const).map((t) => statuses[t]).filter((s): s is SignalStatus => !!s && s.recent != null && s.z != null);
  if (!rows.length || (variant === "family" && !rows.some((s) => s.flagged))) return null;

  if (variant === "family") {
    return (
      <div className="mt-3 rounded-2xl border border-line p-3">
        <p className="eyebrow text-muted">Why Teman flagged this</p>
        <ul className="mt-1.5 flex flex-col gap-1.5 text-[15px] leading-snug text-body">
          {rows.filter((s) => s.flagged).map((s) => (
            <li key={s.type}>
              {s.type === "meal" ? (
                <>Eating about <strong>{r0(s.recent!)}%</strong> of each meal lately, against her usual <strong>{r0(s.mean)}%</strong>.</>
              ) : (
                <>Taking <strong>{r0(s.recent!)} s</strong> to stand up 5 times, against her usual <strong>{r0(s.mean)} s</strong>.</>
              )}{" "}
              That&apos;s <strong>{r1(Math.abs(s.z!))} times</strong> her normal day-to-day swing: not just a bad day.
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-paper p-4 text-[15px]">
      <p className="font-extrabold">Why it was flagged</p>
      <p className="text-sm text-muted">
        {RECENT_DAYS}-day mean vs her own {WINDOW_DAYS}-day baseline (lagged {LAG_DAYS} days). Flag at |z| &gt; {Z_THRESHOLD}.
      </p>
      <dl className="mt-2 grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {rows.map((s) => (
          <div key={s.type} className={`rounded-xl p-3 ${s.flagged ? "bg-sun-soft text-sun-deep" : "bg-cream"}`}>
            <dt className="flex items-center gap-1.5 font-bold">
              <StatusIcon level={s.flagged ? "watch" : "normal"} className="h-4 w-4" />
              {s.type === "meal" ? "Meal intake" : "5× sit-to-stand"}
            </dt>
            <dd className="mt-1 tabular-nums">
              {s.type === "meal" ? `${r1(s.recent!)}% vs ${r1(s.mean)} ± ${r1(s.sd)}%` : `${r1(s.recent!)} s vs ${r1(s.mean)} ± ${r1(s.sd)} s`}
              <span className="ml-2 font-extrabold">z = {s.z! > 0 ? "+" : "−"}{Math.abs(s.z!).toFixed(2)}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

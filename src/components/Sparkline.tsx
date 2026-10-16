// Tiny no-library sparkline: last N days against her usual range (shaded band).
import type { DailyPoint, SignalStatus } from "@/lib/baseline";

export default function Sparkline({
  series,
  status,
  days = 14,
  color = "#0e6b63",
  label,
}: {
  series: DailyPoint[];
  status: SignalStatus | null;
  days?: number;
  color?: string;
  label: string;
}) {
  const pts = series.slice(-days);
  if (pts.length < 2) return null;
  const W = 280, H = 64, pad = 6;
  const band = status ? [status.mean - 1.5 * status.sd, status.mean + 1.5 * status.sd] : null;
  const vals = pts.map((p) => p.value).concat(band ?? []);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const y = (v: number) => H - pad - ((v - lo) / (hi - lo || 1)) * (H - pad * 2);
  const x = (i: number) => pad + (i / (pts.length - 1)) * (W - pad * 2);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-full" role="img" aria-label={label}>
      {band && <rect x={0} width={W} y={y(band[1])} height={Math.max(2, y(band[0]) - y(band[1]))} rx={8} fill="#e2f1ed" />}
      <path d={d} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(pts.length - 1)} cy={y(last.value)} r={4.5} fill={color} stroke="#fff" strokeWidth={2} />
    </svg>
  );
}

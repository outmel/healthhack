"use client";

import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import type { DailyPoint, SignalStatus } from "@/lib/baseline";

export default function TrendChart({
  title, subtitle, unit, series, status,
}: { title: string; subtitle: string; unit: string; series: DailyPoint[]; status: SignalStatus | null }) {
  // Baseline band = mean ± 1.5 SD, drawn as a range area [low, high].
  const data = series.map((p) => ({
    day: new Date(p.day + "T00:00:00").toLocaleDateString("en-SG", { day: "numeric", month: "short" }),
    value: Math.round(p.value * 10) / 10,
    band: status ? [+(status.mean - 1.5 * status.sd).toFixed(1), +(status.mean + 1.5 * status.sd).toFixed(1)] : undefined,
  }));
  const flagged = status?.flagged;
  const color = flagged ? "#b86e00" : "#0e6b63";

  return (
    <section className={`rounded-3xl bg-paper p-5 shadow-sm ring-1 ${flagged ? "ring-2 ring-sun-line" : "ring-line"}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="text-sm text-faint">{subtitle}</p>
        </div>
        {status && (
          <div className="flex gap-4 text-right">
            <Stat label="Baseline" value={`${status.mean.toFixed(1)}${unit}`} />
            <Stat label="Last 3 days" value={`${status.recent?.toFixed(1)}${unit}`} highlight={flagged} />
            <Stat label="z" value={status.z?.toFixed(1) ?? "—"} highlight={flagged} />
          </div>
        )}
      </div>
      {data.length === 0 ? (
        <p className="py-16 text-center text-muted">No data yet</p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ left: -18, right: 8, top: 8 }}>
              <CartesianGrid stroke="#ece4d8" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#8b9497" }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
              <YAxis tick={{ fontSize: 12, fill: "#8b9497" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #ece4d8" }} />
              <Area dataKey="band" stroke="none" fill="#e2f1ed" fillOpacity={1} name="Personal baseline" isAnimationActive={false} />
              <Line dataKey="value" stroke={color} strokeWidth={2.5} dot={{ r: 2.5, fill: color }} activeDot={{ r: 5 }} name={title} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="mt-1 text-xs text-faint">Shaded band: her own 14-day baseline ± 1.5 SD.</p>
    </section>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-faint">{label}</p>
      <p className={`text-lg font-extrabold ${highlight ? "text-sun" : ""}`}>{value}</p>
    </div>
  );
}

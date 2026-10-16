"use client";

import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import type { DailyPoint, SignalStatus } from "@/lib/baseline";

const PANDAN = "#1F5C45", TURMERIC = "#E8A317", TURMERIC_TEXT = "#7A4A00", MIST = "#DCEBDF", DIVIDER = "#F1ECE1", MUTED = "#5A544B";

export default function TrendChart({
  title, subtitle, unit, series, status, noteDays = [],
}: { title: string; subtitle: string; unit: string; series: DailyPoint[]; status: SignalStatus | null; noteDays?: string[] }) {
  // Baseline band = mean ± 1.5 SD, drawn as a range area [low, high].
  const marked = new Set(noteDays);
  const data = series.map((p) => ({
    day: new Date(p.day + "T00:00:00").toLocaleDateString("en-SG", { day: "numeric", month: "short" }),
    value: Math.round(p.value * 10) / 10,
    note: marked.has(p.day),
    band: status ? [+(status.mean - 1.5 * status.sd).toFixed(1), +(status.mean + 1.5 * status.sd).toFixed(1)] : undefined,
  }));
  const flagged = status?.flagged;
  const change = status?.recent != null ? status.recent - status.mean : null;

  return (
    <section className="rounded-[22px] border border-line bg-paper p-5">
      <h2 className="text-lg font-extrabold">{title}</h2>
      <p className="text-sm text-muted">{subtitle}</p>
      {status && (
        <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-cream p-3">
          <Stat label="Usual" value={`${status.mean.toFixed(1)}${unit}`} />
          <Stat label="Last 3 days" value={`${status.recent?.toFixed(1)}${unit}`} highlight={flagged} />
          <Stat label="Change" value={change == null ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(1)}${unit}`} highlight={flagged} />
        </div>
      )}
      {data.length === 0 ? (
        <p className="py-16 text-center text-muted">No data yet</p>
      ) : (
        <div className="mt-3 h-60">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ left: -18, right: 8, top: 8 }}>
              <CartesianGrid stroke={DIVIDER} vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: MUTED }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
              <YAxis tick={{ fontSize: 12, fill: MUTED }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E6DCC8", fontFamily: "inherit" }} />
              <Area dataKey="band" stroke="none" fill={MIST} fillOpacity={1} name="Her usual range" isAnimationActive={false} />
              <Line
                dataKey="value"
                stroke={PANDAN}
                strokeWidth={2.5}
                dot={(p: { cx?: number; cy?: number; index?: number; payload?: { note: boolean } }) => (
                  <circle
                    key={p.index}
                    cx={p.cx}
                    cy={p.cy}
                    r={p.payload?.note ? 5.5 : 2.5}
                    fill={p.payload?.note ? TURMERIC : PANDAN}
                    stroke={p.payload?.note ? "#fff" : "none"}
                    strokeWidth={2}
                  />
                )}
                activeDot={{ r: 5 }}
                name={title}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className="text-lg font-extrabold" style={highlight ? { color: TURMERIC_TEXT } : undefined}>{value}</p>
    </div>
  );
}

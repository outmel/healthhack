"use client";

import { Area, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import type { DailyPoint, SignalStatus } from "@/lib/baseline";

const PANDAN = "#1F5C45", TURMERIC = "#E8A317", TURMERIC_TEXT = "#7A4A00", MIST = "#DCEBDF", DIVIDER = "#F1ECE1", MUTED = "#5A544B", CORAL = "#B3261E";

/** A published threshold drawn as a dashed line, e.g. the 5× sit-to-stand falls-risk cut-off. */
export type Reference = { value: number; label: string };

type Point = { day: string; value: number; note: boolean; finding?: string; band?: number[] };

export default function TrendChart({
  title, subtitle, unit, series, status, noteDays = [], reference, findings = {},
}: {
  title: string; subtitle: string; unit: string; series: DailyPoint[]; status: SignalStatus | null; noteDays?: string[];
  reference?: Reference;
  /** Day -> what the camera noticed, e.g. "Pushed up with hands, reps 3–5". Marked with a hand. */
  findings?: Record<string, string>;
}) {
  // Baseline band = mean ± 1.5 SD, drawn as a range area [low, high].
  const marked = new Set(noteDays);
  const data: Point[] = series.map((p) => ({
    day: new Date(p.day + "T00:00:00").toLocaleDateString("en-SG", { day: "numeric", month: "short" }),
    value: Math.round(p.value * 10) / 10,
    note: marked.has(p.day),
    finding: findings[p.day],
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
              <YAxis
                tick={{ fontSize: 12, fill: MUTED }}
                tickLine={false}
                axisLine={false}
                domain={reference ? [(min: number) => Math.floor(Math.min(min, reference.value) - 1), (max: number) => Math.ceil(Math.max(max, reference.value) + 1)] : ["auto", "auto"]}
              />
              <Tooltip content={<ChartTooltip unit={unit} />} />
              <Area dataKey="band" stroke="none" fill={MIST} fillOpacity={1} name="Her usual range" isAnimationActive={false} />
              {reference && (
                <ReferenceLine
                  y={reference.value}
                  stroke={CORAL}
                  strokeDasharray="6 4"
                  strokeWidth={1.5}
                  label={{ value: `${reference.label} ${reference.value}${unit}`, position: "insideTopLeft", fill: CORAL, fontSize: 11, fontWeight: 700 }}
                />
              )}
              <Line
                dataKey="value"
                stroke={PANDAN}
                strokeWidth={2.5}
                dot={(p: { cx?: number; cy?: number; index?: number; payload?: Point }) =>
                  p.payload?.finding && p.cx != null && p.cy != null ? (
                    <HandDot key={p.index} cx={p.cx} cy={p.cy} note={p.payload.note} />
                  ) : (
                    <circle
                      key={p.index}
                      cx={p.cx}
                      cy={p.cy}
                      r={p.payload?.note ? 5.5 : 2.5}
                      fill={p.payload?.note ? TURMERIC : PANDAN}
                      stroke={p.payload?.note ? "#fff" : "none"}
                      strokeWidth={2}
                    />
                  )
                }
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

/** Small hand marker: the camera saw her push up with her hands on this test. */
function HandDot({ cx, cy, note }: { cx: number; cy: number; note: boolean }) {
  return (
    <g transform={`translate(${cx - 7} ${cy - 7})`}>
      <circle cx={7} cy={7} r={7.5} fill={note ? TURMERIC : "#fff"} stroke={TURMERIC_TEXT} strokeWidth={1.2} />
      <path
        d="M4.6 8.2V5.4a.8.8 0 0 1 1.6 0v2M6.2 7.2V4.4a.8.8 0 0 1 1.6 0v2.8M7.8 7.2V4.9a.8.8 0 0 1 1.6 0v3.4M9.4 8.3V6.4a.8.8 0 0 1 1.4 0v2.6a3.4 3.4 0 0 1-3.4 3.2h-.6a3 3 0 0 1-2.5-1.4L3.2 8.9a.8.8 0 0 1 1.3-.9l.1.2"
        fill="none"
        stroke={TURMERIC_TEXT}
        strokeWidth={0.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

function ChartTooltip({ active, payload, unit }: { active?: boolean; payload?: { payload: Point }[]; unit: string }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="rounded-xl border border-line bg-paper px-3 py-2 text-sm shadow-sm">
      <p className="font-bold">{p.day}</p>
      <p>{p.value}{unit}{p.band ? ` · usual ${p.band[0]}–${p.band[1]}${unit}` : ""}</p>
      {p.finding && <p className="font-semibold" style={{ color: TURMERIC_TEXT }}>✋ {p.finding}</p>}
      {p.note && <p className="text-muted">Helper note mentions a symptom</p>}
    </div>
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

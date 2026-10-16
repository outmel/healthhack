"use client";

import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import type { DailyPoint, SignalStatus } from "@/lib/baseline";

export default function TrendChart({ title, unit, series, status }: { title: string; unit: string; series: DailyPoint[]; status: SignalStatus | null }) {
  // Baseline band = mean ± 1.5 SD, drawn as a stacked area [low, high].
  const data = series.map((p) => ({
    day: p.day.slice(5),
    value: Math.round(p.value * 10) / 10,
    band: status ? [status.mean - 1.5 * status.sd, status.mean + 1.5 * status.sd] : undefined,
  }));

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-semibold">{title}</h2>
        {status && (
          <span className={status.flagged ? "font-semibold text-amber-700" : "text-stone-500"}>
            baseline {status.mean.toFixed(1)}{unit} · now {status.recent?.toFixed(1)}{unit}
          </span>
        )}
      </div>
      {data.length === 0 ? (
        <p className="py-12 text-center text-stone-500">No data yet</p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
              <CartesianGrid stroke="#e7e5e4" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
              <Tooltip />
              <Area dataKey="band" stroke="none" fill="#99f6e4" fillOpacity={0.5} name="Personal baseline" isAnimationActive={false} />
              <Line dataKey="value" stroke="#0f766e" strokeWidth={2} dot={{ r: 2 }} name={title} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

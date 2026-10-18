// 28 days, left to right, one lane each for eating, standing up and the helper's notes, plus
// (optionally) the helper herself: her evening mood, her rest days and the stretch without one,
// so carer strain sits on the same clock as the senior's decline.
// A dashed line marks the day Teman flagged the change; the shaded stretch is when it began.
// Same component for the family (words only) and the GP (hover shows values). Plain SVG, so it
// renders on the server and prints.
import type { DailyPoint, SignalStatus } from "@/lib/baseline";
import type { CarerDay } from "@/lib/data";
import { fmtDay } from "@/lib/format";

const BRAND = "#1F5C45", MIST = "#DCEBDF", AMBER = "#E8A317", AMBER_TEXT = "#7A4A00", MUTED = "#5A544B", TRACK = "#F1ECE1", DRIFT = "#FCEBC4";
const ROSE = "#8E2F45", ROSE_SOFT = "#F4DCDC";

export type TimelineNote = { day: string; text: string; concerns: string[] };

const COL = 14, LABEL = 78, TOP = 22, LANE = 30;

export default function CareTimeline({
  days, meal, mealStatus, mobility, mobilityStatus, notes, flagDay, driftDay, showValues = false, carer, carerName = "Helper",
}: {
  days: string[];
  meal: DailyPoint[];
  mealStatus: SignalStatus | null;
  mobility: DailyPoint[];
  mobilityStatus: SignalStatus | null;
  notes: TimelineNote[];
  flagDay: string | null;
  driftDay: string | null;
  showValues?: boolean;
  carer?: CarerDay[];
  carerName?: string;
}) {
  const W = LABEL + days.length * COL + 6;
  const lanes = carer ? 4 : 3;
  const H = TOP + lanes * LANE + 22;
  const x = (i: number) => LABEL + i * COL + COL / 2;
  const laneY = (k: number) => TOP + k * LANE + LANE / 2;
  const m = new Map(meal.map((p) => [p.day, p.value]));
  const s = new Map(mobility.map((p) => [p.day, p.value]));
  const n = new Map<string, TimelineNote[]>();
  for (const note of notes) n.set(note.day, [...(n.get(note.day) ?? []), note]);
  const low = (v: number) => !!mealStatus && v < mealStatus.mean - 1.5 * mealStatus.sd;
  const slow = (v: number) => !!mobilityStatus && v > mobilityStatus.mean + 1.5 * mobilityStatus.sd;
  const fi = flagDay ? days.indexOf(flagDay) : -1;
  const di = driftDay ? days.indexOf(driftDay) : -1;
  const c = new Map((carer ?? []).map((x) => [x.day, x]));
  // Days since her last rest day in view (or since the start of the window).
  const lastRest = days.reduce((at, d, i) => (c.get(d)?.rested ? i : at), -1);
  const noRestFrom = carer ? lastRest + 1 : -1;
  const noRestDays = days.length - noRestFrom;

  return (
    <figure className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Care timeline, last ${days.length} days${flagDay ? `; Teman noticed a change on ${fmtDay(flagDay)}` : ""}`}>
        {/* When the change began, up to today */}
        {di >= 0 && <rect x={LABEL + di * COL} y={TOP - 4} width={(days.length - di) * COL} height={lanes * LANE + 8} rx={6} fill={DRIFT} opacity={0.55} />}
        {["Eating", "Standing", "Notes", ...(carer ? [carerName] : [])].map((label, k) => (
          <g key={label}>
            <line x1={LABEL} x2={W - 6} y1={laneY(k)} y2={laneY(k)} stroke={TRACK} strokeWidth={1.5} />
            <text x={0} y={laneY(k) + 4} fontSize={11} fontWeight={700} fill={MUTED}>{label}</text>
          </g>
        ))}

        {days.map((d, i) => {
          const mv = m.get(d), sv = s.get(d), dayNotes = n.get(d) ?? [];
          const concern = dayNotes.some((x) => x.concerns.length);
          const cd = c.get(d);
          const lowMood = !!cd && cd.mood <= 2.5;
          return (
            <g key={d}>
              {mv != null && (
                <g>
                  <title>{`${fmtDay(d)} · ${showValues ? `ate ${Math.round(mv)}%` : low(mv) ? "ate less than her usual" : "ate like her usual"}`}</title>
                  {/* plate: rim plus food filled to how much she ate */}
                  <circle cx={x(i)} cy={laneY(0)} r={5.2} fill="#fff" stroke={low(mv) ? AMBER : BRAND} strokeWidth={low(mv) ? 2.2 : 1.4} />
                  <circle cx={x(i)} cy={laneY(0)} r={Math.max(1, 3.6 * Math.sqrt(mv / 100))} fill={low(mv) ? AMBER : BRAND} />
                </g>
              )}
              {sv != null && (
                <g>
                  <title>{`${fmtDay(d)} · ${showValues ? `5× sit-to-stand ${sv.toFixed(1)} s` : slow(sv) ? "stood up slower than her usual" : "stood up like her usual"}`}</title>
                  <Figure cx={x(i)} cy={laneY(1)} color={slow(sv) ? AMBER_TEXT : BRAND} bg={slow(sv) ? AMBER : MIST} />
                </g>
              )}
              {dayNotes.length > 0 && (
                <g>
                  <title>{`${fmtDay(d)} · ${dayNotes.map((x) => (showValues ? `“${x.text}”` : "") + (x.concerns.length ? ` [${x.concerns.join(", ")}]` : "")).join(" ").trim() || "note"}`}</title>
                  <path
                    d={`M${x(i) - 5.5} ${laneY(2) - 5}h11a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-6l-3.5 3v-3h-1.5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2z`}
                    fill={concern ? AMBER : "#fff"}
                    stroke={concern ? AMBER_TEXT : BRAND}
                    strokeWidth={1.3}
                  />
                </g>
              )}
              {cd && (
                <g>
                  <title>{`${fmtDay(d)} · ${carerName} ${cd.rested ? "had a rest day" : lowMood ? "felt tired or low, no rest" : "felt OK, no rest"}`}</title>
                  {cd.rested ? (
                    <>
                      <circle cx={x(i)} cy={laneY(3)} r={5.6} fill={ROSE} />
                      <path d={`M${x(i) - 2.6} ${laneY(3)}l1.8 1.9 3.4-3.6`} stroke="#fff" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </>
                  ) : (
                    <circle cx={x(i)} cy={laneY(3)} r={4.2} fill={lowMood ? ROSE_SOFT : "#fff"} stroke={lowMood ? ROSE : MUTED} strokeWidth={lowMood ? 1.8 : 1.1} />
                  )}
                </g>
              )}
            </g>
          );
        })}

        {/* The stretch without a rest day, under the carer lane. */}
        {carer && noRestDays >= 7 && (
          <g>
            <title>{`${carerName}: no rest day for ${noRestDays} days in view`}</title>
            <rect x={LABEL + noRestFrom * COL + 2} y={laneY(3) + 8} width={noRestDays * COL - 4} height={3} rx={1.5} fill={ROSE} />
          </g>
        )}

        {fi >= 0 && (
          <g>
            <line x1={x(fi)} x2={x(fi)} y1={TOP - 8} y2={TOP + lanes * LANE + 4} stroke={AMBER_TEXT} strokeWidth={1.6} strokeDasharray="4 3" />
            <text x={Math.min(x(fi), W - 90)} y={10} fontSize={10.5} fontWeight={800} fill={AMBER_TEXT} textAnchor={x(fi) > W - 90 ? "start" : "middle"}>
              Teman noticed · {fmtDay(days[fi], { weekday: false })}
            </text>
          </g>
        )}
        <text x={LABEL} y={H - 4} fontSize={10.5} fill={MUTED}>{fmtDay(days[0], { weekday: false })}</text>
        <text x={W - 6} y={H - 4} fontSize={10.5} fill={MUTED} textAnchor="end">Today</text>
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-2 border-brand" /> Like her usual</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-turmeric" /> Below her usual / concern noted</span>
        {driftDay && <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded bg-sun-soft" /> Change began {fmtDay(driftDay)}</span>}
        {flagDay && <span className="flex items-center gap-1.5"><span className="h-0 w-5 border-t-2 border-dashed border-sun" /> Teman noticed</span>}
        {carer && <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-rose" /> {carerName}&apos;s rest day</span>}
        {carer && <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-2 border-rose bg-rose-soft" /> Tired or low</span>}
        {carer && noRestDays >= 7 && <span className="flex items-center gap-1.5"><span className="h-[3px] w-5 rounded bg-rose" /> No rest day</span>}
      </figcaption>
    </figure>
  );
}

/** Tiny standing figure. */
function Figure({ cx, cy, color, bg }: { cx: number; cy: number; color: string; bg: string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={6.2} fill={bg} />
      <circle cx={cx} cy={cy - 3.2} r={1.4} fill={color} />
      <path d={`M${cx} ${cy - 1.6}v3.6M${cx - 2.4} ${cy}h4.8M${cx} ${cy + 2}l-1.8 2.6M${cx} ${cy + 2}l1.8 2.6`} stroke={color} strokeWidth={1.2} strokeLinecap="round" fill="none" />
    </g>
  );
}

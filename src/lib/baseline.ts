// Personal-baseline engine: the part judges should hear about.
//
// Each signal is compared with the senior's OWN normal, not a textbook average.
// Baseline = mean and SD of daily values over a 14-day window. The window is
// lagged by LAG_DAYS so a slow decline isn't absorbed into "normal" while it
// happens. A signal is flagged when its 3-day average moves more than
// Z_THRESHOLD standard deviations in the bad direction. Two or more flagged
// signals at once raise a combined alert for the family.

import type { PoolClient } from "pg";
import { pool } from "./db";

export const WINDOW_DAYS = 14;
export const RECENT_DAYS = 3;
export const LAG_DAYS = 7;
export const Z_THRESHOLD = 1.5;
export const MIN_SD: Record<Signal, number> = { meal: 4, mobility: 0.6 };

export type Signal = "meal" | "mobility";
export const SIGNALS: Signal[] = ["meal", "mobility"];
// Which way is "worse": eating less is bad, a slower chair-stand is bad.
const BAD_DIRECTION: Record<Signal, -1 | 1> = { meal: -1, mobility: 1 };

export type DailyPoint = { day: string; value: number };

export type SignalStatus = {
  type: Signal;
  mean: number;
  sd: number;
  recent: number | null;
  z: number | null;
  flagged: boolean;
};

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1));
};

/** Pure function so it can be unit-tested and reused in the seed script. */
export function evaluateSignal(type: Signal, daily: DailyPoint[]): SignalStatus | null {
  // daily is sorted oldest -> newest, one point per day that has data.
  if (daily.length < RECENT_DAYS + 5) return null;
  const recentPts = daily.slice(-RECENT_DAYS);
  const end = daily.length - LAG_DAYS;
  const windowPts = daily.slice(Math.max(0, end - WINDOW_DAYS), end);
  if (windowPts.length < 5) return null;

  const m = mean(windowPts.map((p) => p.value));
  const s = Math.max(sd(windowPts.map((p) => p.value)), MIN_SD[type]);
  const r = mean(recentPts.map((p) => p.value));
  const z = (r - m) / s;
  return { type, mean: m, sd: s, recent: r, z, flagged: z * BAD_DIRECTION[type] > Z_THRESHOLD };
}

type Db = Pick<PoolClient, "query">;

export async function dailySeries(db: Db, seniorId: number, type: Signal): Promise<DailyPoint[]> {
  const { rows } = await db.query(
    `SELECT to_char(created_at AT TIME ZONE 'Asia/Singapore', 'YYYY-MM-DD') AS day, avg(value)::float AS value
       FROM observations
      WHERE senior_id = $1 AND type = $2 AND value IS NOT NULL
      GROUP BY 1 ORDER BY 1`,
    [seniorId, type],
  );
  return rows as DailyPoint[];
}

const ALERT_COPY: Record<string, string> = {
  "meal,mobility":
    "Mum is eating less and standing up more slowly than her usual this week. Consider booking a GP review.",
  meal: "Mum is eating less than her usual over the last few days. Keep an eye on it.",
  mobility: "Mum's chair-stand test is slower than her usual over the last few days. Keep an eye on it.",
};

/** Recompute baselines for a senior and raise at most one alert per day. */
export async function recompute(seniorId: number, db: Db = pool): Promise<SignalStatus[]> {
  const statuses: SignalStatus[] = [];
  for (const type of SIGNALS) {
    const st = evaluateSignal(type, await dailySeries(db, seniorId, type));
    if (!st) continue;
    statuses.push(st);
    await db.query(
      `INSERT INTO baselines (senior_id, type, mean, sd, window_days, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (senior_id, type) DO UPDATE
         SET mean = EXCLUDED.mean, sd = EXCLUDED.sd, window_days = EXCLUDED.window_days, updated_at = now()`,
      [seniorId, type, st.mean, st.sd, WINDOW_DAYS],
    );
  }

  const flagged = statuses.filter((s) => s.flagged).map((s) => s.type).sort();
  if (flagged.length > 0) {
    const { rows } = await db.query(
      `SELECT 1 FROM alerts WHERE senior_id = $1 AND signals = $2::text[]
          AND created_at > now() - interval '1 day'`,
      [seniorId, flagged],
    );
    if (rows.length === 0) {
      await db.query(
        `INSERT INTO alerts (senior_id, signals, severity, message) VALUES ($1, $2, $3, $4)`,
        [seniorId, flagged, flagged.length >= 2 ? "review" : "watch", ALERT_COPY[flagged.join(",")]],
      );
    }
  }
  return statuses;
}

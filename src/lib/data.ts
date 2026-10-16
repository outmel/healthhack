// Read queries shared by the family and GP views.
import { pool, query } from "./db";
import { dailySeries, evaluateSignal, SIGNALS, type DailyPoint, type Signal, type SignalStatus } from "./baseline";

export type Senior = { id: number; name: string; age: number; conditions: string[] };
export type Alert = { id: number; signals: string[]; severity: string; message: string; created_at: string; acknowledged: boolean };
export type VoiceNote = { id: number; original_text: string; translated_text: string | null; created_at: string };

export async function getSenior(household: number): Promise<Senior> {
  const [s] = await query<Senior>(`SELECT id, name, age, conditions FROM seniors WHERE household_id = $1 LIMIT 1`, [household]);
  return s;
}

export async function getSignals(seniorId: number) {
  const out = {} as Record<Signal, { series: DailyPoint[]; status: SignalStatus | null }>;
  for (const t of SIGNALS) {
    const series = await dailySeries(pool, seniorId, t);
    out[t] = { series, status: evaluateSignal(t, series) };
  }
  return out;
}

export const getAlerts = (seniorId: number) =>
  query<Alert>(`SELECT * FROM alerts WHERE senior_id = $1 ORDER BY created_at DESC LIMIT 10`, [seniorId]);

export const getVoiceNotes = (seniorId: number, limit = 10) =>
  query<VoiceNote>(
    `SELECT id, original_text, translated_text, created_at FROM observations
      WHERE senior_id = $1 AND type = 'voice' ORDER BY created_at DESC LIMIT $2`,
    [seniorId, limit],
  );

/** Helper wellbeing: days since last rest day and recent mood. */
export async function getCarerStatus(household: number) {
  const [row] = await query<{ name: string; last_rest: string | null; avg_mood: number | null; first: string }>(
    `SELECT u.name,
            max(c.created_at) FILTER (WHERE c.rested_today) AS last_rest,
            avg(c.mood) FILTER (WHERE c.created_at > now() - interval '7 days')::float AS avg_mood,
            min(c.created_at) AS first
       FROM users u LEFT JOIN carer_checkins c ON c.helper_id = u.id
      WHERE u.household_id = $1 AND u.role = 'helper'
      GROUP BY u.name`,
    [household],
  );
  if (!row) return null;
  const since = row.last_rest ?? row.first;
  const daysWithoutRest = since ? Math.floor((Date.now() - new Date(since).getTime()) / 86_400_000) : 0;
  return {
    name: row.name,
    daysWithoutRest,
    avgMood: row.avg_mood,
    needsNudge: daysWithoutRest >= 14 || (row.avg_mood ?? 5) <= 2.5,
  };
}

/** Shape saved by the n8n workflow's "Parse and check" node. */
export type Analysis = {
  urgency: "routine" | "review_soon" | "urgent";
  generated_at: string;
  analysis: {
    headline?: string;
    gp_summary?: string;
    symptom_tags?: { tag: string; count: number; dates: string[] }[];
    worth_reviewing?: string[];
    red_flags?: string[];
    family_message?: string;
    helper_message?: string;
    helper_message_en?: string;
    carer_wellbeing?: string;
    parse_error?: boolean;
  };
};

export async function getLatestAnalysis(seniorId: number): Promise<Analysis | null> {
  const [row] = await query<{ result: Analysis }>(
    `SELECT result FROM ai_analyses WHERE senior_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [seniorId],
  );
  return row?.result ?? null;
}

/** Which of the helper's daily actions are already done today (Singapore date). */
export async function getToday(seniorId: number, helperId: number) {
  const rows = await query<{ type: string }>(
    `SELECT DISTINCT type FROM observations
      WHERE senior_id = $1 AND (created_at AT TIME ZONE 'Asia/Singapore')::date = (now() AT TIME ZONE 'Asia/Singapore')::date
     UNION
     SELECT 'checkin' FROM carer_checkins
      WHERE helper_id = $2 AND (created_at AT TIME ZONE 'Asia/Singapore')::date = (now() AT TIME ZONE 'Asia/Singapore')::date`,
    [seniorId, helperId],
  );
  const has = (t: string) => rows.some((r) => r.type === t);
  return { meal: has("meal"), stand: has("mobility"), voice: has("voice"), checkin: has("checkin") };
}

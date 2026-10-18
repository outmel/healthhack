// Read queries shared by the family and GP views.
import { pool, query } from "./db";
import { baselineWindow, dailySeries, evaluateSignal, leadTime, SIGNALS, type DailyPoint, type Signal, type SignalStatus } from "./baseline";
import type { Track } from "./pose";

export type Senior = { id: number; name: string; age: number; household_id: number; conditions: string[]; medications: string[] };
export type Alert = {
  id: number; signals: string[]; severity: string; message: string; created_at: string; acknowledged: boolean;
  gp_review_at: string | null;
};
export type VoiceNote = { id: number; original_text: string; translated_text: string | null; created_at: string; concerns: string[]; lang: string };

/** "translated from Indonesian", named from the note's own language (never just "Bahasa"). */
export const LANG_EN: Record<string, string> = { id: "Indonesian", tl: "Tagalog", en: "English" };
export const translatedFrom = (lang: string) =>
  lang === "en" ? "written in English" : `translated from ${LANG_EN[lang] ?? "her language"}`;

export async function getSenior(household: number): Promise<Senior> {
  return getSeniorById(household, "household_id");
}

export async function getSeniorById(id: number, col: "id" | "household_id" = "id"): Promise<Senior> {
  const [s] = await query<Senior>(`SELECT id, name, age, household_id, conditions, medications FROM seniors WHERE ${col} = $1 LIMIT 1`, [id]);
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
    `SELECT id, original_text, translated_text, created_at, COALESCE(meta->>'lang', 'id') AS lang,
            COALESCE(ARRAY(SELECT jsonb_array_elements_text(meta->'concerns')), '{}') AS concerns
       FROM observations
      WHERE senior_id = $1 AND type = 'voice' ORDER BY created_at DESC LIMIT $2`,
    [seniorId, limit],
  );

/** Day (Singapore) of a timestamp, as YYYY-MM-DD. */
export const sgDay = (d: string | Date) => new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });

/** When the change began, was flagged, and the family was alerted. Dates come from the data, never typed. */
export function getLeadTime(signals: Awaited<ReturnType<typeof getSignals>>) {
  return leadTime({ meal: signals.meal.series, mobility: signals.mobility.series });
}

export type StandTest = { day: string; seconds: number; findings: string[]; hand_reps: number[] };

/** Every chair-stand with what the camera noticed (for the hand markers on the GP chart). */
export const getStandTests = (seniorId: number) =>
  query<StandTest>(
    `SELECT to_char(created_at AT TIME ZONE 'Asia/Singapore', 'YYYY-MM-DD') AS day, value AS seconds,
            COALESCE(ARRAY(SELECT jsonb_array_elements_text(meta->'findings')), '{}') AS findings,
            COALESCE(ARRAY(SELECT jsonb_array_elements_text(meta->'hand_reps'))::int[], '{}') AS hand_reps
       FROM observations WHERE senior_id = $1 AND type = 'mobility' AND value IS NOT NULL ORDER BY created_at`,
    [seniorId],
  );

export type StandClip = { day: string; seconds: number; track: Track; findings: string[]; hand_reps: number[] };

async function clipOn(seniorId: number, where: string, params: unknown[]): Promise<StandClip | null> {
  const [row] = await query<StandClip>(
    `SELECT to_char(created_at AT TIME ZONE 'Asia/Singapore', 'YYYY-MM-DD') AS day, value AS seconds,
            meta->'landmarks' AS track,
            COALESCE(ARRAY(SELECT jsonb_array_elements_text(meta->'findings')), '{}') AS findings,
            COALESCE(ARRAY(SELECT jsonb_array_elements_text(meta->'hand_reps'))::int[], '{}') AS hand_reps
       FROM observations
      WHERE senior_id = $1 AND type = 'mobility' AND meta ? 'landmarks' AND ${where}
      ORDER BY created_at DESC LIMIT 1`,
    [seniorId, ...params],
  );
  return row ?? null;
}

/**
 * "Then vs now" replay. Then = the test closest to the middle of her baseline window (the days
 * evaluateSignal treats as her usual), so it's a typical day, not an outlier. Now = the latest test.
 */
export async function getStandComparison(seniorId: number, series?: DailyPoint[]) {
  const daily = series ?? (await dailySeries(pool, seniorId, "mobility"));
  const now = await clipOn(seniorId, "true", []);
  const window = baselineWindow(daily);
  if (!now || !window.length) return null;
  const mid = window[Math.floor(window.length / 2)].day;
  const then =
    (await clipOn(seniorId, `to_char(created_at AT TIME ZONE 'Asia/Singapore', 'YYYY-MM-DD') = $2`, [mid])) ??
    (await clipOn(seniorId, `to_char(created_at AT TIME ZONE 'Asia/Singapore', 'YYYY-MM-DD') <= $2`, [mid]));
  if (!then || then.day === now.day) return null;
  return { then, now };
}
export type StandComparison = NonNullable<Awaited<ReturnType<typeof getStandComparison>>>;

/** The next rest day the family has given the helper (today or later). */
export async function getRestDay(household: number) {
  const [row] = await query<{ day: string; set_by: string }>(
    `SELECT to_char(r.day, 'YYYY-MM-DD') AS day, s.name AS set_by
       FROM rest_days r JOIN users h ON h.id = r.helper_id JOIN users s ON s.id = r.set_by
      WHERE h.household_id = $1 AND r.day >= (now() AT TIME ZONE 'Asia/Singapore')::date
      ORDER BY r.day LIMIT 1`,
    [household],
  );
  return row ?? null;
}

/** The helper's language, for labelling her notes and translating messages to her. */
export async function getHelper(household: number) {
  const [row] = await query<{ id: number; name: string; language: string }>(
    `SELECT id, name, language FROM users WHERE household_id = $1 AND role = 'helper' LIMIT 1`,
    [household],
  );
  return row ?? null;
}

export type Message = { id: number; from_name: string; original_text: string; translated_text: string | null; lang: string; created_at: string };

/** The family's messages to the helper from the last week (newest first). */
export const getMessages = (helperId: number, limit = 3) =>
  query<Message>(
    `SELECT m.id, u.name AS from_name, m.original_text, m.translated_text, m.lang, m.created_at
       FROM messages m JOIN users u ON u.id = m.from_user
      WHERE m.to_user = $1 AND m.created_at > now() - interval '7 days'
      ORDER BY m.created_at DESC LIMIT $2`,
    [helperId, limit],
  );

/** Names of the family member and GP, for "Rachel and Dr Lim can now see this". */
export async function getCircle(household: number) {
  const rows = await query<{ role: string; name: string }>(`SELECT role, name FROM users WHERE household_id = $1`, [household]);
  return { family: rows.find((r) => r.role === "family")?.name ?? "Family", gp: rows.find((r) => r.role === "gp")?.name ?? "the GP" };
}

/** Helper's checks (meals, stands, notes) this calendar month, Singapore time. */
export async function getChecksThisMonth(seniorId: number) {
  const [row] = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM observations
      WHERE senior_id = $1
        AND date_trunc('month', created_at AT TIME ZONE 'Asia/Singapore') = date_trunc('month', now() AT TIME ZONE 'Asia/Singapore')`,
    [seniorId],
  );
  return row?.n ?? 0;
}

/**
 * Helper wellbeing: days since last rest day and recent mood.
 * Days are counted in Singapore calendar days (today minus the rest day's date), the same rule as
 * the n8n "Compute baseline stats" node, so the card and the AI text never disagree by one.
 */
export async function getCarerStatus(household: number) {
  const [row] = await query<{ name: string; days_without_rest: number | null; avg_mood: number | null }>(
    `SELECT u.name,
            (now() AT TIME ZONE 'Asia/Singapore')::date
              - (COALESCE(max(c.created_at) FILTER (WHERE c.rested_today), min(c.created_at)) AT TIME ZONE 'Asia/Singapore')::date
              AS days_without_rest,
            avg(c.mood) FILTER (WHERE c.created_at > now() - interval '7 days')::float AS avg_mood
       FROM users u LEFT JOIN carer_checkins c ON c.helper_id = u.id
      WHERE u.household_id = $1 AND u.role = 'helper'
      GROUP BY u.name`,
    [household],
  );
  if (!row) return null;
  const daysWithoutRest = row.days_without_rest ?? 0;
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
  /** "prepared" = the ready-made summary saved by the demo seed; absent = a live n8n run. */
  source?: "prepared";
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
  /** From the "Healthcare advisor agent"; resources are vetted in code, never model-written. */
  care_plan?: {
    focus_areas?: { area: string; why?: string; family_actions?: string[]; helper_actions?: string[] }[];
    gp_checks?: string[];
    escalation?: { see_gp: "now" | "within_3_days" | "next_routine_visit"; call_995_if: string[] };
    helper_care_tips?: string;
    helper_care_tips_en?: string;
    resources?: { id: string; name: string; contact: string; why: string }[];
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

export type CarerDay = { day: string; mood: number; rested: boolean };

/** The helper's evening check-ins by Singapore day, for the carer lane on the care timeline. */
export const getCarerDays = (household: number) =>
  query<CarerDay>(
    `SELECT to_char(c.created_at AT TIME ZONE 'Asia/Singapore', 'YYYY-MM-DD') AS day,
            avg(c.mood)::float AS mood, bool_or(c.rested_today) AS rested
       FROM carer_checkins c JOIN users u ON u.id = c.helper_id
      WHERE u.household_id = $1 AND u.role = 'helper'
      GROUP BY 1 ORDER BY 1`,
    [household],
  );

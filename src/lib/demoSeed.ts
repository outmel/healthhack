// Resets the database to the Mdm Tan demo story. Used by `npm run seed`, the "Reset demo" button
// on the login page (POST /api/demo/reset) and the first sign-in of each day (see ensureFreshDemo).
//
// 28-day story, day 28 = today (Singapore time):
//   Days 1-20: stable. Eats 75-90% of meals, chair-stand 14-16 s.
//   Day 21+:   intake drifts to 50-60%, chair-stand to 19-21 s, Siti's notes mention "pusing".
//              The drift ramps in over 3 days, so the change begins (day 21) a day before
//              Teman flags it, and the flag comes days before Siti's most worrying note.
//   Siti has had no rest day since day 8.
//   Every chair-stand carries a landmark track for the "then vs now" replay: the normal clip
//   until the drift is under way, then the slow clip (pushing up with her hands on reps 3-5).
// Today's lunch and today's chair-stand are left out so the live demo can add them.
// One ready-made analysis is saved to ai_analyses, so all three views look complete even
// when the n8n workflow is down. A live "Re-analyse with AI" replaces it.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PoolClient } from "pg";
import { hashPassword } from "./password";
// Only the demo household is reset; households people signed up for are never touched.
import { DEMO_HOUSEHOLD } from "./demo";
import { recompute, evaluateSignal, dailySeries, leadTime, SIGNALS, type SignalStatus } from "./baseline";
import { retime, type Track } from "./pose";
import normalFixture from "../../scripts/fixtures/stand-normal.json";
import slowFixture from "../../scripts/fixtures/stand-slow.json";
import type { Analysis } from "./data";

type Fixture = { rep_times: number[]; hand_reps: number[]; findings: string[]; track: Track };
const NORMAL = normalFixture as unknown as Fixture;
const SLOW = slowFixture as unknown as Fixture;

const DAYS = 28;
const DRIFT_FROM = 21;
const NO_REST_FROM = 8;
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "teman2026";

type Db = Pick<PoolClient, "query">;

/** Today's date in Singapore, YYYY-MM-DD. */
const sgToday = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);

/** Timestamp for day d (1..28) at hh:mm Singapore time. */
function at(d: number, hh: number, mm = 0) {
  const sgNow = new Date(Date.now() + 8 * 3600_000);
  const y = sgNow.getUTCFullYear(), mo = sgNow.getUTCMonth(), da = sgNow.getUTCDate();
  return new Date(Date.UTC(y, mo, da - (DAYS - d), hh - 8, mm));
}
const dayOf = (d: number) => at(d, 12).toISOString().slice(0, 10);

// concerns = what translateNote returns for these notes, so the GP view shows the same tags live.
const VOICE_NOTES: { day: number; id: string; en: string; concerns?: string[] }[] = [
  { day: 3, id: "Ibu makan bubur habis, jalan pagi di koridor 10 menit.", en: "Ma'am finished her porridge and walked in the corridor for 10 minutes this morning." },
  { day: 9, id: "Ibu senang, cucu datang berkunjung. Makan siang banyak.", en: "Ma'am was happy, her grandchild visited. She ate a big lunch." },
  { day: 15, id: "Tidur siang agak lama hari ini, tapi makan normal.", en: "She napped a bit longer today, but ate normally." },
  { day: 21, id: "Ibu bilang tidak lapar, makan siang hanya setengah.", en: "Ma'am said she wasn't hungry and only ate half her lunch.", concerns: ["reduced appetite"] },
  { day: 23, id: "Ibu bilang pusing waktu bangun dari kursi. Saya pegang tangannya.", en: "Ma'am said she felt dizzy when getting up from the chair. I held her hand.", concerns: ["dizziness on standing"] },
  { day: 25, id: "Masih pusing pagi ini. Minum air sedikit sekali.", en: "Still dizzy this morning. She drank very little water.", concerns: ["dizziness", "low fluid intake"] },
  { day: 27, id: "Ibu pelan sekali waktu berdiri, pegang meja. Makan malam sedikit.", en: "She stood up very slowly, holding the table. Ate little dinner.", concerns: ["slow to stand", "needs support to stand", "reduced appetite"] },
];

/**
 * Wipes and reseeds the demo household inside one transaction, so other requests see either the old
 * story or the new one, never half of each. An advisory lock stops two resets racing.
 */
export async function seedDemo(db: Db, log: (...a: unknown[]) => void = () => {}, { onlyIfStale = false } = {}) {
  // Deterministic PRNG so every reset produces the same charts.
  let seed = 42;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
  const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
  const round1 = (x: number) => Math.round(x * 10) / 10;

  await db.query("BEGIN");
  try {
    await db.query("SELECT pg_advisory_xact_lock(4242)");
    // Another request may have refreshed it while we waited for the lock.
    if (onlyIfStale && (await isFresh(db))) {
      await db.query("COMMIT");
      return { combinedAlert: true, skipped: true };
    }
    await db.query(readFileSync(join(process.cwd(), "db/schema.sql"), "utf8"));
    // Deleting the senior and users cascades to everything else in the household.
    await db.query(`DELETE FROM seniors WHERE household_id = $1`, [DEMO_HOUSEHOLD]);
    await db.query(`DELETE FROM users WHERE household_id = $1`, [DEMO_HOUSEHOLD]);

    const pw = hashPassword(DEMO_PASSWORD);
    const { rows: users } = await db.query(
      `INSERT INTO users (email, password_hash, name, role, language, household_id) VALUES
         ('siti@teman.demo',   $1, 'Siti',     'helper', 'id', $2),
         ('rachel@teman.demo', $1, 'Rachel',   'family', 'en', $2),
         ('drlim@teman.demo',  $1, 'Dr Lim',   'gp',     'en', $2)
       RETURNING id, role`,
      [pw, DEMO_HOUSEHOLD],
    );
    const sitiId = users.find((u) => u.role === "helper").id;
    const { rows: [senior] } = await db.query(
      `INSERT INTO seniors (name, age, household_id, conditions, medications)
       VALUES ('Mdm Tan', 82, $1, ARRAY['Mild hypertension'], ARRAY['Amlodipine 5 mg once daily']) RETURNING id`,
      [DEMO_HOUSEHOLD],
    );

    // Collected and inserted in one statement per table: a reset is a handful of round trips.
    const obs: { type: string; value: number | null; meta: object; created_at: Date; original_text?: string; translated_text?: string }[] = [];
    const checkins: { mood: number; rested_today: boolean; created_at: Date }[] = [];

    for (let d = 1; d <= DAYS; d++) {
      // 0 before day 21, then 1/3, 2/3, 1: a decline that builds over a few days.
      const drift = d < DRIFT_FROM ? 0 : Math.min(1, (d - DRIFT_FROM + 1) / 3);
      const mix = (normal: [number, number], drifted: [number, number]) => (1 - drift) * between(...normal) + drift * between(...drifted);
      const isToday = d === DAYS;

      // Meals: lunch and dinner. Today's lunch comes from the live demo.
      for (const [hh, label] of [[12, "lunch"], [18, "dinner"]] as const) {
        if (isToday) continue;
        const pct = mix([75, 90], [50, 60]);
        obs.push({ type: "meal", value: Math.round(pct), meta: { meal: label, confidence: "seeded" }, created_at: at(d, hh, 30) });
      }

      // Chair-stand: one per day, morning. Today's comes from the live demo.
      if (!isToday) {
        const secs = round1(mix([14, 16], [19, 21]));
        // Stretch the clip so the replay lasts exactly as long as this day's time.
        const clip = drift >= 0.5 ? SLOW : NORMAL;
        const k = secs / clip.rep_times[clip.rep_times.length - 1];
        const meta = {
          reps: 5,
          method: "seeded",
          findings: clip.findings,
          hand_reps: clip.hand_reps,
          rep_times: clip.rep_times.map((x) => round1(x * k)),
          landmarks: retime(clip.track, secs),
        };
        obs.push({ type: "mobility", value: secs, meta, created_at: at(d, 9, 15) });
      }

      // Carer check-in every evening. Today's is left for the live demo.
      const rested = d < NO_REST_FROM && d % 7 === 0;
      const mood = d < NO_REST_FROM ? 4 : d < 20 ? 3 : 2 + Math.round(rand());
      if (!isToday) checkins.push({ mood, rested_today: rested, created_at: at(d, 21) });
    }

    for (const n of VOICE_NOTES) {
      obs.push({ type: "voice", value: null, original_text: n.id, translated_text: n.en, meta: { lang: "id", concerns: n.concerns ?? [] }, created_at: at(n.day, 16) });
    }

    await db.query(
      `INSERT INTO observations (senior_id, type, value, meta, original_text, translated_text, created_at)
       SELECT $1, type, value, meta, original_text, translated_text, created_at
         FROM jsonb_to_recordset($2::jsonb)
           AS x(type text, value real, meta jsonb, original_text text, translated_text text, created_at timestamptz)`,
      [senior.id, JSON.stringify(obs)],
    );
    await db.query(
      `INSERT INTO carer_checkins (helper_id, mood, rested_today, created_at)
       SELECT $1, mood, rested_today, created_at FROM jsonb_to_recordset($2::jsonb) AS x(mood int, rested_today boolean, created_at timestamptz)`,
      [sitiId, JSON.stringify(checkins)],
    );

    // Run the real engine so seeded baselines/alerts match what the app computes.
    const statuses = {} as Record<(typeof SIGNALS)[number], SignalStatus | null>;
    for (const t of SIGNALS) {
      const st = evaluateSignal(t, await dailySeries(db, senior.id, t));
      statuses[t] = st;
      log(
        `${t.padEnd(8)} baseline ${st?.mean.toFixed(1)} ± ${st?.sd.toFixed(1)}  recent ${st?.recent?.toFixed(1)}  z ${st?.z?.toFixed(2)}  ${st?.flagged ? "FLAGGED" : "ok"}`,
      );
    }
    const series = { meal: await dailySeries(db, senior.id, "meal"), mobility: await dailySeries(db, senior.id, "mobility") };
    const lt = leadTime(series);
    log(`lead time: change began ${lt.driftStart} · flagged ${lt.flagged} · family alerted ${lt.alerted}`);
    await recompute(senior.id, db);
    // The engine runs "now"; date the seeded alert to the evening it would have fired.
    if (lt.alerted) {
      await db.query(
        `UPDATE alerts SET created_at = ($1::date + time '20:00') AT TIME ZONE 'Asia/Singapore'
          WHERE senior_id = $2 AND array_length(signals, 1) >= 2`,
        [lt.alerted, senior.id],
      );
    }

    const analysis = readyMadeAnalysis(statuses, lt.driftStart);
    await db.query(`INSERT INTO ai_analyses (senior_id, urgency, result) VALUES ($1, $2, $3)`, [senior.id, analysis.urgency, analysis]);
    await db.query(`INSERT INTO demo_meta (seeded_on) VALUES ($1)`, [sgToday()]);

    const { rows: alerts } = await db.query(`SELECT signals, severity, created_at FROM alerts WHERE senior_id = $1`, [senior.id]);
    log("alerts:", alerts);
    await db.query("COMMIT");
    return { combinedAlert: alerts.some((a) => a.signals.length >= 2) };
  } catch (e) {
    await db.query("ROLLBACK").catch(() => {});
    throw e;
  }
}

/**
 * The first request of a new Singapore day re-seeds, so dates ("This week", "Last update",
 * days without rest) always line up with today. Set DEMO_AUTO_RESET=off to disable.
 */
export async function ensureFreshDemo(db: Db) {
  if (process.env.DEMO_AUTO_RESET === "off") return false;
  if (await isFresh(db)) return false;
  await seedDemo(db, undefined, { onlyIfStale: true });
  return true;
}

/** Seeded today, and the schema is current (a database from before sign-up has no households table). */
async function isFresh(db: Db) {
  if ((await seededOn(db)) !== sgToday()) return false;
  const { rows: [t] } = await db.query(`SELECT to_regclass('households') IS NOT NULL AS ok`);
  return t.ok as boolean;
}

/** The day the story was last seeded, or null before the first seed with demo_meta. */
async function seededOn(db: Db): Promise<string | null> {
  const { rows: [t] } = await db.query(`SELECT to_regclass('demo_meta') IS NOT NULL AS ok`);
  if (!t.ok) return null;
  const { rows } = await db.query(`SELECT max(seeded_on)::text AS day FROM demo_meta`);
  return rows[0]?.day ?? null;
}

/** Seconds since the last reset (null if never), to stop the Reset button being hammered. */
export async function secondsSinceSeed(db: Db) {
  const { rows: [t] } = await db.query(`SELECT to_regclass('demo_meta') IS NOT NULL AS ok`);
  if (!t.ok) return null;
  const { rows } = await db.query(`SELECT extract(epoch FROM now() - max(created_at))::float AS s FROM demo_meta`);
  return rows[0]?.s ?? null;
}

/**
 * A summary in the same shape the n8n workflow saves, written from the engine's numbers so it
 * matches the charts. Marked source "prepared" so the views don't present it as a live AI run.
 */
function readyMadeAnalysis(st: Record<"meal" | "mobility", SignalStatus | null>, driftStart: string | null): Analysis {
  const r = (x: number | null | undefined) => Math.round(x ?? 0);
  const meal = st.meal, mob = st.mobility;
  const since = driftStart
    ? new Date(`${driftStart}T12:00:00+08:00`).toLocaleDateString("en-SG", { timeZone: "Asia/Singapore", day: "numeric", month: "short" })
    : "last week";
  const tag = (tagName: string, days: number[]) => ({ tag: tagName, count: days.length, dates: days.map(dayOf) });
  return {
    urgency: "review_soon",
    generated_at: new Date().toISOString(),
    source: "prepared",
    analysis: {
      headline: "Eating less and slower to stand for a week, with dizziness on standing",
      gp_summary:
        `Since ${since}, meal intake has averaged ${r(meal?.recent)}% against her usual ${r(meal?.mean)}%, ` +
        `and the 5× sit-to-stand has slowed to ${r(mob?.recent)} s from a usual ${r(mob?.mean)} s, above the 15 s falls-risk cut-off. ` +
        `The camera saw her push up with her hands on reps 3–5. The helper reports dizziness when getting up on 2 days and low fluid intake. ` +
        `She takes amlodipine 5 mg.`,
      symptom_tags: [
        tag("dizziness on standing", [23, 25]),
        tag("reduced appetite", [21, 27]),
        tag("low fluid intake", [25]),
        tag("needs support to stand", [27]),
      ],
      worth_reviewing: [
        "Lying and standing blood pressure: is there a postural drop?",
        "Fluid intake and hydration: are electrolytes or renal function worth checking?",
        "Is the amlodipine dose still right if she is eating and drinking less?",
      ],
      red_flags: [],
      family_message:
        "Mum has been eating less and getting up more slowly for about a week, and she has felt dizzy when standing. " +
        "It's not an emergency, but it's worth a GP visit in the next few days.",
      helper_message:
        "Ibu sedikit pusing waktu berdiri. Minta Ibu duduk sebentar sebelum berdiri, tawarkan air minum sedikit-sedikit, dan tetap di dekatnya saat berjalan.",
      helper_message_en:
        "Ma'am gets a little dizzy when she stands. Ask her to sit for a moment before standing, offer small sips of water often, and stay close when she walks.",
      carer_wellbeing:
        "Siti has been caring for Mum every day for three weeks without a break. A rest day helps her keep noticing the small changes.",
    },
    care_plan: {
      focus_areas: [
        {
          area: "Dizziness and standing up",
          why: "Slower stands, pushing up with her hands and dizziness together raise the chance of a fall.",
          family_actions: ["Book a GP visit this week and bring the 1-page summary.", "Check there's a sturdy chair with arms where she usually sits."],
          helper_actions: ["Sit for a moment before standing.", "Stay close when she walks."],
        },
        {
          area: "Eating and drinking",
          why: "Intake is down by about a third, and she drank very little on some days.",
          family_actions: ["Bring her favourite snacks and soups this week.", "Ask Siti to offer a drink every hour."],
          helper_actions: ["Offer small meals and drinks often."],
        },
      ],
      gp_checks: [
        "Postural blood pressure: is there orthostatic hypotension?",
        "Could amlodipine be contributing to the dizziness?",
        "Is there a reason for the reduced appetite (mouth, mood, infection)?",
      ],
      escalation: { see_gp: "within_3_days", call_995_if: ["she falls or can't get up", "she faints or is hard to wake", "chest pain or breathlessness"] },
      helper_care_tips: "Duduk sebentar sebelum berdiri. Tawarkan minum setiap jam. Tetap di dekat Ibu saat berjalan.",
      helper_care_tips_en: "Sit a moment before standing. Offer a drink every hour. Stay close when she walks.",
      resources: [
        { id: "aic", name: "Agency for Integrated Care (AIC) hotline", contact: "1800 650 6060", why: "Can arrange home care or day care if Mum needs more support." },
        { id: "cde", name: "Centre for Domestic Employees (CDE) helpline", contact: "1800 2255 233", why: "Support for Siti, including rest-day questions." },
      ],
    },
  };
}

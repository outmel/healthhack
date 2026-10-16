// Resets the database to the Mdm Tan demo story. Run before judging: `npm run seed`.
//
// 28-day story, day 28 = today (Singapore time):
//   Days 1-20: stable. Eats 75-90% of meals, chair-stand 14-16 s.
//   Day 21+:   intake drifts to 50-60%, chair-stand to 19-21 s, Siti's notes mention "pusing".
//   Siti has had no rest day since day 8.
// Today's lunch and today's chair-stand are left out so the live demo can add them.

import { readFileSync } from "node:fs";
import { scryptSync, randomBytes } from "node:crypto";
import { Client } from "pg";
import { recompute, evaluateSignal, dailySeries, SIGNALS } from "../src/lib/baseline";

const DAYS = 28;
const DRIFT_FROM = 21;
const NO_REST_FROM = 8;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "teman2026";

// Deterministic PRNG so every reset produces the same charts.
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
const round1 = (x: number) => Math.round(x * 10) / 10;

export function hashPassword(pw: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 32).toString("hex")}`;
}

/** Timestamp for day d (1..28) at hh:mm Singapore time. */
function at(d: number, hh: number, mm = 0) {
  const sgNow = new Date(Date.now() + 8 * 3600_000);
  const y = sgNow.getUTCFullYear(), mo = sgNow.getUTCMonth(), da = sgNow.getUTCDate();
  return new Date(Date.UTC(y, mo, da - (DAYS - d), hh - 8, mm));
}

const VOICE_NOTES: { day: number; id: string; en: string }[] = [
  { day: 3, id: "Ibu makan bubur habis, jalan pagi di koridor 10 menit.", en: "Ma'am finished her porridge and walked in the corridor for 10 minutes this morning." },
  { day: 9, id: "Ibu senang, cucu datang berkunjung. Makan siang banyak.", en: "Ma'am was happy, her grandchild visited. She ate a big lunch." },
  { day: 15, id: "Tidur siang agak lama hari ini, tapi makan normal.", en: "She napped a bit longer today, but ate normally." },
  { day: 21, id: "Ibu bilang tidak lapar, makan siang hanya setengah.", en: "Ma'am said she wasn't hungry and only ate half her lunch." },
  { day: 23, id: "Ibu bilang pusing waktu bangun dari kursi. Saya pegang tangannya.", en: "Ma'am said she felt dizzy when getting up from the chair. I held her hand." },
  { day: 25, id: "Masih pusing pagi ini. Minum air sedikit sekali.", en: "Still dizzy this morning. She drank very little water." },
  { day: 27, id: "Ibu pelan sekali waktu berdiri, pegang meja. Makan malam sedikit.", en: "She stood up very slowly, holding the table. Ate little dinner." },
];

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  await db.query(readFileSync("db/schema.sql", "utf8"));

  const pw = hashPassword(DEMO_PASSWORD);
  const { rows: users } = await db.query(
    `INSERT INTO users (email, password_hash, name, role, language, household_id) VALUES
       ('siti@teman.demo',   $1, 'Siti',     'helper', 'id', 1),
       ('rachel@teman.demo', $1, 'Rachel',   'family', 'en', 1),
       ('drlim@teman.demo',  $1, 'Dr Lim',   'gp',     'en', 1)
     RETURNING id, role`,
    [pw],
  );
  const sitiId = users.find((u) => u.role === "helper").id;
  const { rows: [senior] } = await db.query(
    `INSERT INTO seniors (name, age, household_id, conditions)
     VALUES ('Mdm Tan', 82, 1, ARRAY['Mild hypertension']) RETURNING id`,
  );

  for (let d = 1; d <= DAYS; d++) {
    const drifting = d >= DRIFT_FROM;
    const isToday = d === DAYS;

    // Meals: lunch and dinner. Today's lunch comes from the live demo.
    for (const [hh, label] of [[12, "lunch"], [18, "dinner"]] as const) {
      if (isToday) continue;
      const pct = drifting ? between(50, 60) : between(75, 90);
      await db.query(
        `INSERT INTO observations (senior_id, type, value, meta, created_at) VALUES ($1, 'meal', $2, $3, $4)`,
        [senior.id, Math.round(pct), { meal: label, confidence: "seeded" }, at(d, hh, 30)],
      );
    }

    // Chair-stand: one per day, morning. Today's comes from the live demo.
    if (!isToday) {
      const secs = drifting ? between(19, 21) : between(14, 16);
      await db.query(
        `INSERT INTO observations (senior_id, type, value, meta, created_at) VALUES ($1, 'mobility', $2, $3, $4)`,
        [senior.id, round1(secs), { reps: 5, method: "seeded" }, at(d, 9, 15)],
      );
    }

    // Carer check-in every evening. Today's is left for the live demo.
    const rested = d < NO_REST_FROM && d % 7 === 0;
    const mood = d < NO_REST_FROM ? 4 : d < 20 ? 3 : 2 + Math.round(rand());
    if (!isToday) await db.query(
      `INSERT INTO carer_checkins (helper_id, mood, rested_today, created_at) VALUES ($1, $2, $3, $4)`,
      [sitiId, mood, rested, at(d, 21)],
    );
  }

  for (const n of VOICE_NOTES) {
    await db.query(
      `INSERT INTO observations (senior_id, type, original_text, translated_text, meta, created_at)
       VALUES ($1, 'voice', $2, $3, '{"lang":"id"}', $4)`,
      [senior.id, n.id, n.en, at(n.day, 16)],
    );
  }

  // Run the real engine so seeded baselines/alerts match what the app computes.
  for (const t of SIGNALS) {
    const st = evaluateSignal(t, await dailySeries(db, senior.id, t));
    console.log(
      `${t.padEnd(8)} baseline ${st?.mean.toFixed(1)} ± ${st?.sd.toFixed(1)}  recent ${st?.recent?.toFixed(1)}  z ${st?.z?.toFixed(2)}  ${st?.flagged ? "FLAGGED" : "ok"}`,
    );
  }
  await recompute(senior.id, db);
  const { rows: alerts } = await db.query(`SELECT signals, severity FROM alerts`);
  console.log("alerts:", alerts);
  if (!alerts.some((a) => a.signals.length >= 2)) {
    console.warn("WARNING: seed did not produce a combined alert — the demo story will not land.");
    process.exitCode = 1;
  }
  console.log(`Seeded. Logins: siti@ / rachel@ / drlim@teman.demo, password "${DEMO_PASSWORD}"`);
  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

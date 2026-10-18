// New accounts. "create" starts a household (with the parent being cared for) and returns an invite
// code; "join" adds the helper, family or GP to a household by that code. The demo household has
// no code, so nobody can join it (its accounts are recreated on every reset).
import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "@/lib/db";
import { ensureFreshDemo } from "@/lib/demoSeed";
import { signedIn } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

const account = {
  name: z.string().trim().min(1, "Enter your name").max(60),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")).refine((e) => !e.endsWith("@teman.demo"), "That address is reserved for the demo"),
  password: z.string().min(8, "Use at least 8 characters for your password").max(200),
  role: z.enum(["helper", "family", "gp"]),
  language: z.enum(["id", "tl", "en"]).default("en"),
};
const Body = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("create"),
    ...account,
    senior: z.object({
      name: z.string().trim().min(1, "Enter the name of the person you care for").max(60),
      age: z.coerce.number().int().min(40, "Check their age").max(120, "Check their age"),
      conditions: z.array(z.string().trim().min(1).max(80)).max(10).default([]),
      medications: z.array(z.string().trim().min(1).max(80)).max(10).default([]),
    }),
  }),
  z.object({ mode: z.literal("join"), ...account, code: z.string().trim().toUpperCase().min(1, "Enter the invite code") }),
]);

// No 0/O or 1/I/L, so a code read out over the phone can't be misheard.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the form");
  const b = parsed.data;
  // Only helpers get the app in their own language; the family and GP views are English.
  const language = b.role === "helper" ? b.language : "en";

  const db = await pool.connect();
  try {
    // Creates the tables on a fresh database, like the first login does.
    await ensureFreshDemo(db).catch((e) => console.error("daily demo refresh failed", e));
    await db.query("BEGIN");

    let household: number;
    if (b.mode === "create") {
      // A clash on the code is near impossible but cheap to retry.
      let row: { id: number } | undefined;
      for (let i = 0; !row && i < 5; i++) {
        ({ rows: [row] } = await db.query<{ id: number }>(`INSERT INTO households (code) VALUES ($1) ON CONFLICT (code) DO NOTHING RETURNING id`, [newCode()]));
      }
      if (!row) throw new Error("could not generate a household code");
      household = row.id;
      await db.query(
        `INSERT INTO seniors (name, age, household_id, conditions, medications) VALUES ($1, $2, $3, $4, $5)`,
        [b.senior.name, b.senior.age, household, b.senior.conditions, b.senior.medications],
      );
    } else {
      const { rows: [h] } = await db.query(`SELECT id FROM households WHERE code = $1 FOR UPDATE`, [b.code]);
      if (!h) {
        await db.query("ROLLBACK");
        return fail("No household has that code. Check it with the person who invited you.", 404);
      }
      household = h.id;
      // The helper's app, alerts and rest days all assume one helper per household.
      if (b.role === "helper") {
        const { rows } = await db.query(`SELECT 1 FROM users WHERE household_id = $1 AND role = 'helper'`, [household]);
        if (rows.length) {
          await db.query("ROLLBACK");
          return fail("This household already has a helper.", 409);
        }
      }
    }

    const { rows: [user] } = await db.query(
      `INSERT INTO users (email, password_hash, name, role, language, household_id)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (email) DO NOTHING RETURNING id`,
      [b.email, hashPassword(b.password), b.name, b.role, language, household],
    );
    if (!user) {
      await db.query("ROLLBACK");
      return fail("There's already an account with that email. Sign in instead.", 409);
    }
    await db.query("COMMIT");
    return signedIn({ uid: user.id, role: b.role, name: b.name, lang: language, household });
  } catch (e) {
    await db.query("ROLLBACK").catch(() => {});
    console.error("signup failed", e);
    return fail("Couldn't create your account. Please try again.", 500);
  } finally {
    db.release();
  }
}

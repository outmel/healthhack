import { NextResponse } from "next/server";
import { pool, query } from "@/lib/db";
import { ensureFreshDemo } from "@/lib/demoSeed";
import { verifyPassword } from "@/lib/auth";
import { encodeSession, HOME, SESSION_COOKIE, type Role } from "@/lib/session";

type UserRow = { id: number; name: string; role: Role; language: string; household_id: number; password_hash: string };

export async function POST(req: Request) {
  const { email, password } = await req.json();
  // The story is dated relative to the seed day; the first sign-in of a new day re-dates it.
  const db = await pool.connect();
  await ensureFreshDemo(db).catch((e) => console.error("daily demo refresh failed", e)).finally(() => db.release());
  const [user] = await query<UserRow>(`SELECT * FROM users WHERE email = $1`, [String(email).trim().toLowerCase()]);
  if (!user || !verifyPassword(String(password), user.password_hash)) {
    return NextResponse.json({ error: "Wrong email or password" }, { status: 401 });
  }
  const res = NextResponse.json({ redirect: HOME[user.role] });
  res.cookies.set(
    SESSION_COOKIE,
    encodeSession({ uid: user.id, role: user.role, name: user.name, lang: user.language, household: user.household_id }),
    { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 7 },
  );
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}

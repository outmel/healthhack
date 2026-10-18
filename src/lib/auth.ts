import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { decodeSession, encodeSession, HOME, SESSION_COOKIE, type Role, type Session } from "./session";

export { verifyPassword } from "./password";

/** Response that signs the user in and tells the client where to go. Used by login and signup. */
export function signedIn(s: Session) {
  const res = NextResponse.json({ redirect: HOME[s.role] });
  res.cookies.set(SESSION_COOKIE, encodeSession(s), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

export async function getSession(): Promise<Session | null> {
  return decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
}

/** For server components and route handlers: returns the session or redirects to /login. */
export async function requireRole(...roles: Role[]): Promise<Session> {
  const s = await getSession();
  if (!s || (roles.length && !roles.includes(s.role))) redirect("/login");
  return s;
}

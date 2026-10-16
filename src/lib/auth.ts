import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { scryptSync, timingSafeEqual } from "node:crypto";
import { decodeSession, SESSION_COOKIE, type Role, type Session } from "./session";

export function verifyPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const candidate = scryptSync(pw, salt, 32);
  return timingSafeEqual(candidate, Buffer.from(hash, "hex"));
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

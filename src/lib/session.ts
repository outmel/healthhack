// Signed-cookie session. No DB lookups, so proxy.ts can check roles cheaply.
import { createHmac, timingSafeEqual } from "node:crypto";

export type Role = "helper" | "family" | "gp";
export type Session = { uid: number; role: Role; name: string; lang: string; household: number };

export const SESSION_COOKIE = "teman_session";
export const HOME: Record<Role, string> = { helper: "/helper", family: "/family", gp: "/gp" };

const secret = () => process.env.SESSION_SECRET || "dev-only-secret-change-me";
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function encodeSession(s: Session): string {
  const payload = Buffer.from(JSON.stringify(s)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return null;
  }
}

// Read-only GP summary links (/summary/[token]) for the family's share sheet.
// The token is a signed {senior, expiry, nonce}: random per link, expires in 7 days, no table needed.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SUMMARY_DAYS = 7;
const secret = () => process.env.SESSION_SECRET || "dev-only-secret-change-me";
const sign = (payload: string) => createHmac("sha256", `summary:${secret()}`).update(payload).digest("base64url");

export function makeSummaryToken(seniorId: number, now = Date.now()): string {
  const payload = Buffer.from(
    JSON.stringify({ s: seniorId, e: now + SUMMARY_DAYS * 86_400_000, n: randomBytes(6).toString("base64url") }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Senior id if the token is genuine and not expired, else null. */
export function readSummaryToken(token: string, now = Date.now()): { seniorId: number; expires: number } | null {
  const [payload, sig] = decodeURIComponent(token).split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { s, e } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof s === "number" && typeof e === "number" && e > now ? { seniorId: s, expires: e } : null;
  } catch {
    return null;
  }
}

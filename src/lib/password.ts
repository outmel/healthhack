import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** "salt:hash", both hex. */
export function hashPassword(pw: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 32).toString("hex")}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const candidate = scryptSync(pw, salt, 32);
  return timingSafeEqual(candidate, Buffer.from(hash, "hex"));
}

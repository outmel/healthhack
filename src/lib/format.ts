// Date copy shared by server and client views. All days are Singapore dates (YYYY-MM-DD).
export const TZ = "Asia/Singapore";

/** Today's Singapore date as YYYY-MM-DD. */
export const sgToday = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });

/** "Tue 13 Oct" (or "13 Oct" without the weekday) for a YYYY-MM-DD day. */
export function fmtDay(day: string, opts: { weekday?: boolean; locale?: string } = {}) {
  return new Date(`${day}T12:00:00+08:00`).toLocaleDateString(opts.locale ?? "en-SG", {
    timeZone: TZ, day: "numeric", month: "short", ...(opts.weekday !== false && { weekday: "short" }),
  });
}

/** "4 weeks ago" / "3 days ago" between two YYYY-MM-DD days. */
export function agoLabel(day: string, today: string, t: { weeksAgo: string; daysAgo: string } = { weeksAgo: "{n} weeks ago", daysAgo: "{n} days ago" }) {
  const days = Math.round((Date.parse(today) - Date.parse(day)) / 86_400_000);
  return days >= 14 ? t.weeksAgo.replace("{n}", String(Math.round(days / 7))) : t.daysAgo.replace("{n}", String(days));
}

/** The 28 days ending today, oldest first. */
export function lastDays(n: number, today = sgToday()) {
  const end = Date.parse(`${today}T12:00:00+08:00`);
  return Array.from({ length: n }, (_, i) => new Date(end - (n - 1 - i) * 86_400_000).toLocaleDateString("en-CA", { timeZone: TZ }));
}

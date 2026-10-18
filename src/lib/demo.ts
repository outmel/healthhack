// The three demo accounts, shared by the login page and the demo bar. All data is synthetic.
import type { Role } from "./session";

export const DEMO_PASSWORD = "teman2026";
/** Keep in sync with demoSeed.ts (which can't be imported in the browser). */
export const DEMO_HOUSEHOLD = 1;

export const DEMO_USERS: { role: Role; email: string; who: string }[] = [
  { role: "helper", email: "siti@teman.demo", who: "Siti" },
  { role: "family", email: "rachel@teman.demo", who: "Rachel" },
  { role: "gp", email: "drlim@teman.demo", who: "Dr Lim" },
];

/** The guided demo: one step per role, in story order. */
export const TOUR: Record<Role, { step: number; text: string; next?: string }> = {
  helper: { step: 1, text: "As Siti, log today's lunch and the stand test.", next: "See Rachel's alert" },
  family: { step: 2, text: "Rachel sees the alert at the top. Try “Message Siti” too.", next: "See Dr Lim's view" },
  gp: { step: 3, text: "Dr Lim sees the trend charts and the AI summary for the visit." },
};

/** Signs in as a demo user and opens their page. */
export async function signInAs(email: string) {
  const res = await fetch("/api/login", { method: "POST", body: JSON.stringify({ email, password: DEMO_PASSWORD }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "That didn't work. Please try again.");
  window.location.assign(data.redirect);
}

const TOUR_KEY = "teman_tour";
export const tourOn = () => {
  try { return localStorage.getItem(TOUR_KEY) === "1"; } catch { return false; }
};
export const setTour = (on: boolean) => {
  try { if (on) localStorage.setItem(TOUR_KEY, "1"); else localStorage.removeItem(TOUR_KEY); } catch { /* private mode: no tour */ }
};

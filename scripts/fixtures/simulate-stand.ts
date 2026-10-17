// Synthetic side-view chair-stand: 33 MediaPipe-style landmarks per frame.
// Used by the unit tests and, until real clips are recorded, by `npm run fixtures` to make the
// replay tracks. To use a real recording instead, open /helper, run the stand test on the clip
// with ?debug in the URL, press "Download track", and save it over stand-normal/stand-slow.json.
import type { Lm, PoseFrame } from "../../src/lib/pose";

export type SimOptions = {
  /** Seconds from the first rise to the 5th stand. */
  seconds: number;
  reps?: number;
  /** 1-based reps where she pushes up on her knees. */
  handReps?: number[];
  fps?: number;
  noise?: number;
  /** Fraction of frames where the person isn't detected at all. */
  dropout?: number;
  seed?: number;
};

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

export function simulateStand(o: SimOptions): { frames: PoseFrame[]; startMs: number; endMs: number } {
  const { seconds, reps = 5, handReps = [], fps = 30, noise = 0.003, dropout = 0 } = o;
  let seed = o.seed ?? 7;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
  const jitter = () => (rand() - 0.5) * 2 * noise;

  // Rep period P: rise 37%, hold standing 10%, sit 38%, rest seated 15%. 5th stand at 4P + rise.
  const P = seconds / (reps - 1 + 0.37);
  const pre = 1.2, post = 1.2;
  const total = pre + seconds + post;
  const rise = 0.37 * P, hold = 0.1 * P, sit = 0.38 * P;

  /** 0 = seated, 1 = standing; also whether this moment is during rep k's rise. */
  const phaseAt = (t: number): { p: number; risingRep: number | null } => {
    const s = t - pre;
    if (s < 0) return { p: 0, risingRep: null };
    const k = Math.floor(s / P);
    if (k >= reps - 1 && s - (reps - 1) * P >= rise) return { p: 1, risingRep: null };
    const u = s - k * P;
    if (u < rise) return { p: smooth(u / rise), risingRep: k + 1 };
    if (u < rise + hold) return { p: 1, risingRep: null };
    if (u < rise + hold + sit) return { p: 1 - smooth((u - rise - hold) / sit), risingRep: null };
    return { p: 0, risingRep: null };
  };

  const thigh = 0.2, shank = 0.21, trunk = 0.28;
  const ankle = { x: 0.6, y: 0.9 };
  const frames: PoseFrame[] = [];
  for (let i = 0; i <= total * fps; i++) {
    const t = i / fps;
    if (rand() < dropout) {
      frames.push({ t: t * 1000, lm: null });
      continue;
    }
    const { p, risingRep } = phaseAt(t);
    const hands = risingRep != null && handReps.includes(risingRep);
    const knee = { x: ankle.x, y: ankle.y - shank };
    const theta = Math.PI - (Math.PI / 2) * p; // thigh: pointing back (seated) to straight up
    const hip = { x: knee.x + thigh * Math.cos(theta), y: knee.y - thigh * Math.sin(theta) };
    const lean = 0.1 + 0.55 * Math.sin(Math.PI * Math.min(1, p * 1.2)) - 0.1 * p; // forward lean mid-rise
    const shoulder = { x: hip.x + trunk * Math.sin(lean), y: hip.y - trunk * Math.cos(lean) };
    const head = { x: shoulder.x + 0.03 + 0.08 * Math.sin(lean), y: shoulder.y - 0.09 };
    // Arms crossed on the chest, or reaching down to push on the knees.
    const wrist = hands ? { x: knee.x - 0.03, y: knee.y - 0.02 } : { x: shoulder.x + 0.07, y: shoulder.y + 0.05 };
    const elbow = hands
      ? { x: (shoulder.x + wrist.x) / 2 + 0.04, y: (shoulder.y + wrist.y) / 2 }
      : { x: shoulder.x + 0.02, y: shoulder.y + 0.12 };

    const lm: Lm[] = Array.from({ length: 33 }, () => ({ ...head, visibility: 0.9 }));
    // Near side (left) clearly visible, far side (right) a little offset and less certain.
    const put = (l: number, r: number, pt: { x: number; y: number }) => {
      lm[l] = { x: pt.x + jitter(), y: pt.y + jitter(), visibility: 0.95 };
      lm[r] = { x: pt.x + 0.012 + jitter(), y: pt.y + 0.004 + jitter(), visibility: 0.7 };
    };
    lm[0] = { x: head.x + jitter(), y: head.y + jitter(), visibility: 0.99 };
    put(11, 12, shoulder);
    put(13, 14, elbow);
    put(15, 16, wrist);
    put(17, 18, wrist); put(19, 20, wrist); put(21, 22, wrist);
    put(23, 24, hip);
    put(25, 26, knee);
    put(27, 28, ankle);
    put(29, 30, { x: ankle.x - 0.02, y: ankle.y + 0.01 });
    put(31, 32, { x: ankle.x + 0.05, y: ankle.y + 0.01 });
    frames.push({ t: t * 1000, lm });
  }
  return { frames, startMs: pre * 1000, endMs: (pre + seconds) * 1000 };
}

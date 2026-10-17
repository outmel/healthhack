// Chair-stand rep detection from MediaPipe pose landmarks. Pure functions, no browser APIs,
// so the same code runs live on the phone, on the seed fixtures and in unit tests.
//
// Signal: how far the hips are above the knees, in thigh lengths. Seated (side view) the
// thigh is roughly horizontal, so the signal is ~0; standing it is vertical, so ~1. Dividing
// by thigh length makes it independent of how far away the phone is.

export type Lm = { x: number; y: number; visibility?: number };
/** One video frame: t in ms, lm = the 33 MediaPipe pose landmarks (or null if no person seen). */
export type PoseFrame = { t: number; lm: Lm[] | null };

// MediaPipe pose landmark indices.
export const L = {
  nose: 0, lShoulder: 11, rShoulder: 12, lElbow: 13, rElbow: 14, lWrist: 15, rWrist: 16,
  lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnkle: 27, rAnkle: 28,
} as const;

export const SMOOTH_FRAMES = 5;
export const UP_FRACTION = 0.6; // SEATED -> STANDING above 60% of the seated-to-standing range
export const DOWN_FRACTION = 0.3; // back to SEATED below 30%
export const MIN_RANGE = 0.5; // thigh lengths; stops noise counting as a stand before the first real one
export const ONSET_RISE = 0.06; // thigh lengths above seated that marks the start of the first rise
export const FULL_STAND = 0.97; // the 5th rep ends once she is 97% of the way up (or stops rising)
export const TARGET_REPS = 5;
export const MIN_VISIBILITY = 0.5;
export const MAX_DROPPED = 0.3;
// A wrist this close to its knee (in thigh lengths) means she is pushing up on her legs.
// The plan says ~0.15; MediaPipe puts the wrist landmark a little above the hand, so 0.2.
export const HAND_NEAR_KNEE = 0.2;
export const MIN_HAND_REPS = 2;

const dist = (a: Lm, b: Lm) => Math.hypot(a.x - b.x, a.y - b.y);
const visible = (p: Lm | undefined) => !!p && (p.visibility ?? 1) >= MIN_VISIBILITY;

type Side = { hip: Lm; knee: Lm; wrist: Lm | undefined };

/** Hip-above-knee signal and wrist-to-knee distance for one frame, or null if she can't be seen. */
export function measure(lm: Lm[] | null): { signal: number; handNearKnee: boolean } | null {
  if (!lm) return null;
  const sides: Side[] = [];
  if (visible(lm[L.lHip]) && visible(lm[L.lKnee])) sides.push({ hip: lm[L.lHip], knee: lm[L.lKnee], wrist: lm[L.lWrist] });
  if (visible(lm[L.rHip]) && visible(lm[L.rKnee])) sides.push({ hip: lm[L.rHip], knee: lm[L.rKnee], wrist: lm[L.rWrist] });
  if (!sides.length) return null;

  const hipY = sides.reduce((a, s) => a + s.hip.y, 0) / sides.length;
  const kneeY = sides.reduce((a, s) => a + s.knee.y, 0) / sides.length;
  const thigh = sides.reduce((a, s) => a + dist(s.hip, s.knee), 0) / sides.length;
  if (thigh < 1e-3) return null;
  // Either wrist near either knee: in a side view the far wrist is often hidden.
  const handNearKnee = [lm[L.lWrist], lm[L.rWrist]].some(
    (w) => w && (w.visibility ?? 1) >= 0.3 && sides.some((s) => dist(w, s.knee) / thigh <= HAND_NEAR_KNEE),
  );
  // Image y grows downwards, so hips above knees = kneeY - hipY > 0.
  return { signal: (kneeY - hipY) / thigh, handNearKnee };
}

export type RepState = {
  phase: "seated" | "standing";
  reps: number;
  /** Seconds from the first rise to each stand. */
  repTimes: number[];
  /** 1-based reps where she pushed up with her hands. */
  handReps: number[];
  startMs: number | null;
  endMs: number | null;
  frames: number;
  dropped: number;
  lastSignal: number | null;
  done: boolean;
};

/** Incremental counter: feed frames as they arrive (live) or all at once (offline). */
export class RepCounter {
  private window: number[] = [];
  private times: number[] = [];
  private finishing = false;
  private lo = Infinity;
  private hi = -Infinity;
  private riseFrames = 0;
  private riseHands = 0;
  state: RepState = {
    phase: "seated", reps: 0, repTimes: [], handReps: [], startMs: null, endMs: null,
    frames: 0, dropped: 0, lastSignal: null, done: false,
  };

  push(frame: PoseFrame): RepState {
    const s = this.state;
    if (s.done) return s;
    s.frames++;
    const m = measure(frame.lm);
    if (!m) {
      s.dropped++;
      return s;
    }
    this.window.push(m.signal);
    this.times.push(frame.t);
    if (this.window.length > SMOOTH_FRAMES) {
      this.window.shift();
      this.times.shift();
    }
    const prev = s.lastSignal;
    const v = this.window.reduce((a, b) => a + b, 0) / this.window.length;
    s.lastSignal = v;
    if (this.window.length < SMOOTH_FRAMES) return s;
    // The moving average describes the middle of its window, so time events there (no lag).
    const t = this.times[Math.floor(this.times.length / 2)];

    this.lo = Math.min(this.lo, v);
    this.hi = Math.max(this.hi, v, this.lo + MIN_RANGE);
    const range = this.hi - this.lo;
    const up = this.lo + UP_FRACTION * range;
    const down = this.lo + DOWN_FRACTION * range;

    // The 5th stand counts once she is fully up: the clinical test stops at full standing.
    if (this.finishing) {
      if (v >= this.lo + FULL_STAND * range || (prev !== null && v <= prev)) {
        s.endMs = t;
        s.repTimes[s.repTimes.length - 1] = Math.round((t - (s.startMs ?? t)) / 100) / 10;
        s.done = true;
      }
      return s;
    }

    // Time starts when she first begins to rise, not when Start was pressed.
    if (s.reps === 0 && s.phase === "seated") {
      if (s.startMs === null && v > this.lo + ONSET_RISE) s.startMs = t;
      else if (s.startMs !== null && v < this.lo + ONSET_RISE / 2) s.startMs = null;
    }

    if (s.phase === "seated") {
      if (v > down) {
        this.riseFrames++;
        if (m.handNearKnee) this.riseHands++;
      } else {
        this.riseFrames = this.riseHands = 0;
      }
      if (v > up) {
        s.phase = "standing";
        s.reps++;
        const start = s.startMs ?? t;
        s.startMs = start;
        s.repTimes.push(Math.round((t - start) / 100) / 10);
        // Hands stayed near the knees for at least half of the rise.
        if (this.riseFrames > 0 && this.riseHands / this.riseFrames >= 0.5) s.handReps.push(s.reps);
        this.riseFrames = this.riseHands = 0;
        if (s.reps >= TARGET_REPS) this.finishing = true;
      }
    } else if (v < down) {
      s.phase = "seated";
    }
    return s;
  }
}

export type StandResult = {
  reps: number;
  seconds: number | null;
  repTimes: number[];
  handReps: number[];
  findings: string[];
  droppedRatio: number;
  /** False when too many frames had no clear view of hips and knees. */
  clear: boolean;
};

export function summarise(s: RepState): StandResult {
  const droppedRatio = s.frames ? s.dropped / s.frames : 1;
  return {
    reps: s.reps,
    seconds: s.startMs !== null && s.endMs !== null ? Math.round((s.endMs - s.startMs) / 100) / 10 : null,
    repTimes: s.repTimes,
    handReps: s.handReps,
    findings: s.handReps.length >= MIN_HAND_REPS ? ["used_hands"] : [],
    droppedRatio,
    clear: droppedRatio <= MAX_DROPPED,
  };
}

/** Offline: run a whole recording through the counter. */
export function detectReps(frames: PoseFrame[]): StandResult {
  const c = new RepCounter();
  for (const f of frames) c.push(f);
  return summarise(c.state);
}

/** "3–5", "2, 4" or "3" for the finding sentence. */
export function formatReps(reps: number[]): string {
  if (!reps.length) return "";
  const consecutive = reps.every((r, i) => i === 0 || r === reps[i - 1] + 1);
  if (consecutive && reps.length > 2) return `${reps[0]}–${reps[reps.length - 1]}`;
  return reps.join(", ");
}

// ---------------------------------------------------------------------------------------------
// Stored landmark tracks for the "then vs now" replay. Video never leaves the phone; this is
// all that is saved: 13 joints at 10 fps as x,y rounded to 3 decimals (~10-15 KB per test).

export const TRACK_JOINTS = [
  L.nose, L.lShoulder, L.rShoulder, L.lElbow, L.rElbow, L.lWrist, L.rWrist,
  L.lHip, L.rHip, L.lKnee, L.rKnee, L.lAnkle, L.rAnkle,
] as const;
/** Bones as pairs of positions in TRACK_JOINTS. */
export const TRACK_BONES: [number, number][] = [
  [1, 2], [1, 3], [3, 5], [2, 4], [4, 6], [1, 7], [2, 8], [7, 8], [7, 9], [9, 11], [8, 10], [10, 12],
];
export const TRACK_FPS = 10;

export type Track = {
  fps: number;
  /** Width / height of the source video, so the skeleton isn't squashed on replay. */
  aspect: number;
  /** Seconds into the track where the timed test starts and ends (first rise, 5th stand). */
  start: number;
  end: number;
  /** One entry per frame: [x0, y0, x1, y1, ...] for TRACK_JOINTS, or [] if not seen. */
  frames: number[][];
};

const r3 = (x: number) => Math.round(x * 1000) / 1000;

export function compressTrack(frames: PoseFrame[], aspect: number, startMs: number | null, endMs: number | null): Track {
  const out: number[][] = [];
  if (frames.length) {
    const t0 = frames[0].t;
    const step = 1000 / TRACK_FPS;
    let i = 0;
    for (let t = t0; t <= frames[frames.length - 1].t; t += step) {
      while (i < frames.length - 1 && Math.abs(frames[i + 1].t - t) <= Math.abs(frames[i].t - t)) i++;
      const lm = frames[i].lm;
      out.push(lm ? TRACK_JOINTS.flatMap((j) => [r3(lm[j].x), r3(lm[j].y)]) : []);
    }
  }
  const t0 = frames[0]?.t ?? 0;
  return {
    fps: TRACK_FPS,
    aspect: r3(aspect),
    start: startMs === null ? 0 : r3((startMs - t0) / 1000),
    end: endMs === null ? out.length / TRACK_FPS : r3((endMs - t0) / 1000),
    frames: out,
  };
}

/** Back to sparse 33-landmark frames, e.g. to run a stored track through the counter. */
export function expandTrack(track: Track): PoseFrame[] {
  return track.frames.map((f, i) => {
    if (!f.length) return { t: (i * 1000) / track.fps, lm: null };
    const lm: Lm[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }));
    TRACK_JOINTS.forEach((j, k) => (lm[j] = { x: f[2 * k], y: f[2 * k + 1], visibility: 1 }));
    return { t: (i * 1000) / track.fps, lm };
  });
}

/** Stretch a track in time so its timed section lasts `seconds` (used by the seed). */
export function retime(track: Track, seconds: number): Track {
  const k = seconds / Math.max(0.1, track.end - track.start);
  return { ...track, fps: r3(track.fps / k), start: r3(track.start * k), end: r3(track.end * k) };
}

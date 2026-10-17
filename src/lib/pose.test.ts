// node --test: npm test. Clips are synthetic (scripts/fixtures/simulate-stand.ts); the real-clip
// check (6 clips, 2 people x normal/slow/with hands, ±1 s of a stopwatch) is done by hand.
import { test } from "node:test";
import assert from "node:assert/strict";
import { compressTrack, detectReps, expandTrack, formatReps, retime, RepCounter } from "./pose";
import { simulateStand } from "../../scripts/fixtures/simulate-stand";

const cases = [
  { name: "normal", seconds: 15 },
  { name: "slow", seconds: 20 },
  { name: "slow with hands", seconds: 21, handReps: [3, 4, 5] },
  { name: "fast", seconds: 10 },
];

for (const c of cases) {
  test(`counts 5 reps within 1 s: ${c.name}`, () => {
    const { frames } = simulateStand({ ...c, noise: 0.006 });
    const r = detectReps(frames);
    assert.equal(r.reps, 5);
    assert.ok(r.seconds !== null && Math.abs(r.seconds - c.seconds) <= 1, `got ${r.seconds} s`);
    assert.equal(r.clear, true);
    assert.equal(r.repTimes.length, 5);
  });
}

test("arm-push finding needs hands on 2+ reps", () => {
  assert.deepEqual(detectReps(simulateStand({ seconds: 20, handReps: [3, 4, 5] }).frames).handReps, [3, 4, 5]);
  assert.deepEqual(detectReps(simulateStand({ seconds: 20, handReps: [3, 4, 5] }).frames).findings, ["used_hands"]);
  assert.deepEqual(detectReps(simulateStand({ seconds: 20, handReps: [4] }).frames).findings, []);
  assert.deepEqual(detectReps(simulateStand({ seconds: 15 }).frames).findings, []);
});

test("stops after 5 reps even if she keeps going", () => {
  const r = detectReps(simulateStand({ seconds: 20, reps: 7 }).frames);
  assert.equal(r.reps, 5);
});

test("too many unseen frames is reported as unclear", () => {
  const r = detectReps(simulateStand({ seconds: 15, dropout: 0.5 }).frames);
  assert.equal(r.clear, false);
});

test("sitting still counts nothing", () => {
  const c = new RepCounter();
  const seated = simulateStand({ seconds: 15 }).frames[0].lm;
  for (let i = 0; i < 300; i++) c.push({ t: i * 33, lm: seated });
  assert.equal(c.state.reps, 0);
  assert.equal(c.state.startMs, null);
});

test("compressed 10 fps track still counts the same reps", () => {
  const { frames } = simulateStand({ seconds: 20, handReps: [3, 4, 5] });
  const track = compressTrack(frames, 16 / 9, null, null);
  assert.ok(JSON.stringify(track).length < 40_000);
  const r = detectReps(expandTrack(track));
  assert.equal(r.reps, 5);
  assert.ok(Math.abs(r.seconds! - 20) <= 1.2, `got ${r.seconds}`);
});

test("retime stretches the timed section", () => {
  const t = retime({ fps: 10, aspect: 1, start: 1, end: 16, frames: [] }, 20);
  assert.equal(t.end - t.start, 20);
});

test("formatReps", () => {
  assert.equal(formatReps([3, 4, 5]), "3–5");
  assert.equal(formatReps([2, 4]), "2, 4");
});

// node --test: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { baselineWindow, combinedAlertDay, driftStart, evaluateSignal, firstFlag, leadTime, type DailyPoint } from "./baseline";

// 28 days like the seed: stable for 20 days, then a drift from day 21.
const day = (d: number) => `2026-10-${String(d).padStart(2, "0")}`;
const wobble = (d: number) => ((d * 7) % 5) - 2; // deterministic -2..2
const meal: DailyPoint[] = Array.from({ length: 27 }, (_, i) => ({ day: day(i + 1), value: i + 1 >= 21 ? 55 + wobble(i) : 82 + 2 * wobble(i) }));
const stand: DailyPoint[] = Array.from({ length: 27 }, (_, i) => ({ day: day(i + 1), value: i + 1 >= 21 ? 20 + wobble(i) / 4 : 15 + wobble(i) / 4 }));

test("evaluateSignal flags a sustained drift in the bad direction only", () => {
  assert.equal(evaluateSignal("meal", meal)?.flagged, true);
  assert.equal(evaluateSignal("mobility", stand)?.flagged, true);
  // Eating more / standing faster is never flagged.
  const better = meal.map((p, i) => (i >= 20 ? { ...p, value: 98 } : p));
  assert.equal(evaluateSignal("meal", better)?.flagged, false);
});

test("evaluateSignal needs enough data", () => {
  assert.equal(evaluateSignal("meal", meal.slice(0, 7)), null);
});

test("stable data is never flagged", () => {
  const stable = meal.slice(0, 20);
  assert.equal(firstFlag("meal", stable), null);
  assert.equal(driftStart("meal", stable), null);
});

test("firstFlag finds the first evening the engine would have flagged", () => {
  const f = firstFlag("meal", meal);
  assert.ok(f && f >= day(21) && f <= day(23), `flagged ${f}`);
  // and it really is the first: the day before is not flagged
  const i = meal.findIndex((p) => p.day === f);
  assert.equal(evaluateSignal("meal", meal.slice(0, i))?.flagged ?? false, false);
});

test("driftStart lands on the first day outside her usual band", () => {
  assert.equal(driftStart("meal", meal), day(21));
  assert.equal(driftStart("mobility", stand), day(21));
});

test("combined alert day is when both signals are flagged", () => {
  const a = combinedAlertDay({ meal, mobility: stand });
  assert.ok(a);
  assert.ok(a >= firstFlag("meal", meal)! && a >= firstFlag("mobility", stand)!);
  const lt = leadTime({ meal, mobility: stand });
  assert.equal(lt.driftStart, day(21));
  assert.ok(lt.flagged! <= lt.alerted!);
});

test("baselineWindow is 14 days, lagged by 7", () => {
  const w = baselineWindow(meal);
  assert.equal(w.length, 14);
  assert.equal(w[w.length - 1].day, day(20));
});

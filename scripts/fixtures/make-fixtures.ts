// Writes the replay fixtures used by the seed: `npm run fixtures`.
// Runs each clip through the real rep detector so the stored start/end match what the app measures.
import { writeFileSync } from "node:fs";
import { compressTrack, RepCounter, summarise } from "../../src/lib/pose";
import { simulateStand } from "./simulate-stand";

const clips = {
  "stand-normal": { seconds: 15 },
  "stand-slow": { seconds: 20, handReps: [3, 4, 5] },
};

for (const [name, opts] of Object.entries(clips)) {
  const { frames } = simulateStand({ ...opts, seed: name.length });
  const c = new RepCounter();
  for (const f of frames) c.push(f);
  const r = summarise(c.state);
  const track = compressTrack(frames, 16 / 9, c.state.startMs, c.state.endMs);
  const out = { source: "synthetic", reps: r.reps, seconds: r.seconds, rep_times: r.repTimes, hand_reps: r.handReps, findings: r.findings, track };
  writeFileSync(new URL(`./${name}.json`, import.meta.url), JSON.stringify(out) + "\n");
  console.log(`${name}: ${r.reps} reps, ${r.seconds} s, hands on reps [${r.handReps}], ${track.frames.length} frames, ${JSON.stringify(out).length} bytes`);
}

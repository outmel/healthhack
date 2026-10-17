// Serves MediaPipe from our own origin so the pose test doesn't depend on a CDN during judging.
// Runs on `npm install` (postinstall): copies the WASM runtime out of node_modules and
// downloads the pose model once. The browser falls back to jsDelivr if these are missing.
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";

const SRC = "node_modules/@mediapipe/tasks-vision/wasm";
const OUT = "public/mediapipe";
const MODEL = `${OUT}/pose_landmarker_lite.task`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

mkdirSync(`${OUT}/wasm`, { recursive: true });
if (existsSync(SRC)) {
  for (const f of ["vision_wasm_internal.js", "vision_wasm_internal.wasm", "vision_wasm_nosimd_internal.js", "vision_wasm_nosimd_internal.wasm"]) {
    copyFileSync(`${SRC}/${f}`, `${OUT}/wasm/${f}`);
  }
  console.log("mediapipe: copied WASM to public/mediapipe/wasm");
}

if (!existsSync(MODEL)) {
  try {
    const res = await fetch(MODEL_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    writeFileSync(MODEL, Buffer.from(await res.arrayBuffer()));
    console.log("mediapipe: downloaded pose_landmarker_lite.task");
  } catch (e) {
    console.warn("mediapipe: model download failed, the app will use the CDN copy:", e.message);
  }
}

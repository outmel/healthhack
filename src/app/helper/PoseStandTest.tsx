"use client";

// On-device chair-stand: MediaPipe pose runs in the browser, counts the 5 stands, times them and
// notices arm use. The video never leaves the phone; only numbers and a 13-joint track are saved.
import { useEffect, useRef, useState } from "react";
import type { PoseLandmarker as PoseLandmarkerT } from "@mediapipe/tasks-vision";
import { compressTrack, expandTrack, formatReps, RepCounter, summarise, TARGET_REPS, TRACK_BONES, TRACK_JOINTS, type PoseFrame, type Track } from "@/lib/pose";
import type { Dict } from "@/lib/i18n";
import { Camera, Play } from "@/components/icons";

export type PoseResult = {
  seconds: number;
  reps: number;
  findings: string[];
  handReps: number[];
  repTimes: number[];
  track: Track;
};

const MP_VERSION = "1.1.1"; // keep in step with package.json
const SOURCES = [
  { wasm: "/mediapipe/wasm", model: "/mediapipe/pose_landmarker_lite.task" },
  {
    wasm: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`,
    model: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  },
];
const MAX_SECONDS = 60; // give up and offer tapping if 5 stands aren't seen by then
const BRAND = "#1F5C45", CREAM = "#FBF6EC", TURMERIC = "#E8A317";

// One landmarker per page load: our own copy first, CDN second; GPU first, CPU second.
let landmarker: Promise<PoseLandmarkerT> | null = null;
function getLandmarker(): Promise<PoseLandmarkerT> {
  landmarker ??= (async () => {
    const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
    let lastError: unknown;
    for (const src of SOURCES) {
      for (const delegate of ["GPU", "CPU"] as const) {
        try {
          const fileset = await FilesetResolver.forVisionTasks(src.wasm);
          return await PoseLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: src.model, delegate },
            runningMode: "VIDEO",
            numPoses: 1,
          });
        } catch (e) {
          lastError = e;
        }
      }
    }
    landmarker = null;
    throw lastError;
  })();
  return landmarker;
}

type Phase = "intro" | "loading" | "running" | "unclear" | "failed";

export default function PoseStandTest({ t, onResult, onTapInstead }: { t: Dict; onResult: (r: PoseResult) => void; onTapInstead: () => void }) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [reps, setReps] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [pulse, setPulse] = useState(0);
  const [hands, setHands] = useState<number[]>([]);
  const [source, setSource] = useState<"camera" | "file" | "sample">("camera");
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const raf = useRef(0);
  const objectUrl = useRef<string | null>(null);
  const run = useRef<{ counter: RepCounter; frames: PoseFrame[]; t0: number; aspect: number; finished: boolean } | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const stopMedia = () => {
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
    if (video.current) {
      video.current.pause();
      video.current.removeAttribute("src");
      video.current.srcObject = null;
    }
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
  };
  useEffect(() => stopMedia, []);

  function begin(aspect: number) {
    run.current = { counter: new RepCounter(), frames: [], t0: -1, aspect, finished: false };
    setReps(0);
    setElapsed(0);
    setHands([]);
    setPhase("running");
  }

  /** Feed one frame to the counter; finish when 5 stands are seen or time runs out. */
  function onFrame(frame: PoseFrame) {
    const r = run.current;
    if (!r || r.finished) return;
    if (r.t0 < 0) r.t0 = frame.t;
    r.frames.push(frame);
    const before = r.counter.state.reps;
    const st = r.counter.push(frame);
    if (st.reps !== before) {
      setReps(st.reps);
      setPulse((p) => p + 1);
      setHands([...st.handReps]);
    }
    if (st.startMs !== null) setElapsed((frame.t - st.startMs) / 1000);
    if (st.done || (frame.t - r.t0) / 1000 > MAX_SECONDS) finish();
  }

  function finish() {
    const r = run.current;
    if (!r || r.finished) return;
    r.finished = true;
    stopMedia();
    const s = summarise(r.counter.state);
    if (!s.clear || s.reps < TARGET_REPS || s.seconds === null) return setPhase("unclear");
    onResult({
      seconds: s.seconds,
      reps: s.reps,
      findings: s.findings,
      handReps: s.handReps,
      repTimes: s.repTimes,
      track: compressTrack(r.frames, r.aspect, r.counter.state.startMs, r.counter.state.endMs),
    });
  }

  async function startVideo(source: { camera: true } | { file: File }) {
    setSource("camera" in source ? "camera" : "file");
    setPhase("loading");
    let lm: PoseLandmarkerT;
    try {
      lm = await getLandmarker();
      const v = video.current!;
      if ("camera" in source) {
        stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        v.srcObject = stream.current;
      } else {
        objectUrl.current = URL.createObjectURL(source.file);
        v.src = objectUrl.current;
        v.onended = () => finish();
      }
      v.muted = true;
      v.playsInline = true;
      await v.play();
    } catch (e) {
      console.error("pose start failed", e);
      stopMedia();
      return setPhase("failed");
    }
    const v = video.current!;
    const live = "camera" in source;
    begin(v.videoWidth / Math.max(1, v.videoHeight));
    const { DrawingUtils, PoseLandmarker } = await import("@mediapipe/tasks-vision");
    let lastVideoTime = -1;
    let lastTs = 0;
    const tick = () => {
      if (!run.current || run.current.finished) return;
      const c = canvas.current;
      if (v.readyState >= 2 && v.currentTime !== lastVideoTime && c) {
        lastVideoTime = v.currentTime;
        // Recorded video: time by the video's own clock, so slow phones still measure true seconds.
        const t = live ? performance.now() : v.currentTime * 1000;
        const ts = Math.max(lastTs + 1, performance.now());
        lastTs = ts;
        const res = lm.detectForVideo(v, ts);
        const pts = res.landmarks[0];
        if (c.width !== v.videoWidth) {
          c.width = v.videoWidth;
          c.height = v.videoHeight;
        }
        const ctx = c.getContext("2d")!;
        ctx.clearRect(0, 0, c.width, c.height);
        if (pts) {
          const du = new DrawingUtils(ctx);
          const scale = c.width / 360;
          du.drawConnectors(pts, PoseLandmarker.POSE_CONNECTIONS, { color: CREAM, lineWidth: 5 * scale });
          du.drawConnectors(pts, PoseLandmarker.POSE_CONNECTIONS, { color: BRAND, lineWidth: 3 * scale });
          du.drawLandmarks(pts, { color: TURMERIC, radius: 2.5 * scale, lineWidth: 1 });
        }
        onFrame({ t, lm: pts ? pts.map((p) => ({ x: p.x, y: p.y, visibility: p.visibility })) : null });
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }

  /** No camera (judge's laptop): play a recorded landmark track through the same detector. */
  async function startSample() {
    setSource("sample");
    const sample = (await import("../../../scripts/fixtures/stand-slow.json")).default as { track: Track };
    const frames = expandTrack(sample.track);
    begin(sample.track.aspect);
    const t0 = performance.now();
    let i = 0;
    const tick = () => {
      const r = run.current;
      const c = canvas.current;
      if (!r || r.finished || !c) return;
      const now = performance.now() - t0;
      while (i < frames.length && frames[i].t <= now) {
        drawTrackFrame(c, frames[i], sample.track.aspect);
        onFrame(frames[i]);
        i++;
      }
      if (i >= frames.length) return finish();
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }

  const showMedia = phase === "loading" || phase === "running";
  return (
    <div className="flex flex-col gap-3">
      {!showMedia && (
        <>
          {phase === "intro" && (
            <div className="rounded-[22px] bg-paper p-4 text-[17px] leading-snug text-body ring-1 ring-line">
              <p>{t.poseIntro}</p>
              <p className="mt-3 rounded-2xl bg-sun-soft px-3 py-2 font-bold text-sun-deep">⚠ {t.stayClose}</p>
            </div>
          )}
          {phase !== "intro" && (
            <p role="alert" className="rounded-2xl bg-sun-soft p-4 text-[17px] font-bold text-sun-deep">
              {phase === "unclear" ? t.unclear : t.cameraFailed}
            </p>
          )}
          <button className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-lg font-extrabold text-cream hover:bg-brand-dark" onClick={() => startVideo({ camera: true })}>
            <Camera className="h-5 w-5" /> {phase === "intro" ? t.startCamera : t.tryAgain}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button className="min-h-12 rounded-2xl border-2 border-brand bg-paper font-bold text-brand" onClick={() => file.current?.click()}>
              {t.chooseVideo}
            </button>
            <button className="flex min-h-12 items-center justify-center gap-1.5 rounded-2xl border-2 border-brand bg-paper font-bold text-brand" onClick={startSample}>
              <Play className="h-4 w-4" /> {t.useSample}
            </button>
          </div>
          <input
            ref={file}
            type="file"
            accept="video/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) startVideo({ file: f });
            }}
          />
          <button className="min-h-11 self-center font-bold text-brand underline underline-offset-4" onClick={onTapInstead}>
            {t.tapInstead}
          </button>
          <p className="text-center text-sm text-muted">{t.videoStays}</p>
        </>
      )}

      {/* One video + canvas for the whole lifetime, so the stream survives phase changes. */}
      <div className={showMedia ? "relative overflow-hidden rounded-[22px] bg-ink" : "hidden"}>
        <video ref={video} className={source === "sample" ? "hidden" : "block h-auto w-full"} muted playsInline />
        <canvas ref={canvas} className={source === "sample" ? "block h-auto w-full" : "absolute inset-0 h-full w-full"} />
        {phase === "loading" && (
          <p className="flex aspect-video items-center justify-center p-6 text-center text-lg font-bold text-cream">{t.loadingCamera}</p>
        )}
        {phase === "running" && (
          <div className="absolute inset-x-0 top-0 flex items-start justify-between bg-gradient-to-b from-ink/70 to-transparent p-3 text-cream">
            <span className="text-4xl font-extrabold tabular-nums">{elapsed.toFixed(1)}<span className="text-lg"> s</span></span>
            <span className="flex gap-1.5" aria-label={`${reps} / 5`}>
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i === reps - 1 ? `p${pulse}` : i}
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold ${i < reps ? `bg-turmeric text-sun-deep ${i === reps - 1 ? "rep-pulse" : ""}` : "bg-white/25"}`}
                >
                  {i + 1}
                </span>
              ))}
            </span>
          </div>
        )}
      </div>
      {phase === "running" && (
        <>
          <p className="text-center text-[17px] font-bold" aria-live="polite">
            {hands.length >= 2 ? t.usedHands.replace("{reps}", formatReps(hands)) : t.watching}
          </p>
          <button
            className="min-h-11 self-center font-bold text-brand underline underline-offset-4"
            onClick={() => {
              if (run.current) run.current.finished = true;
              stopMedia();
              onTapInstead();
            }}
          >
            {t.tapInstead}
          </button>
        </>
      )}
    </div>
  );
}

/** Draw a stored 13-joint frame (the sample) in the same colours as the live overlay. */
function drawTrackFrame(c: HTMLCanvasElement, f: PoseFrame, aspect: number) {
  const w = 640, h = Math.round(640 / aspect);
  if (c.width !== w) {
    c.width = w;
    c.height = h;
  }
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#22201c";
  ctx.fillRect(0, 0, w, h);
  if (!f.lm) return;
  const p = (j: number) => [f.lm![TRACK_JOINTS[j]].x * w, f.lm![TRACK_JOINTS[j]].y * h] as const;
  ctx.lineCap = "round";
  for (const [color, width] of [[CREAM, 9], [BRAND, 6]] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    for (const [a, b] of TRACK_BONES) {
      ctx.beginPath();
      ctx.moveTo(...p(a));
      ctx.lineTo(...p(b));
      ctx.stroke();
    }
  }
  ctx.fillStyle = TURMERIC;
  for (let j = 0; j < TRACK_JOINTS.length; j++) {
    ctx.beginPath();
    ctx.arc(...p(j), 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

"use client";

// "Then vs now": a typical stand from her usual weeks as a faded ghost, today's stand on top,
// both on one clock from the first rise. The slowdown is visible without reading a number.
// Drawn from stored landmark tracks; no video is ever stored.
import { useCallback, useEffect, useRef, useState } from "react";
import { TRACK_BONES, TRACK_JOINTS, type Track } from "@/lib/pose";
import { Play } from "./icons";

const BRAND = "#1F5C45", GHOST = "rgba(90, 84, 75, 0.35)", TURMERIC = "#E8A317", LINE = "#E6DCC8";
const ANKLES = [TRACK_JOINTS.indexOf(27), TRACK_JOINTS.indexOf(28)];
const NOSE = TRACK_JOINTS.indexOf(0);

export type ReplayClip = { seconds: number; track: Track };

type Fit = { ox: number; oy: number; scale: number; aspect: number };

/** Put the ankles at the bottom centre and scale standing height to the same size for both. */
function fit(track: Track): Fit {
  const frames = track.frames.filter((f) => f.length);
  let ax = 0.5, ay = 0.9, height = 0.5;
  if (frames.length) {
    const f0 = frames[0];
    ax = (f0[2 * ANKLES[0]] + f0[2 * ANKLES[1]]) / 2;
    ay = (f0[2 * ANKLES[0] + 1] + f0[2 * ANKLES[1] + 1]) / 2;
    height = Math.max(...frames.map((f) => ay - f[2 * NOSE + 1]), 0.1);
  }
  return { ox: ax, oy: ay, scale: 1 / height, aspect: track.aspect || 1 };
}

function frameAt(track: Track, t: number): number[] | null {
  // t = seconds since this track's first rise; hold the first/last frame outside the clip.
  const i = Math.round((track.start + t) * track.fps);
  for (let k = Math.min(Math.max(i, 0), track.frames.length - 1); k >= 0; k--) if (track.frames[k].length) return track.frames[k];
  return null;
}

function drawSkeleton(ctx: CanvasRenderingContext2D, f: number[], fitT: Fit, w: number, h: number, color: string, width: number) {
  const unit = h * 0.78; // standing height in px
  const px = (k: number) => w / 2 + (f[2 * k] - fitT.ox) * fitT.aspect * fitT.scale * unit;
  const py = (k: number) => h * 0.9 - (fitT.oy - f[2 * k + 1]) * fitT.scale * unit;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  for (const [a, b] of TRACK_BONES) {
    ctx.beginPath();
    ctx.moveTo(px(a), py(a));
    ctx.lineTo(px(b), py(b));
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(px(NOSE), py(NOSE), width * 1.6, 0, Math.PI * 2);
  ctx.fill();
}

export default function StandReplay({
  then, now, thenLabel, nowLabel, replayLabel = "Replay", legend = "Grey = her usual · Green = today", autoPlay = false,
}: {
  then: ReplayClip; now: ReplayClip; thenLabel: string; nowLabel: string; replayLabel?: string; legend?: string; autoPlay?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const raf = useRef(0);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const end = Math.max(then.seconds, now.seconds);
  const fits = useRef({ then: fit(then.track), now: fit(now.track) });

  const draw = useCallback(
    (time: number) => {
      const c = canvas.current;
      const ctx = c?.getContext("2d");
      if (!c || !ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const w = c.clientWidth, h = c.clientHeight;
      if (c.width !== Math.round(w * dpr)) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(16, h * 0.9 + 4);
      ctx.lineTo(w - 16, h * 0.9 + 4);
      ctx.stroke();

      const ft = frameAt(then.track, Math.min(time, then.seconds + 0.5));
      const fn = frameAt(now.track, Math.min(time, now.seconds + 0.5));
      if (ft) drawSkeleton(ctx, ft, fits.current.then, w, h, GHOST, 7);
      if (fn) drawSkeleton(ctx, fn, fits.current.now, w, h, BRAND, 5);

      // Running clocks: the ghost's stops at her usual time, today's keeps going.
      ctx.font = "800 15px system-ui, sans-serif";
      ctx.fillStyle = "rgba(90, 84, 75, 0.75)";
      ctx.fillText(`${Math.min(Math.max(time, 0), then.seconds).toFixed(1)} s`, 14, 24);
      ctx.fillStyle = BRAND;
      const nowText = `${Math.min(Math.max(time, 0), now.seconds).toFixed(1)} s`;
      ctx.fillText(nowText, w - 14 - ctx.measureText(nowText).width, 24);
    },
    [then, now],
  );

  const play = useCallback(() => {
    cancelAnimationFrame(raf.current);
    const t0 = performance.now();
    setPlaying(true);
    const tick = () => {
      const time = (performance.now() - t0) / 1000 - 0.5;
      draw(time);
      setT(Math.max(0, time));
      if (time < end + 0.8) raf.current = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    raf.current = requestAnimationFrame(tick);
  }, [draw, end]);

  useEffect(() => {
    fits.current = { then: fit(then.track), now: fit(now.track) };
    draw(0);
    // Respect reduced motion: show the still, play only on request.
    const start = autoPlay && !window.matchMedia("(prefers-reduced-motion: reduce)").matches ? setTimeout(play, 400) : undefined;
    return () => {
      clearTimeout(start);
      cancelAnimationFrame(raf.current);
    };
  }, [then, now, draw, play, autoPlay]);

  const pct = (s: number) => `${Math.min(100, (s / end) * 100)}%`;

  return (
    <div className="no-print flex flex-col gap-3">
      <canvas
        ref={canvas}
        className="aspect-[4/3] w-full rounded-2xl bg-cream"
        role="img"
        aria-label={`Chair-stand replay: ${thenLabel} ${then.seconds.toFixed(0)} seconds, ${nowLabel} ${now.seconds.toFixed(0)} seconds`}
      />
      <div>
        <div className="relative h-2.5 rounded-full bg-track" aria-hidden>
          <span className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: pct(Math.min(t, now.seconds)) }} />
          <span className="absolute -inset-y-1 w-1 rounded-full bg-muted/60" style={{ left: pct(then.seconds) }} />
          <span className="absolute -inset-y-1 w-1 rounded-full" style={{ left: `calc(${pct(now.seconds)} - 4px)`, background: TURMERIC }} />
        </div>
        <p className="mt-2 flex flex-wrap justify-between gap-x-3 text-sm font-semibold">
          <span className="text-muted">{thenLabel} {Math.round(then.seconds)} s</span>
          <span className="text-brand-dark">{nowLabel} {Math.round(now.seconds)} s</span>
        </p>
        <p className="text-xs text-faint">{legend}</p>
      </div>
      <button
        onClick={play}
        disabled={playing}
        className="flex min-h-11 items-center justify-center gap-2 self-start rounded-2xl border-2 border-brand px-4 font-bold text-brand disabled:opacity-50"
      >
        <Play className="h-4 w-4" /> {replayLabel}
      </button>
    </div>
  );
}


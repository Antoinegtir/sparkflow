"use client";

import { useEffect, useRef, useState } from "react";
import { LoopVideo } from "./LoopVideo";

/**
 * A loading screen in the landing's ASCII style: the Sparkflow spark turning in the middle, rings
 * travelling out from it and a faint noise around. A text <pre>, about 24 frames a second.
 */
const RAMP = " .:-=+*#%@";
const COLS = 64;
const ROWS = 26;
// A character cell is about twice as tall as wide: x is squeezed so the shapes stay round.
const ASPECT = 0.5;

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const escape = (c: string) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c);

/** One frame as HTML: the field in the landing's blue, its brightest cells white and glowing (as there). */
function frame(t: number) {
  let out = "";
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const dx = (x - COLS / 2 + 0.5) * ASPECT;
      const dy = y - ROWS / 2 + 0.5;
      const r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx) - t * 1.2;
      // The four-pointed spark: long thin points, breathing a little.
      const points = Math.pow(Math.abs(Math.cos(2 * a)), 6);
      const size = 8 + 0.8 * Math.sin(t * 2.4);
      const spark = Math.max(0, 1 - r / (size * (0.14 + points))) * 1.7;
      // Rings travelling out, a slow swell under them, fading with distance.
      const ring = Math.max(0, Math.cos((r - t * 5) * 1.1)) ** 5 * Math.max(0, 1 - r / 16) * 0.55;
      const swell = 0.12 * (0.5 + 0.5 * Math.sin(dx * 0.35 + dy * 0.5 - t * 1.5)) * Math.max(0, 1 - r / 18);
      // Sparse twinkling dust.
      const dust = hash(x, y) > 0.93 ? 0.3 * (0.5 + 0.5 * Math.sin(t * 3 + hash(y, x) * 40)) : 0;
      const v = Math.min(1, Math.max(spark, ring, swell, dust));
      const c = escape(RAMP[Math.round(v * (RAMP.length - 1))]);
      out += v > 0.9 ? `<span class="ascii-hot">${c}</span>` : v > 0.7 ? `<span class="ascii-warm">${c}</span>` : c;
    }
    out += "\n";
  }
  return out;
}

const FADE = "radial-gradient(ellipse 50% 50% at 50% 50%, black 45%, transparent 100%)";

/** The workspace loading: the ASCII spark between the landing's Android and Apple glass logos. */
export function AsciiLoader({ label }: { label: string }) {
  const pre = useRef<HTMLPreElement>(null);
  useEffect(() => {
    const el = pre.current;
    if (!el) return;
    const start = performance.now();
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - last < 50) return;
      last = now;
      el.innerHTML = frame((now - start) / 1000);
    };
    el.innerHTML = frame(0.4);
    if (!still) raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="relative grid size-full place-items-center overflow-hidden">
      <div className="pointer-events-none absolute left-1/2 top-1/2 size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-spark-500/15 blur-[120px]" />
      {/* As on the Mac onboarding: centred with flex (a transform would isolate the videos' screen blend). */}
      <div aria-hidden className="pointer-events-none absolute inset-0 mx-auto hidden max-w-6xl items-center justify-between px-6 lg:flex">
        <LoopVideo className="hero-logo h-56 w-56 -rotate-6" src="/videos/android.mp4" />
        <LoopVideo className="hero-logo h-56 w-56 rotate-6" src="/videos/apple.mp4#t=7.5" />
      </div>
      <div className="relative flex flex-col items-center gap-3">
        <pre ref={pre} aria-hidden className="select-none font-mono text-[11px] leading-[12px] text-spark-400/80" style={{ maskImage: FADE, WebkitMaskImage: FADE }} />
        <p className="text-sm text-ink-400">{label}</p>
      </div>
    </div>
  );
}

const SPARK = ["  .  ", " .+. ", ".+*+.", "+*#*+", "*#@#*", "+*#*+", ".+*+.", " .+. "];
const SPARK_FRAME_MS = 110;
/** One beat of the sparkle (it lights up and dims once). */
export const SPARK_BEAT_MS = SPARK.length * SPARK_FRAME_MS;

/** A one-line sparkle for small waits (the top bar), cycling through the ramp. */
export function AsciiSpark({ className, neon }: { className?: string; neon?: boolean }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % SPARK.length), SPARK_FRAME_MS);
    return () => clearInterval(t);
  }, []);
  return (
    <span
      aria-hidden
      className={`whitespace-pre font-mono ${neon ? "text-[#4cc9ff] [text-shadow:0_0_4px_#4cc9ff,0_0_10px_rgba(76,201,255,0.85),0_0_20px_rgba(0,140,255,0.6)]" : "text-spark-300 [text-shadow:0_0_6px_rgba(96,165,250,0.5)]"} ${className ?? ""}`}>
      {SPARK[i]}
    </span>
  );
}

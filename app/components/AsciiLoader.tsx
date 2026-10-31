"use client";

import { useEffect, useRef } from "react";

/**
 * A loading screen in the landing's ASCII style: the Sparkflow spark turning in the middle, rings
 * travelling out from it and a faint noise around. A text <pre>, about 24 frames a second.
 */
const RAMP = " .·:-=+*#%@";
const COLS = 46;
const ROWS = 19;
// A character cell is about twice as tall as wide: x is squeezed so the shapes stay round.
const ASPECT = 0.5;

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

function frame(t: number) {
  let out = "";
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const dx = (x - COLS / 2 + 0.5) * ASPECT;
      const dy = y - ROWS / 2 + 0.5;
      const r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx) - t * 1.6;
      // The four-pointed spark: long thin points, breathing a little.
      const points = Math.pow(Math.abs(Math.cos(2 * a)), 6);
      const size = 6.2 + 0.6 * Math.sin(t * 3);
      const spark = Math.max(0, 1 - r / (size * (0.16 + points))) * 1.6;
      // Rings travelling out, fading with distance.
      const ring = Math.max(0, Math.cos((r - t * 4) * 1.4)) ** 6 * Math.max(0, 1 - r / 12) * 0.45;
      // Sparse twinkling dust.
      const dust = hash(x, y) > 0.94 ? 0.25 * (0.5 + 0.5 * Math.sin(t * 4 + hash(y, x) * 40)) : 0;
      const v = Math.min(1, Math.max(spark, ring, dust));
      out += RAMP[Math.round(v * (RAMP.length - 1))];
    }
    out += "\n";
  }
  return out;
}

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
      if (now - last < 42) return;
      last = now;
      el.textContent = frame((now - start) / 1000);
    };
    if (still) el.textContent = frame(0.4);
    else raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="flex flex-col items-center gap-4">
      <pre ref={pre} aria-hidden className="select-none font-mono text-[11px] leading-[12px] text-spark-300/90 [text-shadow:0_0_8px_rgba(96,165,250,0.45)]">
        {frame(0)}
      </pre>
      <p className="text-sm text-ink-400">{label}</p>
    </div>
  );
}

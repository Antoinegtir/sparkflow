"use client";

import { useEffect, useRef } from "react";

/**
 * An ASCII animation under the "How it works" summary, one motif per step: the voice of Describe, the grid
 * of the plan, code raining for Build, the scan of Look, the loop of Fix, the ripples of a click, the
 * sky of Ship. Drawn as text (a <pre>), about 20 frames a second while it's on screen.
 */
const ROWS = 22;
const RAMP = " .:-=+*#%@";
// A character cell is about twice as tall as wide: x is squeezed so circles stay round.
const ASPECT = 0.5;

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Intensity 0..1 of the character at (x, y) at time t, on a grid `w` columns wide. */
type Motif = (x: number, y: number, t: number, w: number) => number;

const MOTIFS: Motif[] = [
  // 01 Describe: a voice waveform running across.
  (x, y, t, w) => {
    const amp = (0.25 + 0.75 * Math.abs(Math.sin(x * 0.11 + t * 0.9))) * (ROWS / 2 - 1.5);
    const wave = ROWS / 2 + Math.sin(x * 0.42 - t * 4) * amp * Math.sin(x * 0.07 + t);
    return Math.exp(-((y - wave) ** 2) / 1.6);
  },
  // 02 Plan: a grid of screens, lighting up one after another.
  (x, y, t, w) => {
    const onLine = x % 14 === 0 || y % 6 === 0;
    const cell = Math.floor(x / 14) + Math.floor(y / 6) * 5;
    const lit = 0.5 + 0.5 * Math.sin(t * 2 - cell * 0.9);
    return onLine ? 0.25 + 0.75 * lit : 0.08 * lit;
  },
  // 03 Build: code falling in columns, each at its own speed.
  (x, y, t, w) => {
    const speed = 0.25 + hash(x, 1) * 0.6;
    const head = (t * speed * 6 + hash(x, 2) * ROWS * 2) % (ROWS * 2);
    const d = head - y;
    return d >= 0 && d < 7 ? 1 - d / 7 : 0;
  },
  // 04 Look: an eye, and a scan line sweeping down through it.
  (x, y, t, w) => {
    const scan = ((t * 5) % (ROWS + 6)) - 3;
    const dx = (x - w / 2) * ASPECT;
    const dy = y - ROWS / 2;
    const eye = Math.abs(Math.hypot(dx / 1.6, dy) - 6) < 0.6 ? 0.6 : Math.hypot(dx, dy) < 2.2 ? 0.9 : 0;
    return Math.max(eye, Math.exp(-((y - scan) ** 2) / 1.2) * 0.9);
  },
  // 05 Fix: a spiral turning, the loop of verify, fix, repeat.
  (x, y, t, w) => {
    const dx = (x - w / 2) * ASPECT;
    const dy = y - ROWS / 2;
    const r = Math.hypot(dx, dy);
    return (0.5 + 0.5 * Math.sin(Math.atan2(dy, dx) * 3 + r * 0.9 - t * 3)) * Math.exp(-r / 10);
  },
  // 06 Point and talk: ripples spreading from a click that moves around.
  (x, y, t, w) => {
    const cx = w / 2 + Math.sin(t * 0.5) * 14;
    const cy = ROWS / 2 + Math.cos(t * 0.7) * 3;
    const r = Math.hypot((x - cx) * ASPECT, y - cy);
    return Math.max(0, Math.sin(r * 1.3 - t * 5)) * Math.exp(-r / 8);
  },
  // 07 Ship: stars streaming down past something rising.
  (x, y, t, w) => {
    const row = Math.floor(y + t * (2 + hash(x, 3) * 4));
    const star = hash(x, row) > 0.93 ? 0.4 + hash(row, x) * 0.6 : 0;
    const dx = (x - w / 2) * ASPECT;
    const trail = Math.abs(dx) < 1.2 && y > ROWS / 2 ? 0.9 * (1 - (y - ROWS / 2) / (ROWS / 2)) * (0.6 + 0.4 * Math.sin(t * 20 + y)) : 0;
    const tip = Math.hypot(dx, (y - ROWS / 2 + 1) * 0.8) < 1.6 ? 1 : 0;
    return Math.max(star, trail, tip);
  },
];

function frame(step: number, t: number, cols: number) {
  const f = MOTIFS[Math.max(0, Math.min(MOTIFS.length - 1, step))];
  let out = "";
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < cols; x++) {
      const v = Math.max(0, Math.min(1, f(x, y, t, cols)));
      out += RAMP[Math.round(v * (RAMP.length - 1))];
    }
    out += "\n";
  }
  return out;
}

export function AsciiField({ step }: { step: number }) {
  const pre = useRef<HTMLPreElement>(null);
  const stepRef = useRef(step);
  stepRef.current = step;

  useEffect(() => {
    const el = pre.current;
    if (!el) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let visible = false;
    let raf = 0;
    let last = 0;
    const start = performance.now();
    // As many columns as fit between the screen's left edge and the field's right edge (it's anchored
    // there, beside the summary), measured from the width of one character.
    let cols = 40;
    const fit = () => {
      const probe = document.createElement("span");
      probe.textContent = "0".repeat(10);
      el.appendChild(probe);
      const cw = probe.getBoundingClientRect().width / 10 || 6.6;
      probe.remove();
      const room = (el.parentElement?.getBoundingClientRect().right ?? 300) - 24;
      cols = Math.max(16, Math.min(72, Math.floor(room / cw)));
    };
    fit();
    addEventListener("resize", fit);
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      // About 20 frames a second is enough for text, and cheap.
      if (now - last < 50) return;
      last = now;
      el.textContent = frame(stepRef.current, (now - start) / 1000, cols);
    };
    el.textContent = frame(stepRef.current, 1.2, cols);
    if (still) return () => removeEventListener("resize", fit);
    // Only while on screen.
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) raf = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      removeEventListener("resize", fit);
    };
  }, []);

  return (
    <pre
      ref={pre}
      aria-hidden
      className="pointer-events-none ml-auto select-none font-mono text-[11px] leading-[12px] text-spark-400/80"
      // Fades out toward the edges, so the field has no hard border.
      style={{ maskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, black 45%, transparent 100%)", WebkitMaskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, black 45%, transparent 100%)" }}
    />
  );
}

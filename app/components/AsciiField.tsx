"use client";

import { useEffect, useRef } from "react";

/**
 * An ASCII animation beside the "How it works" summary, one motif per step: a message being typed, the
 * grid of the plan, code raining for Build, a phone captured and scanned, the loop of Fix, the ripples of
 * a click, the app going up to the stores. Drawn as text (a <pre>), about 20 frames a second while it's on screen.
 */
const RAMP = " .:-=+*#%@";
// A character cell is about twice as tall as wide: x is squeezed so circles stay round.
const ASPECT = 0.5;

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Intensity 0..1 of the character at (x, y) at time t, on a grid `w` columns by `h` rows. */
/** Signed distance to a rounded rectangle centred on 0 (negative inside), in character units. */
const roundRect = (dx: number, dy: number, hw: number, hh: number, r: number) => {
  const qx = Math.abs(dx) - hw + r;
  const qy = Math.abs(dy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};

type Motif = (x: number, y: number, t: number, w: number, h: number) => number;

const MOTIFS: Motif[] = [
  // 01 Describe: a message bubble, its lines being typed, a cursor blinking at the end.
  (x, y, t, w, h) => {
    const cx = w / 2;
    const cy = Math.round(h * 0.45);
    const hw = w * ASPECT * 0.4;
    // As tall as it is wide (on screen), whatever the field's shape.
    const hh = Math.round(Math.min(h * 0.3, hw * 1.1));
    const dx = (x - cx) * ASPECT;
    const dy = y - cy;
    const edge = Math.abs(roundRect(dx, dy, hw, hh, 2.5)) < 0.55;
    // The tail, under the bubble on the left.
    const below = y - (cy + hh);
    const tail = below > 0 && below < h * 0.12 && Math.abs(dx + hw * 0.55 - below * 0.9) < 0.7;
    if (edge || tail) return 0.75;
    // Text lines, typed one after the other, then the whole message starts again.
    const lines = Math.max(2, Math.floor((hh * 2 - 3) / 2));
    const line = Math.round((y - (cy - hh + 2)) / 2);
    if ((y - (cy - hh + 2)) % 2 !== 0 || line < 0 || line >= lines) return 0;
    const left = cx - hw / ASPECT + 3;
    // Every line counts as full width for the typing, so they fill in order; the last one stops short.
    const full = Math.floor((hw / ASPECT) * 2 - 6);
    const width = line === lines - 1 ? Math.floor(full * 0.55) : full;
    const col = x - left;
    if (col < 0 || col >= width) return 0;
    const typed = (t * 14) % (lines * full + 20);
    const at = line * full + col;
    if (at > typed) return 0;
    // Gaps between words.
    if (hash(Math.floor((col + line * 7) / 5), line) > 0.82) return 0;
    const cursor = Math.floor(typed) - line * full === col && Math.sin(t * 8) > 0;
    return cursor ? 1 : 0.45;
  },
  // 02 Plan: a grid of screens, lighting up one after another.
  (x, y, t, w, h) => {
    const onLine = x % 14 === 0 || y % 6 === 0;
    const cell = Math.floor(x / 14) + Math.floor(y / 6) * 5;
    const lit = 0.5 + 0.5 * Math.sin(t * 2 - cell * 0.9);
    return onLine ? 0.25 + 0.75 * lit : 0.08 * lit;
  },
  // 03 Build: code falling in columns, each at its own speed.
  (x, y, t, w, h) => {
    const speed = 0.25 + hash(x, 1) * 0.6;
    const head = (t * speed * 6 + hash(x, 2) * h * 2) % (h * 2);
    const d = head - y;
    return d >= 0 && d < 7 ? 1 - d / 7 : 0;
  },
  // 04 Look: a phone, its screen being captured (viewfinder corners, a flash) and scanned line by line.
  (x, y, t, w, h) => {
    const cx = w / 2;
    const cy = Math.round(h / 2);
    // A phone's proportions (half as wide as tall), as big as both the field's height and width allow.
    const hh = Math.round(Math.min(h * 0.42, (w * ASPECT * 0.4) / 0.5));
    const hw = hh * 0.5;
    const dx = (x - cx) * ASPECT;
    const dy = y - cy;
    const body = roundRect(dx, dy, hw, hh, 2);
    if (Math.abs(body) < 0.55) return 0.8;
    const cycle = t % 4;
    if (body < 0) {
      // The app inside: a title and rows, lit by the scan as it passes.
      const scan = -hh + ((cycle / 4) * hh * 2.2) % (hh * 2);
      const row = Math.round((dy + hh - 3) / 3);
      const onRow = (dy + hh - 3) % 3 === 0 && row >= 0 && Math.abs(dx) < hw - 2 && dy < hh - 2 && Math.abs(dx) < hw * (row === 0 ? 0.5 : 0.85);
      const lit = Math.exp(-((dy - scan) ** 2) / 2);
      const flash = cycle < 0.25 ? 1 - cycle * 4 : 0;
      return Math.max(onRow ? 0.3 + lit * 0.7 : 0, lit * 0.35, flash * 0.5);
    }
    // Viewfinder corners around the phone.
    const ox = Math.abs(dx) - (hw + 2);
    const oy = Math.abs(dy) - (hh + 1.5);
    const corner = (Math.abs(ox) < 0.5 && oy > -h * 0.12 && oy < 0.5) || (Math.abs(oy) < 0.5 && ox > -hw * 0.45 && ox < 0.5);
    return corner ? 0.6 : 0;
  },
  // 05 Fix: a spiral turning, the loop of verify, fix, repeat.
  (x, y, t, w, h) => {
    const dx = (x - w / 2) * ASPECT;
    const dy = y - h / 2;
    const r = Math.hypot(dx, dy);
    return (0.5 + 0.5 * Math.sin(Math.atan2(dy, dx) * 3 + r * 0.9 - t * 3)) * Math.exp(-r / (h * 0.55));
  },
  // 06 Point and talk: ripples spreading from a click that moves around.
  (x, y, t, w, h) => {
    const cx = w / 2 + Math.sin(t * 0.5) * 14;
    const cy = h / 2 + Math.cos(t * 0.7) * h * 0.2;
    const r = Math.hypot((x - cx) * ASPECT, y - cy);
    return Math.max(0, Math.sin(r * 1.3 - t * 5)) * Math.exp(-r / (h * 0.45));
  },
  // 07 Ship: chevrons rising, the app going up to the stores, over a progress bar filling up.
  (x, y, t, w, h) => {
    const cx = w / 2;
    const dx = Math.abs((x - cx) * ASPECT);
    const top = h * 0.12;
    const span = h * 0.62;
    let v = 0;
    // Arms no wider than the middle of the field.
    const armLen = Math.min(h * 0.12, (w * ASPECT * 0.38) / 1.1);
    for (let k = 0; k < 3; k++) {
      // Each chevron climbs from the bottom of its span to the top, fading near the top.
      const p = (t * 0.35 + k / 3) % 1;
      const tipY = top + span * (1 - p);
      const arm = y - tipY;
      if (arm >= 0 && arm < armLen && Math.abs(dx - arm * 1.1) < 0.75) v = Math.max(v, 0.35 + 0.65 * p);
    }
    // The progress bar under it.
    const barY = Math.round(h * 0.86);
    const barW = w * ASPECT * 0.32;
    if (Math.abs(y - barY) <= 1 && dx <= barW) {
      const fill = (t * 0.35) % 1;
      const pos = ((x - cx) * ASPECT + barW) / (barW * 2);
      return y === barY ? (pos <= fill ? 0.85 : 0.15) : 0.25;
    }
    return v;
  },
];

function frame(step: number, t: number, cols: number, rows: number) {
  const f = MOTIFS[Math.max(0, Math.min(MOTIFS.length - 1, step))];
  let out = "";
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const v = Math.max(0, Math.min(1, f(x, y, t, cols, rows)));
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
    // there, beside the summary), and as many rows as 80% of the screen's height, from one character's size.
    let cols = 40;
    let rows = 22;
    const fit = () => {
      const probe = document.createElement("span");
      probe.textContent = "0".repeat(10);
      el.appendChild(probe);
      const box = probe.getBoundingClientRect();
      const cw = box.width / 10 || 6.6;
      const lh = parseFloat(getComputedStyle(el).lineHeight) || 12;
      probe.remove();
      const room = (el.parentElement?.getBoundingClientRect().right ?? 300) - 24;
      cols = Math.max(16, Math.min(72, Math.floor(room / cw)));
      rows = Math.max(12, Math.min(70, Math.floor((innerHeight * 0.8) / lh)));
    };
    fit();
    addEventListener("resize", fit);
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      // About 20 frames a second is enough for text, and cheap.
      if (now - last < 50) return;
      last = now;
      el.textContent = frame(stepRef.current, (now - start) / 1000, cols, rows);
    };
    el.textContent = frame(stepRef.current, 1.2, cols, rows);
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

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

/**
 * Intensity 0..1 of the character at (x, y) at time t, on a grid `w` columns by `h` rows, drawn from the
 * ramp; or the character itself, for motifs drawn as ASCII art.
 */
type Motif = (x: number, y: number, t: number, w: number, h: number) => number | string;

const PROMPT = "A habit tracker with streaks and a weekly chart. Three habits for today, a check on each.";
const REPLY = "On it: three screens, a streak on each habit.";
/** The conversation for a w × h field: a char and the time (s) it appears at, for every cell. */
type Thread = { grid: string[][]; at: number[][]; wave: { y: number; x0: number; x1: number; at: number }; dots: { y: number; from: number; to: number }; cycle: number };
const threads = new Map<string, Thread>();

function wrap(text: string, width: number) {
  const lines: string[] = [];
  let cur = "";
  for (const word of text.split(" ")) {
    if (cur && `${cur} ${word}`.length > width) {
      lines.push(cur);
      cur = word;
    } else cur = cur ? `${cur} ${word}` : word;
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * A chat drawn top to bottom over the whole height: the prompt typed in a bubble, a sketch of the app
 * drawn line by line (it takes the height left), a voice note, then Muse Spark's reply.
 */
function thread(w: number, h: number): Thread {
  const key = `${w}x${h}`;
  const cached = threads.get(key);
  if (cached) return cached;
  const grid = Array.from({ length: h }, () => Array<string>(w).fill(" "));
  const at = Array.from({ length: h }, () => Array<number>(w).fill(Infinity));
  const put = (x: number, y: number, c: string, when: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    grid[y][x] = c;
    at[y][x] = when;
  };
  const box = (left: number, top: number, width: number, height: number, when: number) => {
    for (let x = left; x < left + width; x++) {
      const edge = x === left || x === left + width - 1;
      put(x, top, edge ? "." : "-", when);
      put(x, top + height - 1, edge ? "'" : "-", when);
    }
    for (let y = top + 1; y < top + height - 1; y++) {
      put(left, y, "|", when);
      put(left + width - 1, y, "|", when);
    }
  };
  const bw = Math.max(10, Math.min(w - 2, 32));
  const inner = bw - 4;
  const userLeft = w - bw - 1;
  const prompt = wrap(PROMPT, inner);
  const reply = wrap(REPLY, inner);
  // Rows: prompt box, gap, sketch box, gap, voice box, gap, reply box; the sketch takes what's left.
  const fixed = prompt.length + 2 + 1 + 2 + 1 + 3 + 1 + reply.length + 2;
  // A phone's proportions (a character is twice as tall as it is wide); the height it doesn't need goes
  // between the messages.
  const pw = Math.min(inner, 22);
  const room = Math.max(6, h - fixed - 2);
  const sketchRows = Math.min(room, Math.round(pw * 1.05));
  const gap = Math.floor((room - sketchRows) / 3);
  let y = Math.max(0, Math.floor((h - fixed - sketchRows - gap * 3) / 2));
  let t = 0.3;

  box(userLeft, y, bw, prompt.length + 2, t);
  prompt.forEach((line, i) => {
    for (let c = 0; c < line.length; c++) put(userLeft + 2 + c, y + 1 + i, line[c], (t += 1 / 14));
    t += 1 / 14;
  });
  y += prompt.length + 3 + gap;
  t += 0.5;

  // The sketch: a phone, a title, habit rows with a check, a bar chart under them.
  box(userLeft, y, bw, sketchRows + 2, t);
  const pl = userLeft + Math.floor((bw - pw) / 2);
  const ph = sketchRows;
  const py = y + 1;
  const mid = pw - 2;
  const row = (text: string) => `|${text.padEnd(mid).slice(0, mid)}|`;
  // The phone's parts; the rows left over go between them, so the phone fills the bubble's height.
  const chartRows = Math.max(2, Math.min(7, ph - 14));
  const chart = Array.from({ length: chartRows }, (_, r) => {
    let line = " ";
    for (let c = 1; c < mid - 1; c++) {
      const tall = Math.round(chartRows * (0.3 + 0.7 * Math.abs(Math.sin(c * 1.3))));
      line += c % 2 === 1 && chartRows - r <= tall ? "#" : " ";
    }
    return row(line);
  });
  const parts = [
    [row(" Habits"), `|${"-".repeat(mid)}|`],
    [row(" [x] Read"), row(" [x] Run"), row(" [ ] Water")],
    [row(" * 12 day streak")],
    chart,
    [`|${"-".repeat(mid)}|`, row("  o   o   o")],
  ];
  const used = parts.reduce((n, p) => n + p.length, 2);
  const spare = Math.max(0, ph - used);
  const rows: string[] = [`.${"-".repeat(mid)}.`];
  parts.forEach((p, i) => {
    rows.push(...p);
    if (i < parts.length - 1) for (let k = 0; k < Math.floor((spare * (i + 1)) / (parts.length - 1)) - Math.floor((spare * i) / (parts.length - 1)); k++) rows.push(row(""));
  });
  rows.push(`'${"-".repeat(mid)}'`);
  rows.slice(0, ph).forEach((line, r) => {
    t += 0.09;
    for (let c = 0; c < line.length; c++) put(pl + c, py + r, line[c], t);
  });
  y += sketchRows + 3 + gap;
  t += 0.5;

  // The voice note: a play mark and a waveform that moves.
  box(userLeft, y, bw, 3, t);
  put(userLeft + 2, y + 1, ">", t);
  const wave = { y: y + 1, x0: userLeft + 4, x1: userLeft + bw - 2, at: t };
  y += 4 + gap;
  t += 1.6;

  // The reply, on the left: dots first, then typed.
  box(1, y, bw, reply.length + 2, t);
  const dots = t;
  t += 1.2;
  reply.forEach((line, i) => {
    for (let c = 0; c < line.length; c++) put(3 + c, y + 1 + i, line[c], (t += 1 / 16));
  });
  const result = { grid, at, wave, dots: { y: y + 1, from: dots, to: dots + 1.2 }, cycle: t + 3 };
  threads.set(key, result);
  return result;
}

/** An arrow pointer; the spaces inside it hide the ripples behind. */
// Figma's pointer, drawn in white over the ripples: its tip at the top left.
const CURSOR = [
  "@@:",
  " @@@@@",
  " @@   @@@+",
  " .@       @@@",
  "  @:         %@@-",
  "  @@         .@@@@*",
  "  :@     @@@@",
  "   @@  #@",
  "   *@ @@",
  "    @@#",
  "    *.",
];
/** Marks a character drawn in white rather than the field's blue. */
const WHITE = "\u0001";
const CURSOR_TAG = "[ bigger, in blue ]";

/** A rocket, nose up; the spaces inside it hide the stars behind. */
const ROCKET = [
  "     /\\",
  "    /  \\",
  "   /    \\",
  "   |    |",
  "   | () |",
  "   |    |",
  "   |    |",
  "  /|    |\\",
  " / |    | \\",
  "/__|____|__\\",
  "    \\__/",
];
const ROCKET_W = 12;
const FLAME_ROWS = 3;

const MOTIFS: Motif[] = [
  // 01 Describe: a chat from the top to the bottom, all there at once: the prompt, a sketch, a voice note
  // whose waveform moves, the reply.
  (x, y, t, w, h) => {
    const th = thread(w, h);
    const v = th.wave;
    if (y === v.y && x >= v.x0 && x < v.x1) {
      const a = Math.abs(Math.sin(x * 0.9 + t * 6) * Math.sin(x * 0.3 - t * 2));
      return " .:-=+*#"[Math.min(7, Math.floor(a * 8))];
    }
    return th.grid[y]?.[x] ?? " ";
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
  // 04 Look: a big eye over the whole field, looking around, blinking now and then.
  (x, y, t, w, h) => {
    // In column units: a character is about twice as tall as it is wide.
    const dx = x - w / 2;
    const dy = (y - h / 2) * 2;
    const rx = w / 2 - 1;
    const u = dx / rx;
    // Rings of sight spreading from the eye over the whole field.
    const ring = Math.sin(Math.hypot(dx, dy) * 0.35 - t * 3);
    const sight = ring > 0.85 ? 0.3 : 0;
    if (Math.abs(u) > 1) return sight;
    const cycle = t % 5;
    const blink = cycle > 4.7 ? Math.abs(cycle - 4.85) / 0.15 : 1;
    const lid = Math.min(rx * 0.9, h - 2) * (1 - u * u) * blink;
    const edge = Math.abs(Math.abs(dy) - lid);
    if (edge < 1.2) return "#";
    if (Math.abs(dy) > lid) {
      // Lashes over the top lid.
      const above = -dy - lid;
      return dy < 0 && above < 4 && x % 3 === 0 && Math.abs(u) < 0.8 ? ":" : sight;
    }
    // The iris follows a slow look around; the pupil and a glint inside it.
    const ix = Math.sin(t * 0.7) * rx * 0.35;
    const iy = Math.sin(t * 1.1) * lid * 0.15;
    const r = Math.hypot(dx - ix, dy - iy);
    const R = Math.min(rx * 0.32, lid * 0.95 + 0.01);
    if (Math.hypot(dx - ix + R * 0.35, dy - iy + R * 0.35) < R * 0.18) return "@";
    if (r < R * 0.42) return " ";
    if (r < R) return 0.45 + 0.4 * Math.abs(Math.sin(Math.atan2(dy - iy, dx - ix) * 9 + t));
    if (r < R + 1.2) return 0.9;
    return 0.06;
  },
  // 05 Fix: a spiral turning, the loop of verify, fix, repeat.
  (x, y, t, w, h) => {
    const dx = (x - w / 2) * ASPECT;
    const dy = y - h / 2;
    const r = Math.hypot(dx, dy);
    return (0.5 + 0.5 * Math.sin(Math.atan2(dy, dx) * 3 + r * 0.9 - t * 3)) * Math.exp(-r / (h * 0.55));
  },
  // 06 Point and talk: a Figma-like cursor with its name tag (what was said) moving around, ripples
  // spreading from where it points.
  (x, y, t, w, h) => {
    // The tip of the arrow, kept far enough from the right edge for the tag.
    const room = Math.max(4, w - Math.max(CURSOR_TAG.length + 2, 19) - 2);
    const cx = Math.round(Math.min(room, Math.max(3, w / 2 - 8 + Math.sin(t * 0.5) * (w * 0.12))));
    const cy = Math.round(h / 2 - 3 + Math.cos(t * 0.7) * h * 0.12);
    const dx = x - cx;
    const dy = y - cy;
    const arrow = CURSOR[dy];
    // Inside the outline it's blank (the ripples stop at its edge); the outline is white.
    // (the spaces before a line's first character aren't the cursor: the ripples show there).
    if (arrow !== undefined && dx >= arrow.search(/\S/) && dx < arrow.length) return arrow[dx] === " " ? " " : WHITE + arrow[dx];
    // The tag under the arrow, like a collaborator's name in Figma.
    if (dy === CURSOR.length && dx >= 2 && dx < 2 + CURSOR_TAG.length) return WHITE + CURSOR_TAG[dx - 2];
    const r = Math.hypot(dx * ASPECT, dy);
    return Math.max(0, Math.sin(r * 1.3 - t * 5)) * Math.exp(-r / (h * 0.45));
  },
  // 07 Ship: a rocket taking off in white, its flame flickering, stars streaming past in blue.
  (x, y, t, w, h) => {
    const rh = ROCKET.length + FLAME_ROWS;
    // Rises from below the field to above it, then again.
    const p = (t * 0.11) % 1;
    const top = Math.round(h + 2 - p * (h + rh + 4));
    const left = Math.round(w / 2 - ROCKET_W / 2);
    const dy = y - top;
    const dx = x - left;
    const row = ROCKET[dy];
    if (row !== undefined) {
      const first = row.search(/\S/);
      // Inside the hull it's blank; the hull itself is white.
      if (dx >= first && dx < row.length) return row[dx] === " " ? " " : WHITE + row[dx];
    } else if (dy >= ROCKET.length && dy < rh) {
      // The flame: narrower and dimmer row by row, flickering.
      const f = dy - ROCKET.length;
      const half = 2 - f * 0.6;
      const c = dx - ROCKET_W / 2 + 0.5;
      if (Math.abs(c) <= half) {
        const k = hash(Math.floor(t * 14) + f * 3, x);
        return WHITE + (f === 0 ? (k > 0.5 ? "#" : "%") : f === 1 ? (k > 0.5 ? "*" : "+") : k > 0.5 ? ":" : ".");
      }
    }
    // Stars streaming down past it.
    const r = Math.floor(y - t * (3 + hash(x, 7) * 5));
    return hash(x, r) > 0.94 ? 0.3 + hash(r, x) * 0.6 : 0;
  },
];

const escape = (c: string) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c);

/** One frame as HTML: the field's characters, with white ones (a WHITE mark) in a white span. */
const GLITCH = "!<>-_\\/[]{}=+*^?#%@01";
const TRANSITION = 0.7;

function cell(f: Motif, x: number, y: number, t: number, cols: number, rows: number) {
  const v = f(x, y, t, cols, rows);
  if (typeof v !== "string") return RAMP[Math.round(Math.max(0, Math.min(1, v)) * (RAMP.length - 1))];
  if (v.startsWith(WHITE)) return `<span class="text-white">${escape(v.slice(1))}</span>`;
  return escape(v);
}

/**
 * One frame of the field. While `p` (0..1) runs, the previous step's motif is wiped away by a ragged
 * diagonal front of random glyphs, the new motif behind it.
 */
function frame(step: number, t: number, cols: number, rows: number, from = step, p = 1) {
  const pick = (s: number) => MOTIFS[Math.max(0, Math.min(MOTIFS.length - 1, s))];
  const f = pick(step);
  const g = pick(from);
  const span = cols + rows;
  const front = p * (span + 12) - 6;
  let out = "";
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (p >= 1) {
        out += cell(f, x, y, t, cols, rows);
        continue;
      }
      // A ragged front: each cell crosses it at its own moment.
      const d = x + y + (hash(x, y) - 0.5) * 8 - front;
      if (d < -3) out += cell(f, x, y, t, cols, rows);
      else if (d > 3) out += cell(g, x, y, t, cols, rows);
      else out += escape(GLITCH[Math.floor(hash(x + Math.floor(t * 20), y) * GLITCH.length)]);
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
    let shown = stepRef.current;
    let from = shown;
    let changed = -TRANSITION;
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
      const t = (now - start) / 1000;
      // A new step: the field switches over with a transition.
      if (stepRef.current !== shown) {
        from = shown;
        shown = stepRef.current;
        changed = t;
      }
      el.innerHTML = frame(shown, t, cols, rows, from, Math.min(1, (t - changed) / TRANSITION));
    };
    el.innerHTML = frame(stepRef.current, 1.2, cols, rows);
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

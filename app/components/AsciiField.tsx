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
type Bubble = { left: number; top: number; width: number; height: number; lines: string[]; starts: number[]; total: number };
const bubbles = new Map<string, Bubble>();

/** The bubble for a w × h field: the prompt wrapped to its width, centred a little above the middle. */
function bubble(w: number, h: number): Bubble {
  const key = `${w}x${h}`;
  const cached = bubbles.get(key);
  if (cached) return cached;
  const width = Math.max(14, Math.min(w - 2, 34));
  const inner = width - 4;
  const lines: string[] = [];
  let cur = "";
  for (const word of PROMPT.split(" ")) {
    if (cur && `${cur} ${word}`.length > inner) {
      lines.push(cur);
      cur = word;
    } else cur = cur ? `${cur} ${word}` : word;
  }
  if (cur) lines.push(cur);
  // Each line starts after the previous one in the typing (its space counts too).
  const starts = lines.map((_, i) => lines.slice(0, i).reduce((n, l) => n + l.length + 1, 0));
  const height = lines.length + 4;
  const b = { left: Math.floor((w - width) / 2), top: Math.floor(h / 2 - height / 2) - 2, width, height, lines, starts, total: PROMPT.length };
  bubbles.set(key, b);
  return b;
}

/** The terminal's lines at time t (a 10 s loop), each as wide as the window's inside. */
function shipLines(w: number, t: number) {
  const inner = Math.max(18, Math.min(w - 2, 34)) - 4;
  const k = t % 10;
  const dots = (label: string, status: string) => `${label} ${".".repeat(Math.max(1, inner - label.length - status.length - 2))} ${status}`;
  const bar = (label: string, from: number, to: number) => {
    const p = Math.max(0, Math.min(1, (k - from) / (to - from)));
    const pct = p >= 1 ? " ok" : `${Math.round(p * 100)}%`.padStart(3);
    const n = inner - label.length - pct.length - 3;
    const done = Math.round(p * n);
    return `${label} [${"#".repeat(done)}${".".repeat(n - done)}]${pct}`;
  };
  const cmd = "$ sparkflow ship";
  const out = [cmd.slice(0, Math.floor(k * 16))];
  if (k > 1.4) out.push(dots("Release build", k > 2.4 ? "ok" : "..."));
  if (k > 2.6) out.push(dots("Signing", k > 3.4 ? "ok" : "..."));
  if (k > 3.6) out.push(bar("TestFlight ", 3.6, 6.4));
  if (k > 4.2) out.push(bar("Google Play", 4.2, 7.2));
  if (k > 7.6) out.push("Shipped to both stores.");
  while (out.length < 6) out.push("");
  return out;
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

const MOTIFS: Motif[] = [
  // 01 Describe: a message bubble drawn in ASCII, the prompt typed into it, then typed again.
  (x, y, t, w, h) => {
    const b = bubble(w, h);
    const right = b.left + b.width - 1;
    const bottom = b.top + b.height - 1;
    // The tail: an opening in the bottom edge, then a triangle closing under it, | on the left and / on
    // the right, meeting three rows down.
    const tl = b.left + 3;
    if (y === b.top || y === bottom) {
      if (x === b.left || x === right) return y === b.top ? "." : "'";
      if (y === bottom && (x === tl || x === tl + 4)) return ".";
      if (y === bottom && x > tl && x < tl + 4) return " ";
      return x > b.left && x < right ? "-" : " ";
    }
    const below = y - bottom;
    if (below >= 1 && below <= 3) return x === tl ? "|" : x === tl + 4 - below ? "/" : " ";
    if (y < b.top || y > bottom) return " ";
    if (x === b.left || x === right) return "|";
    const row = y - b.top - 2;
    const col = x - b.left - 2;
    const line = b.lines[row];
    const typed = Math.floor(t * 12) % (b.total + 30);
    if (!line || col < 0 || col > line.length) return " ";
    const at = b.starts[row] + col;
    // The cursor blinks where the next character goes (after the last one at the end of a line).
    if (at === typed && Math.sin(t * 9) > 0) return "_";
    return col < line.length && at < typed ? line[col] : " ";
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
  // 04 Look: a phone, its screen being captured (viewfinder corners blink) and scanned line by line.
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
      // The scan lights the rows it crosses, and draws a thin line of its own.
      const lit = Math.exp(-((dy - scan) ** 2) / 2);
      return Math.max(onRow ? 0.3 + lit * 0.7 : 0, Math.abs(dy - scan) < 0.5 ? 0.45 : 0);
    }
    // Viewfinder corners around the phone.
    const ox = Math.abs(dx) - (hw + 2);
    const oy = Math.abs(dy) - (hh + 1.5);
    const corner = (Math.abs(ox) < 0.5 && oy > -h * 0.12 && oy < 0.5) || (Math.abs(oy) < 0.5 && ox > -hw * 0.45 && ox < 0.5);
    // They blink once at the start of each round: the capture.
    return corner ? (cycle < 0.5 && Math.sin(cycle * 40) > 0 ? 1 : 0.6) : 0;
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
  // 07 Ship: a terminal shipping the app, step by step: the build, the signing, both stores filling up.
  (x, y, t, w, h) => {
    const lines = shipLines(w, t);
    const width = Math.max(18, Math.min(w - 2, 34));
    const left = Math.floor((w - width) / 2);
    const top = Math.floor(h / 2 - (lines.length + 4) / 2) - 2;
    const right = left + width - 1;
    const bottom = top + lines.length + 3;
    if (y < top || y > bottom || x < left || x > right) return " ";
    if (y === top || y === bottom) {
      if (x === left || x === right) return y === top ? "." : "'";
      // The window's title in the top edge.
      const title = "-- ship ";
      const i = x - left - 1;
      return y === top && i < title.length ? title[i] : "-";
    }
    if (x === left || x === right) return "|";
    const line = lines[y - top - 2];
    return line?.[x - left - 2] ?? " ";
  },
];

const escape = (c: string) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c);

/** One frame as HTML: the field's characters, with white ones (a WHITE mark) in a white span. */
function frame(step: number, t: number, cols: number, rows: number) {
  const f = MOTIFS[Math.max(0, Math.min(MOTIFS.length - 1, step))];
  let out = "";
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const v = f(x, y, t, cols, rows);
      if (typeof v !== "string") out += RAMP[Math.round(Math.max(0, Math.min(1, v)) * (RAMP.length - 1))];
      else if (v.startsWith(WHITE)) out += `<span class="text-white">${escape(v.slice(1))}</span>`;
      else out += escape(v);
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
      el.innerHTML = frame(stepRef.current, (now - start) / 1000, cols, rows);
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

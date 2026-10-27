"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// iOS install choreography (from the portfolio): a dot appears, grows into a hollow ring,
// the ring fills clockwise like a pie, then the full circle punches through the veil.
const DOT_END = 250;
const RING_END = 700;
const FILL_END = 2100;
const REVEAL_MS = 380;

// `loaded`: the real icon replaces the grey blueprint (dimmed under the veil) for the last part of the fill.
type Install = { size: number; progress: number; reveal: number; done: boolean; loaded: boolean };
const START: Install = { size: 0, progress: 1, reveal: 0, done: false, loaded: false };
const LOADED_AT = FILL_END - 450;

function useInstall() {
  const [s, setS] = useState<Install>(START);
  const raf = useRef(0);
  const play = useCallback(() => {
    cancelAnimationFrame(raf.current);
    const t0 = performance.now();
    const step = () => {
      const e = performance.now() - t0;
      const ease = (t: number) => 1 - (1 - t) ** 3;
      if (e < DOT_END) setS({ size: 0.22 * (e / DOT_END), progress: 1, reveal: 0, done: false, loaded: e >= LOADED_AT });
      else if (e < RING_END) setS({ size: 0.22 + 0.78 * ease((e - DOT_END) / (RING_END - DOT_END)), progress: 0, reveal: 0, done: false, loaded: e >= LOADED_AT });
      else if (e < FILL_END) setS({ size: 1, progress: ease((e - RING_END) / (FILL_END - RING_END)), reveal: 0, done: false, loaded: e >= LOADED_AT });
      else {
        const r = Math.min(1, (e - FILL_END) / REVEAL_MS);
        setS({ size: 1, progress: 1, reveal: 1 - (1 - r) ** 2, done: r >= 1, loaded: true });
        if (r >= 1) return;
      }
      raf.current = requestAnimationFrame(step);
    };
    step();
  }, []);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  return { s, play };
}

/** The Sparkflow app icon "installing" like on iOS; replays whenever `replay` changes. */
export function InstallIcon({ replay, label }: { replay: number; label: string }) {
  const { s, play } = useInstall();
  const root = useRef<HTMLSpanElement>(null);
  // First run once the tile scrolls into view, then on every replay (hover).
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        play();
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [play]);
  useEffect(() => {
    if (replay) play();
  }, [replay, play]);
  const vars = { "--p": s.progress, "--s": s.size, "--v": s.reveal } as React.CSSProperties;
  return (
    <span ref={root} className="flex flex-col items-center gap-2.5">
      <span className="install-icon relative grid size-16 place-items-center overflow-hidden rounded-[15px] border border-white/20 bg-gradient-to-b from-[#1c1f26] to-[#050608] shadow-[inset_0_1px_0_rgba(255,255,255,.35),inset_0_-2px_6px_rgba(0,0,0,.6),0_10px_24px_-8px_rgba(0,0,0,.9)]">
        {s.loaded ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" draggable={false} className="absolute inset-0 size-full object-cover" />
            <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_70%_at_30%_0%,rgba(255,255,255,.28),transparent_55%)]" />
          </>
        ) : (
          // Grey app-icon grid while "downloading", as in the portfolio.
          <>
            <svg viewBox="0 0 100 100" aria-hidden className="absolute inset-0 size-full bg-gradient-to-b from-white to-[#ececec]">
              <g fill="none" stroke="#7d7d7d" strokeWidth="0.9">
                <path d="M22 0v100M50 0v100M78 0v100M0 22h100M0 50h100M0 78h100" />
                <path d="M0 0l100 100M100 0L0 100" />
                <circle cx="50" cy="50" r="44" />
                <circle cx="50" cy="50" r="27" />
                <circle cx="50" cy="50" r="17" />
              </g>
            </svg>
            <span className="install-shimmer" />
          </>
        )}
        {!s.done && (
          <>
            <span className="install-veil" style={vars} />
            <span className="install-pie" style={vars} />
          </>
        )}
      </span>
      <span className="text-sm text-ink-200">{s.done ? label : "Installing…"}</span>
    </span>
  );
}

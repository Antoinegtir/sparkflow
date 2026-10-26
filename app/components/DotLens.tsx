"use client";

import { useEffect, useRef } from "react";

const GAP = 22; // dot pitch, same as the CSS grid behind

/**
 * "Attract" effect over the landing's dot grid: around the cursor the dots lean gently
 * toward it, swell a little and turn white. A canvas redraws them; the flat CSS
 * dots are hollowed out underneath through --lx/--ly/--lr on <main>.
 */
export function DotLens() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const main = canvas?.closest<HTMLElement>("[data-landing]");
    if (!canvas || !main) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    let target: { x: number; y: number } | null = null;
    const pos = { x: -9999, y: -9999 };
    let shown = 0;
    // Areas marked data-no-lens (the suggestion list) keep the dots still, with a margin around them.
    const quiet = (x: number, y: number) =>
      [...document.querySelectorAll("[data-no-lens]")].some((el) => {
        const b = el.getBoundingClientRect();
        return x > b.left - 60 && x < b.right + 60 && y > b.top - 40 && y < b.bottom + 40;
      });
    const move = (e: PointerEvent) => {
      if (quiet(e.clientX, e.clientY)) return void (target = null);
      if (!target) Object.assign(pos, { x: e.clientX, y: e.clientY });
      target = { x: e.clientX, y: e.clientY };
    };
    const leave = () => (target = null);
    window.addEventListener("pointermove", move);
    document.addEventListener("pointerleave", leave);

    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      shown += ((target ? 1 : 0) - shown) * 0.1;
      if (target) {
        pos.x += (target.x - pos.x) * 0.16;
        pos.y += (target.y - pos.y) * 0.16;
      }
      const R = 140;
      const r = main.getBoundingClientRect();
      main.style.setProperty("--lx", `${pos.x - r.left}px`);
      main.style.setProperty("--ly", `${pos.y - r.top}px`);
      main.style.setProperty("--lr", `${R * 1.4 * shown}px`);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      if (shown < 0.01) return;
      const css = getComputedStyle(main);
      // White on the dark theme; the light theme sets --lens-dot (near-black).
      const accent = css.getPropertyValue("--lens-dot").trim() || "#ffffff";
      const base = css.getPropertyValue("--dot").trim() || "rgba(255,255,255,.07)";

      const ox = r.left + GAP / 2;
      const oy = r.top + GAP / 2;
      const reach = R * 1.4;
      for (let i = Math.floor((pos.x - reach - ox) / GAP); i <= Math.ceil((pos.x + reach - ox) / GAP); i++) {
        for (let j = Math.floor((pos.y - reach - oy) / GAP); j <= Math.ceil((pos.y + reach - oy) / GAP); j++) {
          const x = ox + i * GAP;
          const y = oy + j * GAP;
          const dx = x - pos.x;
          const dy = y - pos.y;
          const dist = Math.hypot(dx, dy);
          const d = dist / R;
          if (d > 1.4) continue;
          // Smooth falloff: 1 at the cursor, 0 at the edge (smoothstep).
          const f = Math.max(0, 1 - d);
          const t = f * f * (3 - 2 * f) * shown;
          // Lean toward the cursor and swell a little.
          const pull = 0.22 * t;
          const px = x - dx * pull;
          const py = y - dy * pull;
          const size = 1 + 0.8 * t;
          // Color: blend from the flat dot to white with the falloff.
          ctx.globalAlpha = 1;
          ctx.fillStyle = base;
          ctx.beginPath();
          ctx.arc(px, py, size, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.75 * t;
          ctx.fillStyle = accent;
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-0 h-screen w-screen" />;
}

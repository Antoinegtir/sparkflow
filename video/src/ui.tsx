import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, ease, mono, sans } from "./theme";

/** Night background: a slow blue/violet glow drifting over a dot grid. */
export function Backdrop({ hue = 0 }: { hue?: number }) {
  const f = useCurrentFrame();
  const x = 50 + Math.sin(f / 90) * 12;
  const y = 40 + Math.cos(f / 110) * 10;
  return (
    <AbsoluteFill style={{ background: C.bg, filter: hue ? `hue-rotate(${hue}deg)` : undefined }}>
      <AbsoluteFill style={{ background: `radial-gradient(60% 55% at ${x}% ${y}%, rgba(10,132,255,.22), transparent 70%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(45% 45% at ${100 - x}% ${100 - y}%, rgba(139,92,246,.16), transparent 70%)` }} />
      <AbsoluteFill
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,.07) 1.2px, transparent 1.2px)",
          backgroundSize: "34px 34px",
          maskImage: "radial-gradient(70% 70% at 50% 50%, black, transparent)",
        }}
      />
    </AbsoluteFill>
  );
}

export function Kicker({ children, color = C.sky, style }: { children: ReactNode; color?: string; style?: CSSProperties }) {
  return (
    <div style={{ fontFamily: mono, fontSize: 22, letterSpacing: 4, textTransform: "uppercase", color, ...style }}>{children}</div>
  );
}

/** A line of text that rises and unblurs in. */
export function Reveal({ at, children, style, y = 40 }: { at: number; children: ReactNode; style?: CSSProperties; y?: number }) {
  const f = useCurrentFrame();
  const p = ease(f, at, 22);
  return (
    <div style={{ opacity: p, transform: `translateY(${(1 - p) * y}px)`, filter: `blur(${(1 - p) * 12}px)`, ...style }}>{children}</div>
  );
}

/** iPhone-like device: 393×852 pt screen, scaled. `android` draws a punch-hole phone instead. */
export function Phone({
  children,
  scale = 1,
  android,
  glow,
  style,
}: {
  children: ReactNode;
  scale?: number;
  android?: boolean;
  glow?: string | null;
  style?: CSSProperties;
}) {
  const w = android ? 412 : 393;
  const h = android ? 900 : 852;
  const r = android ? 44 : 58;
  return (
    <div style={{ width: w * scale, height: h * scale, position: "relative", ...style }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: w + 24,
          height: h + 24,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          margin: -12 * scale,
          borderRadius: r + 12,
          padding: 12,
          background: "linear-gradient(145deg, #3a3f48, #0d0f13 40%, #23272e)",
          boxShadow: `0 0 0 1.5px rgba(255,255,255,.14) inset, 0 60px 120px -30px rgba(0,0,0,.9)${glow ? `, 0 0 120px -10px ${glow}` : ""}`,
        }}>
        <div style={{ position: "relative", width: w, height: h, borderRadius: r, overflow: "hidden", background: "#f2f4f8", fontFamily: sans }}>
          {children}
          {android ? (
            <div style={{ position: "absolute", top: 14, left: w / 2 - 9, width: 18, height: 18, borderRadius: 9, background: "#000" }} />
          ) : (
            <div style={{ position: "absolute", top: 11, left: w / 2 - 63, width: 126, height: 37, borderRadius: 20, background: "#000" }} />
          )}
          <StatusBar android={android} />
        </div>
      </div>
    </div>
  );
}

function StatusBar({ android }: { android?: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        top: android ? 12 : 18,
        left: android ? 26 : 44,
        right: android ? 26 : 36,
        display: "flex",
        justifyContent: "space-between",
        fontSize: android ? 15 : 17,
        fontWeight: 600,
        color: "#111",
      }}>
      <span>9:41</span>
      <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ width: 18, height: 11, borderRadius: 2, background: "#111", opacity: 0.85 }} />
        <span style={{ width: 25, height: 12, borderRadius: 4, border: "1.5px solid #111", position: "relative" }}>
          <span style={{ position: "absolute", inset: 1.5, right: 5, background: "#111", borderRadius: 2 }} />
        </span>
      </span>
    </div>
  );
}

/** The demo app the video builds: a habit tracker. `t` (0..1) reveals it card by card. */
export function HabitApp({ t = 1, accent = C.blue, big = 0, glass = false, broken = 0 }: { t?: number; accent?: string; big?: number; glass?: boolean; broken?: number }) {
  const habits = [
    { name: "Morning run", meta: "5 km · 7:00", done: true, emoji: "🏃" },
    { name: "Read 20 pages", meta: "Atomic Habits", done: true, emoji: "📚" },
    { name: "Meditate", meta: "10 min", done: false, emoji: "🧘" },
    { name: "Drink water", meta: "6 / 8 glasses", done: false, emoji: "💧" },
  ];
  const vis = (i: number) => interpolate(t, [i * 0.18, i * 0.18 + 0.3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: glass ? `linear-gradient(160deg, #cfe3ff 0%, #e9ddff 45%, #ffe1ec 100%)` : "#f2f4f8",
        padding: "70px 22px 0",
        color: "#0b0d12",
      }}>
      <div style={{ opacity: vis(0), fontSize: 15, fontWeight: 600, color: "#6b7380", marginTop: 8 }}>TUESDAY, OCTOBER 28</div>
      <div style={{ opacity: vis(0), fontSize: 38, fontWeight: 800, letterSpacing: -1, marginBottom: 16 }}>Today</div>
      <div
        style={{
          opacity: vis(0.5),
          borderRadius: 24,
          padding: 18,
          marginBottom: 14,
          color: "white",
          background: `linear-gradient(135deg, ${accent}, ${C.violet})`,
          boxShadow: `0 14px 30px -12px ${accent}`,
          transform: broken ? `translateX(${broken * 46}px)` : undefined,
        }}>
        <div style={{ fontSize: 14, opacity: 0.85, fontWeight: 600 }}>Streak</div>
        <div style={{ fontSize: 34, fontWeight: 800 }}>12 days 🔥</div>
        <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,.3)", marginTop: 10 }}>
          <div style={{ width: "50%", height: "100%", borderRadius: 4, background: "white" }} />
        </div>
      </div>
      {habits.map((h, i) => (
        <div
          key={h.name}
          style={{
            opacity: vis(i + 1),
            transform: `translateY(${(1 - vis(i + 1)) * 20}px)`,
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "14px 16px",
            marginBottom: 10,
            borderRadius: 20,
            background: glass ? "rgba(255,255,255,.45)" : "white",
            border: glass ? "1px solid rgba(255,255,255,.7)" : "1px solid #e6e9ef",
            backdropFilter: glass ? "blur(20px) saturate(180%)" : undefined,
            boxShadow: glass ? "inset 0 1px 0 rgba(255,255,255,.9), 0 10px 24px -14px rgba(40,40,90,.4)" : undefined,
          }}>
          <div style={{ fontSize: 26 }}>{h.emoji}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{h.name}</div>
            <div style={{ fontSize: 14, color: "#6b7380" }}>{h.meta}</div>
          </div>
          <div
            style={{
              width: 34 + big * 14,
              height: 34 + big * 14,
              borderRadius: 20,
              display: "grid",
              placeItems: "center",
              color: "white",
              fontSize: 18 + big * 6,
              fontWeight: 800,
              background: h.done ? accent : "transparent",
              border: h.done ? "none" : `2.5px solid ${accent}55`,
            }}>
            {h.done ? "✓" : ""}
          </div>
        </div>
      ))}
      <TabBar glass={glass} accent={accent} t={vis(4)} />
    </div>
  );
}

function TabBar({ glass, accent, t }: { glass: boolean; accent: string; t: number }) {
  const tabs = ["Today", "Stats", "Profile"];
  return (
    <div
      style={{
        position: "absolute",
        left: glass ? 40 : 0,
        right: glass ? 40 : 0,
        bottom: glass ? 26 : 0,
        height: glass ? 64 : 84,
        borderRadius: glass ? 32 : 0,
        opacity: t,
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        paddingBottom: glass ? 0 : 20,
        background: glass ? "rgba(255,255,255,.35)" : "white",
        borderTop: glass ? undefined : "1px solid #e6e9ef",
        border: glass ? "1px solid rgba(255,255,255,.75)" : undefined,
        backdropFilter: glass ? "blur(24px) saturate(200%)" : undefined,
        boxShadow: glass ? "inset 0 1px 0 rgba(255,255,255,.95), inset 0 -1px 0 rgba(255,255,255,.3), 0 18px 40px -16px rgba(30,30,80,.45)" : undefined,
      }}>
      {tabs.map((x, i) => (
        <div key={x} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: i === 0 ? accent : "#8e97a6", fontSize: 12, fontWeight: 600 }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: i === 0 ? accent : "#c9ced8" }} />
          {x}
        </div>
      ))}
    </div>
  );
}

/** A glassy pill, the video's chip. */
export function Chip({ children, color = C.ink100, style }: { children: ReactNode; color?: string; style?: CSSProperties }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 22px",
        borderRadius: 999,
        fontFamily: sans,
        fontSize: 26,
        fontWeight: 600,
        color,
        background: "rgba(255,255,255,.06)",
        border: "1px solid rgba(255,255,255,.14)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.12)",
        ...style,
      }}>
      {children}
    </div>
  );
}

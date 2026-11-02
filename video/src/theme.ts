import { loadFont } from "@remotion/fonts";
import { Easing, interpolate, spring, staticFile } from "remotion";

export const FPS = 30;

export const C = {
  bg: "#05070b",
  ink100: "#f1f4f8",
  ink300: "#b4bcc8",
  ink400: "#8e97a6",
  ink500: "#6b7380",
  ink700: "#1f2631",
  ink800: "#141922",
  blue: "#0a84ff",
  sky: "#64d2ff",
  violet: "#8b5cf6",
  green: "#30d158",
  red: "#ff453a",
  amber: "#ffd60a",
};

// Variable fonts bundled in public/: renders need no network.
export const sans = "Inter";
export const mono = "JetBrains Mono";
void loadFont({ family: sans, url: staticFile("fonts/inter.woff2"), weight: "100 900" });
void loadFont({ family: mono, url: staticFile("fonts/mono.woff2"), weight: "100 800" });

/** 0 → 1 over [from, from + dur] frames, eased out. */
export const ease = (frame: number, from: number, dur: number) =>
  interpolate(frame, [from, from + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });

export const pop = (frame: number, from: number, damping = 14) => spring({ frame: frame - from, fps: FPS, config: { damping, mass: 0.8 } });

/** Fade in at the start of a scene and out at its end. */
export const sceneFade = (frame: number, dur: number, edge = 12) =>
  interpolate(frame, [0, edge, dur - edge, dur], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

export const gradientText = {
  backgroundImage: `linear-gradient(100deg, ${C.ink100} 10%, ${C.sky} 55%, ${C.violet} 95%)`,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
} as const;

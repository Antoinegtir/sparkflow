import { Appearance, Platform, useColorScheme } from "react-native";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { persistStorage } from "@/lib/storage";
import theme from "../theme.json";
import { buildPalettes, luminance, type Palette } from "./palette";

export const palettes = buildPalettes(theme);
export const radius = palettes.radius;
const web = Platform.OS === "web";
type Key = keyof Palette;

const current = (): Palette => (Appearance.getColorScheme() === "dark" ? palettes.dark : palettes.light);

/** On web, CSS variables keep server render and hydration scheme-agnostic; on native, the live palette. */
export const colors = new Proxy({} as Palette, {
  get: (_t, k: string) => (web ? `var(--sf-c-${k})` : current()[k as Key]),
});

export function useColors(): Palette {
  const scheme = useColorScheme();
  if (web) return colors;
  return scheme === "dark" ? palettes.dark : palettes.light;
}

export function useIsDark() {
  const scheme = useColorScheme();
  const bg = scheme === "dark" ? palettes.dark.background : palettes.light.background;
  return luminance(bg) < 0.2;
}

/** @deprecated use useIsDark() */
export const isDark = () => Appearance.getColorScheme() === "dark";

/** Color with alpha. On web the var(--sf-none, …) wrapper makes react-native-web pass it through untouched. */
export function withAlpha(key: Key, a: number) {
  if (web) return `var(--sf-none, rgb(var(--sf-${key}) / ${a}))`;
  const hex = current()[key].replace("#", "");
  const n = parseInt(hex, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

type Scheme = "system" | "light" | "dark";

function apply(scheme: Scheme) {
  if (web) {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (scheme === "system") root.removeAttribute("data-sf-scheme");
    else root.setAttribute("data-sf-scheme", scheme);
    root.dataset.sfAppScheme = scheme === "system" ? "" : "1";
  } else {
    Appearance.setColorScheme(scheme === "system" ? "auto" : scheme);
  }
}

/** System/Light/Dark preference, persisted. Use it for the Settings segmented control. */
export const useAppearance = create<{ scheme: Scheme; setScheme: (s: Scheme) => void }>()(
  persist(
    (set) => ({
      scheme: "system",
      setScheme: (scheme) => {
        apply(scheme);
        set({ scheme });
      },
    }),
    { name: "sparkflow-appearance", storage: persistStorage, onRehydrateStorage: () => (s) => s && apply(s.scheme) },
  ),
);

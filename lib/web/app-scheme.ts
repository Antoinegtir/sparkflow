import type { ScreenState } from "../shared";

export const APP_SCHEME_KEY = "sparkflow-app-scheme";
export type AppScheme = "light" | "dark";

export const darkStale = (s: ScreenState) => !!s.screenshotUrl && s.dark?.version !== s.version;

/** The screen as seen in a scheme: dark swaps in the dark screenshot and its audit. */
export function inScheme(s: ScreenState, scheme: AppScheme): ScreenState {
  if (scheme === "light" || !s.dark) return s;
  return { ...s, screenshotUrl: s.dark.url, quality: s.dark.quality ? { ...s.dark.quality, version: s.dark.version } : s.quality };
}

export function withScheme(url: string, scheme: AppScheme) {
  const u = new URL(url, "http://x");
  u.searchParams.set("sf-scheme", scheme);
  return url.startsWith("http") ? u.toString() : u.pathname + u.search;
}

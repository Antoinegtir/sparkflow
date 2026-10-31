"use client";

import { isCloud } from "./backend";
import { useSyncExternalStore } from "react";
import { expoGoPath, previewPathFor, type ProjectState } from "@/lib/shared";

export type SimPlatform = "ios" | "android";

/** The last open in the Simulator / emulator, shared by every view that shows it (focus view, Play). */
export type SimOpenState = { phase: "idle" | "opening" | "error"; platform: SimPlatform; started: number; error?: string };

/** First Sparkflow Dev build on this machine, measured: Xcode about 6 minutes, Gradle about 15. */
export const FIRST_BUILD = { ios: "about 6 minutes", android: "about 15 minutes" } as const;

let state: SimOpenState = { phase: "idle", platform: "ios", started: 0 };
let retry: (() => Promise<void>) | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const set = (s: SimOpenState) => {
  state = s;
  for (const l of listeners) l();
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useSimOpen() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

/** Opens the last app again (after a failure). */
export const retrySimOpen = () => retry?.().catch(() => {});
export const dismissSimOpen = () => state.phase === "error" && set({ ...state, phase: "idle", error: undefined });

/** iOS Simulators have UUIDs; anything else is an adb serial. */
const platformOf = (udid: string): SimPlatform => (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(udid) ? "ios" : "android");

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? `HTTP ${r.status}`);
}

/**
 * Opens a generated app in the iOS Simulator or Android emulator at `path`, natively in Sparkflow Dev (built
 * and installed the first time). Progress and failures go to useSimOpen(); the promise rejects on failure.
 */
export async function openInSimulator(udid: string, preview: NonNullable<ProjectState["preview"]>, path: string, route?: string, opts: { quiet?: boolean } = {}) {
  const platform = platformOf(udid);
  const id = ++seq;
  const attempt = async () => {
    // Quiet: the app is already up, only its page changes; no "Opening…" overlay (failures still show).
    if (!opts.quiet) set({ phase: "opening", platform, started: Date.now() });
    try {
      // From the cloud: its Metro through the https tunnel (the plain TCP one doesn't load in Sparkflow Dev).
      const metro = isCloud() ? preview.webUrl : preview.expoGoUrl;
      if (metro && (isCloud() || preview.expoGoUrl)) await post(`/api/sim/${udid}/open`, { url: metro, path: expoGoPath(path, route) });
      else await post(`/api/sim/${udid}/launch`, { url: preview.webUrl + path });
    } catch (e) {
      if (id === seq) set({ phase: "error", platform, started: state.started, error: String((e as Error)?.message ?? e) });
      throw e;
    }
    if (opts.quiet) return;
    // The Simulator takes a moment to bring the app up after the call returns.
    await new Promise((r) => setTimeout(r, 1800));
    if (id === seq) set({ phase: "idle", platform, started: 0 });
  };
  retry = attempt;
  return attempt();
}

/**
 * The app in the cloud, its pages captured on this Mac's Simulator (its calls go to sparkflow here, see
 * BackendShim): each page opened by its link from the cloud's Metro, screenshotted, sent to the cloud.
 */
export async function captureFromCloud(projectId: string, udid: string, state: ProjectState, scheme: "light" | "dark", routes: string[]) {
  const metro = state.preview?.webUrl;
  if (!metro) return 0;
  await post("/api/sim/appearance", { appearance: scheme, udid }).catch(() => {});
  let n = 0;
  for (const [i, route] of routes.entries()) {
    const s = state.screens[route];
    if (!s) continue;
    await post(`/api/sim/${udid}/open`, { url: metro, path: expoGoPath(s.previewPath ?? previewPathFor(route), route) });
    await new Promise((r) => setTimeout(r, i === 0 ? 2500 : 1200));
    const shot = await fetch(`/api/sim/${udid}/frame`, { cache: "no-store" }).then((r) => (r.ok ? r.blob() : null));
    if (!shot) continue;
    const q = new URLSearchParams({ route, scheme });
    await fetch(`/api/projects/${projectId}/sim-shots?${q}`, { method: "POST", body: shot });
    n++;
  }
  return n;
}

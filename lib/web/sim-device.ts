"use client";

import { useEffect, useState } from "react";

export const SIM_CHANGED = "sparkflow-sim-changed";
export type SimDevice = { name: string; platform: "ios" | "android"; points: { width: number; height: number } | null; ipad: boolean; udid: string; input: string | null; stream: boolean };
type SimInfo = { supported: boolean; devices: SimDevice[] };

let shared: Promise<SimInfo> | null = null;
const fetchSim = () => (shared ??= fetch("/api/sim", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ supported: false, devices: [] })));

/**
 * While nothing is booted, look again every 3 s (one fetch for every component), so a device that
 * finishes booting on its own (an Android cold boot outlasts the boot request) shows up by itself.
 */
let watcher: ReturnType<typeof setInterval> | null = null;
function watchForDevice() {
  if (watcher) return;
  watcher = setInterval(() => {
    shared = null;
    void fetchSim().then((i) => {
      if (!i.devices.length) return;
      if (watcher) clearInterval(watcher);
      watcher = null;
      window.dispatchEvent(new Event(SIM_CHANGED));
    });
  }, 3000);
}

/** The booted simulator or Android emulator (one shared fetch, refreshed on the SIM_CHANGED window event). */
export function useSimDevice() {
  const [info, setInfo] = useState<SimInfo | null>(null);
  useEffect(() => {
    if (info?.supported && !info.devices.length) watchForDevice();
  }, [info]);
  useEffect(() => {
    let alive = true;
    const load = () => fetchSim().then((i) => alive && setInfo(i));
    load();
    const refresh = () => {
      shared = null;
      load();
    };
    window.addEventListener(SIM_CHANGED, refresh);
    return () => {
      alive = false;
      window.removeEventListener(SIM_CHANGED, refresh);
    };
  }, []);
  return { supported: info?.supported ?? false, device: info?.devices[0] ?? null, loaded: !!info };
}

"use client";

import { useEffect, useState } from "react";

export const SIM_CHANGED = "sparkflow-sim-changed";
export type SimDevice = { name: string; points: { width: number; height: number } | null; ipad: boolean; udid: string; input: string | null; stream: boolean };
type SimInfo = { supported: boolean; devices: SimDevice[] };

let shared: Promise<SimInfo> | null = null;
const fetchSim = () => (shared ??= fetch("/api/sim", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ supported: false, devices: [] })));

/** The booted simulator (one shared fetch, refreshed on the SIM_CHANGED window event). */
export function useSimDevice() {
  const [info, setInfo] = useState<SimInfo | null>(null);
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

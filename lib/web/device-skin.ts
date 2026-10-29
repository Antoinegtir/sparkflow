"use client";

import { useEffect, useState } from "react";
import type { SimDevice } from "./sim-device";

/** An Android emulator's frame from its SDK skin (see /api/sim/[udid]/skin): sizes in skin pixels. */
export type DeviceSkin = {
  name: string;
  width: number;
  height: number;
  screen: { x: number; y: number; width: number; height: number };
  back: string;
  mask: string | null;
};

const key = (name: string) => `sparkflow-skin:${name}`;
const cached = (name: string): DeviceSkin | null => {
  try {
    return JSON.parse(localStorage.getItem(key(name)) ?? "null");
  } catch {
    return null;
  }
};

/**
 * The frame to draw around this device: kept in the browser per device name, so it shows at once,
 * and still shows while sparkflow isn't running. null for an iOS Simulator or a device without a skin.
 */
export function useDeviceSkin(device: SimDevice | null) {
  const [skin, setSkin] = useState<DeviceSkin | null>(null);
  const name = device?.platform === "android" ? device.name : null;
  useEffect(() => {
    if (!name || !device) return setSkin(null);
    const kept = cached(name);
    setSkin(kept);
    if (kept) return;
    let alive = true;
    fetch(`/api/sim/${device.udid}/skin`)
      .then((r) => (r.ok ? r.json() : null))
      .then((s: DeviceSkin | null) => {
        if (!alive || !s?.back) return;
        setSkin(s);
        try {
          localStorage.setItem(key(name), JSON.stringify(s));
        } catch {}
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [name, device?.udid]); // eslint-disable-line react-hooks/exhaustive-deps
  return skin;
}

"use client";

import { expoGoPath, type ProjectState } from "@/lib/shared";

/**
 * Opens a generated app in the iOS Simulator at `path`: natively in Expo Go (installed on the
 * Simulator the first time), in Safari only if that fails.
 */
export async function openInSimulator(udid: string, preview: NonNullable<ProjectState["preview"]>, path: string, route?: string) {
  const post = (url: string, body: unknown) =>
    fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    });
  const safari = () => post(`/api/sim/${udid}/launch`, { url: preview.webUrl + path });
  if (!preview.expoGoUrl) return safari();
  return post(`/api/sim/${udid}/expo-go`, { url: `${preview.expoGoUrl}/--${expoGoPath(path, route)}` }).catch(safari);
}


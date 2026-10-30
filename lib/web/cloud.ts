"use client";

import { auth, requireSignIn } from "./auth";
import { getBackend, getMode, setBackend, setMode } from "./backend";

/**
 * Sparkflow in the cloud (Cloud Run, sandboxes on Modal), in two regions: the Americas use the US one
 * (closer to Modal and the Muse API too), everyone else Europe. Each region keeps its own projects, and a
 * browser sticks to the one it signed in to.
 */
const REGIONS = {
  us: process.env.NEXT_PUBLIC_SPARKFLOW_CLOUD_URL_US ?? "https://sparkflow-705836289781.us-central1.run.app",
  eu: process.env.NEXT_PUBLIC_SPARKFLOW_CLOUD_URL ?? "https://sparkflow-705836289781.europe-west1.run.app",
};
const nearest = () => {
  try {
    return /^America\//.test(Intl.DateTimeFormat().resolvedOptions().timeZone) ? "us" : "eu";
  } catch {
    return "eu";
  }
};
export const CLOUD_URL = (typeof window === "undefined" ? REGIONS.eu : REGIONS[nearest()]).replace(/\/+$/, "");

/**
 * Uses Sparkflow in the cloud from this browser: signs in (GitHub or Google) if needed, trades the
 * sign-in for a session key with the cloud server, and makes it this site's backend. Returns the
 * day's runs left, or throws with a message to show.
 */
export async function connectCloud(anchor?: Element | null): Promise<{ runsLeft: number; dailyRuns: number }> {
  if (!CLOUD_URL) throw new Error("Sparkflow in the cloud isn't available yet.");
  if (!(await requireSignIn("Sign in to build in the cloud.", anchor))) throw new Error("Sign in to build in the cloud.");
  const idToken = await auth().currentUser!.getIdToken();
  const res = await fetch(`${CLOUD_URL}/api/cloud/session`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken }) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `The cloud answered ${res.status}.`);
  setMode("cloud");
  setBackend({ url: CLOUD_URL, token: json.token, cloud: true });
  return { runsLeft: json.runsLeft, dailyRuns: json.dailyRuns };
}

/**
 * The default: a backend for whoever arrives on the site, in the cloud, unless they chose their Mac.
 * Silent when already signed in (`ask` false); with `ask`, the sign-in menu opens. True once connected.
 */
export async function ensureCloud(ask = false, anchor?: Element | null): Promise<boolean> {
  if (getBackend()) return true;
  if (getMode() === "mac" || !CLOUD_URL) return false;
  await auth().authStateReady();
  if (!auth().currentUser && !ask) return false;
  try {
    await connectCloud(anchor);
    return true;
  } catch {
    return false;
  }
}

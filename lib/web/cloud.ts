"use client";

import { auth, requireSignIn } from "./auth";
import { setBackend } from "./backend";

/** Sparkflow in the cloud (Cloud Run, sandboxes on Modal), set when the site is built. */
export const CLOUD_URL = (process.env.NEXT_PUBLIC_SPARKFLOW_CLOUD_URL ?? "").replace(/\/+$/, "");

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
  setBackend({ url: CLOUD_URL, token: json.token, cloud: true });
  return { runsLeft: json.runsLeft, dailyRuns: json.dailyRuns };
}

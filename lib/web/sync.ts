"use client";

import type { Backend } from "./backend";
import { cloudSession } from "./cloud";

/**
 * One source for an app between the cloud and the Mac: the whole project (git history, pages,
 * screenshots) moves to the side it's opened on. Histories only grow, so the side with more events is
 * the newer one; the last one used wins.
 */

const call = (b: Backend, path: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  headers.set("x-sparkflow-token", b.token);
  return fetch(b.url + path, { ...init, headers });
};

/** How far the project's history goes on that side; null when it doesn't have it. */
async function eventsOn(b: Backend, id: string): Promise<number | null> {
  const r = await call(b, `/api/projects/${encodeURIComponent(id)}/sync?head=1`, { cache: "no-store" }).catch(() => null);
  if (!r?.ok) return null;
  return ((await r.json()) as { events: number }).events;
}

/** Copies the project from one side to the other; its address (slug) there. */
export async function moveProject(from: Backend, to: Backend, id: string): Promise<string> {
  const r = await call(from, `/api/projects/${encodeURIComponent(id)}/sync`, { cache: "no-store" });
  if (!r.ok) throw new Error(`Could not read the app (${r.status})`);
  const pkg = (await r.json()) as { shots: string[] };
  const put = await call(to, "/api/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(pkg) });
  const json = await put.json().catch(() => ({}));
  if (!put.ok) throw new Error(json.error ?? `Could not bring the app over (${put.status})`);
  const { slug, missing } = json as { slug: string; missing: string[] };
  // Screenshots one by one, a few at a time.
  const queue = [...missing];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let name = queue.shift(); name; name = queue.shift()) {
        const png = await call(from, `/api/projects/${encodeURIComponent(id)}/shots/${encodeURIComponent(name)}`).then((x) => (x.ok ? x.blob() : null)).catch(() => null);
        if (png) await call(to, `/api/sync/shot?id=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}`, { method: "POST", body: png }).catch(() => {});
      }
    }),
  );
  return slug;
}

/**
 * Opening an app on the Mac: brings the cloud's version first when it's newer (worked on in the cloud
 * meanwhile), or sends the Mac's after when the cloud is behind. Quiet when not signed in.
 */
export async function reconcile(mac: Backend, id: string, onPull?: () => void): Promise<void> {
  const cloud = await cloudSession();
  if (!cloud) return;
  const [here, there] = await Promise.all([eventsOn(mac, id), eventsOn(cloud, id)]);
  if (there !== null && (here === null || there > here)) {
    onPull?.();
    await moveProject(cloud, mac, id).catch(() => {});
  } else if (here !== null && (there === null || here > there)) void moveProject(mac, cloud, id).catch(() => {});
}

/** An app of the cloud's, found by its address, brought to the Mac (opened there for the first time). */
export async function pullBySlug(mac: Backend, slug: string): Promise<string | null> {
  const cloud = await cloudSession();
  if (!cloud) return null;
  const list = await call(cloud, "/api/projects", { cache: "no-store" }).then((r) => (r.ok ? (r.json() as Promise<{ id: string; slug: string }[]>) : [])).catch(() => []);
  const p = list.find((x) => x.slug === slug) ?? list.find((x) => x.id === slug);
  if (!p) return null;
  await moveProject(cloud, mac, p.id);
  return p.id;
}

/** After a run on the Mac: the cloud gets the new code, for when the Mac is off. */
export async function pushToCloud(mac: Backend, id: string): Promise<void> {
  const cloud = await cloudSession();
  if (cloud) await moveProject(mac, cloud, id).catch(() => {});
}

const CARRY = "sparkflow.carry";

/** Leaving an app in the cloud for the Mac: remembered until the Mac answers (after the onboarding). */
export function carryToMac(from: Backend, id: string) {
  try {
    localStorage.setItem(CARRY, JSON.stringify({ from, id }));
  } catch {}
}

/** The app being carried over, brought to the Mac now; its address there, or null with nothing to carry. */
export async function takeCarry(mac: Backend): Promise<string | null> {
  let carry: { from: Backend; id: string } | null = null;
  try {
    carry = JSON.parse(localStorage.getItem(CARRY) ?? "null");
    localStorage.removeItem(CARRY);
  } catch {}
  if (!carry?.from?.url || !carry.id) return null;
  return moveProject(carry.from, mac, carry.id);
}

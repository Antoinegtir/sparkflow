"use client";

import { collection, deleteDoc, doc, getDocs, getFirestore, setDoc } from "firebase/firestore";
import type { ProjectSummary } from "@/lib/shared";
import { firebaseApp } from "./auth";
import { apiFetch } from "./backend";

/**
 * The apps of a signed-in user, saved to their account (Firestore users/{uid}/apps/{projectId}) whenever
 * the site reaches their computer, so My apps still lists them when `sparkflow` isn't running. Only what
 * the card shows is kept: name, status, size and a small JPEG of the cover.
 */
export type SavedApp = Pick<ProjectSummary, "id" | "slug" | "name" | "status" | "screenCount" | "createdAt" | "native" | "previewDevice"> & {
  /** data: URL of the cover, about 240 px wide. */
  cover?: string;
  /** The cover URL it was made from: unchanged covers aren't encoded again. */
  coverKey?: string;
  updatedAt: number;
};

const apps = (uid: string) => collection(getFirestore(firebaseApp()), "users", uid, "apps");

export async function loadSavedApps(uid: string): Promise<SavedApp[]> {
  const snap = await getDocs(apps(uid));
  return snap.docs.map((d) => ({ ...(d.data() as Omit<SavedApp, "id">), id: d.id })).sort((a, b) => b.createdAt - a.createdAt);
}

/** A small JPEG data URL of a cover served by the computer (it can't be loaded from the site later). */
async function thumbnail(coverUrl: string): Promise<string | undefined> {
  const res = await apiFetch(coverUrl).catch(() => null);
  if (!res?.ok) return undefined;
  const bmp = await createImageBitmap(await res.blob()).catch(() => null);
  if (!bmp) return undefined;
  const w = 240;
  const h = Math.round((bmp.height / bmp.width) * w);
  const canvas = Object.assign(document.createElement("canvas"), { width: w, height: h });
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return canvas.toDataURL("image/jpeg", 0.72);
}

/** Mirrors the computer's apps into the account: new and changed ones written, deleted ones removed. */
export async function saveApps(uid: string, projects: ProjectSummary[]) {
  const saved = new Map((await loadSavedApps(uid)).map((a) => [a.id, a]));
  for (const p of projects) {
    const old = saved.get(p.id);
    saved.delete(p.id);
    const cover = p.coverUrl && old?.coverKey === p.coverUrl ? old.cover : p.coverUrl ? await thumbnail(p.coverUrl) : undefined;
    const next: Omit<SavedApp, "id"> = {
      slug: p.slug,
      name: p.name,
      status: p.status,
      screenCount: p.screenCount,
      createdAt: p.createdAt,
      ...(p.native ? { native: true } : {}),
      ...(p.previewDevice ? { previewDevice: p.previewDevice } : {}),
      ...(cover ? { cover, coverKey: p.coverUrl } : {}),
      updatedAt: Date.now(),
    };
    const same = old && JSON.stringify({ ...old, id: undefined, updatedAt: 0 }) === JSON.stringify({ ...next, updatedAt: 0 });
    if (!same) await setDoc(doc(apps(uid), p.id), next);
  }
  for (const id of saved.keys()) await deleteDoc(doc(apps(uid), id));
}

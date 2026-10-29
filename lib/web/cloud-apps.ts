"use client";

import { collection, deleteDoc, doc, getDocs, getFirestore, setDoc, updateDoc } from "firebase/firestore";
import { deleteObject, getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import type { ProjectSummary } from "@/lib/shared";
import { firebaseApp } from "./auth";
import { apiFetch } from "./backend";

/**
 * The apps of a signed-in user, saved to their account (Firestore users/{uid}/apps/{bundleId}) whenever
 * the site reaches their computer, so My apps still lists them when `sparkflow` isn't running. Only what
 * the card shows is kept: name, status, size, and the link to a small JPEG of the cover, which is in
 * Cloud Storage under the app's bundle ID (users/{uid}/covers/com.sparkflow.wander.jpg), not in the document.
 */
export type SavedApp = Pick<ProjectSummary, "id" | "slug" | "name" | "status" | "screenCount" | "createdAt" | "native" | "previewDevice" | "bundleId"> & {
  /** Download URL of the cover (Cloud Storage), about 240 px wide. */
  cover?: string;
  /** The cover URL it was made from: unchanged covers aren't encoded again. */
  coverKey?: string;
  /** The app's id on the computer (the document is named after its bundle ID). */
  projectId?: string;
  updatedAt: number;
};

const apps = (uid: string) => collection(getFirestore(firebaseApp()), "users", uid, "apps");

export async function loadSavedApps(uid: string): Promise<SavedApp[]> {
  const snap = await getDocs(apps(uid));
  const list = snap.docs.map((d) => ({ ...(d.data() as Omit<SavedApp, "id">), id: d.id })).sort((a, b) => b.createdAt - a.createdAt);
  // Covers saved inline (data: URLs, before Cloud Storage) move there now, without the computer.
  await Promise.all(
    list.filter((a) => a.cover?.startsWith("data:")).map(async (a) => {
      const url = await uploadCover(uid, coverName(a), await (await fetch(a.cover!)).blob()).catch(() => undefined);
      if (!url) return;
      a.cover = url;
      await updateDoc(doc(apps(uid), a.id), { cover: url }).catch(() => {});
    }),
  );
  return list;
}

/** Puts a cover JPEG in Cloud Storage; its download URL. */
async function uploadCover(uid: string, name: string, jpeg: Blob) {
  const r = coverRef(uid, name);
  await uploadBytes(r, jpeg, { contentType: "image/jpeg", cacheControl: "public, max-age=31536000" });
  return getDownloadURL(r);
}

const coverRef = (uid: string, name: string) => ref(getStorage(firebaseApp()), `users/${uid}/covers/${name}.jpg`);
/** The cover's file name: the app's bundle ID (the project id for apps saved before it was known). */
const coverName = (a: { id: string; bundleId?: string }) => a.bundleId ?? a.id;

/**
 * A small JPEG of a cover served by the computer (it can't be loaded from the site later), uploaded to
 * Cloud Storage; its download URL, or undefined if it couldn't be made or stored.
 */
async function storeCover(uid: string, name: string, coverUrl: string): Promise<string | undefined> {
  const jpeg = await thumbnail(coverUrl);
  if (!jpeg) return undefined;
  return uploadCover(uid, name, jpeg).catch(() => undefined);
}

async function thumbnail(coverUrl: string): Promise<Blob | undefined> {
  const res = await apiFetch(coverUrl).catch(() => null);
  if (!res?.ok) return undefined;
  const bmp = await createImageBitmap(await res.blob()).catch(() => null);
  if (!bmp) return undefined;
  const w = 240;
  const h = Math.round((bmp.height / bmp.width) * w);
  const canvas = Object.assign(document.createElement("canvas"), { width: w, height: h });
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return new Promise((done) => canvas.toBlob((b) => done(b ?? undefined), "image/jpeg", 0.72));
}

/**
 * Mirrors the computer's apps into the account: new and changed ones written, deleted ones removed.
 * Each is saved under its bundle ID (users/{uid}/apps/com.sparkflow.wander), with the computer's
 * project id inside; apps saved before under that project id move.
 */
export async function saveApps(uid: string, projects: ProjectSummary[]) {
  const saved = await loadSavedApps(uid);
  const written = new Set<string>();
  for (const p of projects) {
    const old = saved.find((a) => a.projectId === p.id) ?? saved.find((a) => a.id === p.id);
    // A computer that doesn't send the bundle ID yet keeps the saved one.
    const bundleId = p.bundleId ?? old?.bundleId;
    const key = bundleId ?? p.id;
    written.add(key);
    // Unchanged covers are kept; a new bundle ID moves the cover to its new name.
    const moved = !!old && coverName(old) !== key;
    const kept = p.coverUrl && old?.coverKey === p.coverUrl && old.cover && !old.cover.startsWith("data:") && !moved ? old.cover : undefined;
    const cover = kept ?? (p.coverUrl ? await storeCover(uid, key, p.coverUrl) : undefined);
    const next: Omit<SavedApp, "id"> = {
      projectId: p.id,
      slug: p.slug,
      name: p.name,
      status: p.status,
      screenCount: p.screenCount,
      createdAt: p.createdAt,
      ...(p.native ? { native: true } : {}),
      ...(p.previewDevice ? { previewDevice: p.previewDevice } : {}),
      ...(bundleId ? { bundleId } : {}),
      ...(cover ? { cover, coverKey: p.coverUrl } : {}),
      updatedAt: Date.now(),
    };
    const same = old?.id === key && JSON.stringify({ ...old, id: undefined, updatedAt: 0 }) === JSON.stringify({ ...next, updatedAt: 0 });
    if (!same) await setDoc(doc(apps(uid), key), next);
  }
  // Gone from the computer, or moved to another name: removed, with a cover no saved app uses any more.
  for (const a of saved.filter((a) => !written.has(a.id))) {
    await deleteDoc(doc(apps(uid), a.id));
    if (!written.has(coverName(a))) await deleteObject(coverRef(uid, coverName(a))).catch(() => {});
  }
}

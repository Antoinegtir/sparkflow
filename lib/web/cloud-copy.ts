"use client";

import { doc, getDoc } from "firebase/firestore";
import { getBlob, getDownloadURL, getStorage, ref } from "firebase/storage";
import type { CloudSnapshot } from "@/lib/share/cloud";
import { auth, db, firebaseApp } from "./auth";

export type { CloudSnapshot };

/**
 * A shared project's read-only cloud copy (written by the owner's server, lib/share/cloud.ts), for when
 * their computer is offline: its pages and links, with each screenshot's download link. null when
 * there is none, or you aren't one of its members (the rules refuse).
 */
export async function loadCloudCopy(serverUid: string, projectId: string): Promise<(CloudSnapshot & { urls: Record<string, { shot?: string; dark?: string }>; updatedAt: number | null }) | null> {
  await auth().authStateReady();
  if (!auth().currentUser) return null;
  const base = `servers/${serverUid}/projects/${projectId}`;
  const meta = await getDoc(doc(db(), base)).catch(() => null);
  if (!meta?.exists()) return null;
  const storage = getStorage(firebaseApp());
  const blob = await getBlob(ref(storage, `${base}/snapshot.json`)).catch(() => null);
  if (!blob) return null;
  const snap = JSON.parse(await blob.text()) as CloudSnapshot;
  const urls: Record<string, { shot?: string; dark?: string }> = {};
  await Promise.all(
    snap.order.map(async (r) => {
      const s = snap.screens[r];
      const [shot, dark] = await Promise.all(
        [s?.shot, s?.dark].map((n) => (n ? getDownloadURL(ref(storage, `${base}/shots/${n}`)).catch(() => undefined) : undefined)),
      );
      urls[r] = { ...(shot ? { shot } : {}), ...(dark ? { dark } : {}) };
    }),
  );
  const at = meta.get("updatedAt");
  return { ...snap, urls, updatedAt: at?.toMillis?.() ?? snap.at ?? null };
}

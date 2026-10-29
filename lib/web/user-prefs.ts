"use client";

import type { User } from "firebase/auth";
import { doc, getDoc, getFirestore, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { firebaseApp, watchUser } from "./auth";

/**
 * A signed-in user's preferences, kept in their account (Firestore users/{uid}/settings/prefs) so every
 * computer they use Sparkflow on gets them.
 */
export type Prefs = {
  /** Start of new apps' bundle ID and package: <idPrefix>.<app name>. */
  idPrefix: string;
  /** Who publishes the apps (shown in the stores). */
  developerName: string;
  /** New GitHub repositories are private. */
  repoPrivate: boolean;
  /** Orientation of new apps. */
  orientation: "portrait" | "landscape" | "default";
};

export const DEFAULT_PREFS: Prefs = { idPrefix: "com.sparkflow", developerName: "", repoPrivate: true, orientation: "portrait" };

const ref = (uid: string) => doc(getFirestore(firebaseApp()), "users", uid, "settings", "prefs");

export async function loadPrefs(uid: string): Promise<Prefs> {
  const snap = await getDoc(ref(uid)).catch(() => null);
  return { ...DEFAULT_PREFS, ...(snap?.data() as Partial<Prefs> | undefined) };
}

export async function savePrefs(uid: string, prefs: Prefs) {
  await setDoc(ref(uid), { ...prefs, updatedAt: Date.now() });
}

/** The signed-in user and their preferences (defaults while signed out or loading). */
export function useAccount() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  useEffect(
    () =>
      watchUser((u) => {
        setUser(u);
        if (u) void loadPrefs(u.uid).then(setPrefs);
        else setPrefs(DEFAULT_PREFS);
      }),
    [],
  );
  return { user, prefs, setPrefs };
}

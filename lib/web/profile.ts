"use client";

import { updateProfile, type User } from "firebase/auth";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { auth, firebaseApp } from "./auth";

/** Fired after the profile changes, so the topbar avatar redraws (Firebase only reports sign-in changes). */
export const PROFILE_EVENT = "sparkflow:profile";

const SIZE = 256;

/** A square, centered crop of the picture, as a small JPEG. */
async function square(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = Object.assign(document.createElement("canvas"), { width: SIZE, height: SIZE });
  canvas.getContext("2d")!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  return new Promise((done, fail) => canvas.toBlob((b) => (b ? done(b) : fail(new Error("Couldn't read this picture."))), "image/jpeg", 0.85));
}

/**
 * Saves the name and picture on the account itself: the ID token then carries them, and the identity
 * proofs that sharing relies on (lib/web/share.ts) hand them to the servers the user is on.
 */
export async function saveProfile(p: { name?: string; photo?: File | null; providerPhoto?: boolean }): Promise<User> {
  const user = auth().currentUser;
  if (!user) throw new Error("Sign in first.");
  const changes: { displayName?: string; photoURL?: string | null } = {};
  if (p.name !== undefined) changes.displayName = p.name.trim().slice(0, 80);
  if (p.photo) {
    const r = ref(getStorage(firebaseApp()), `users/${user.uid}/avatar/${Date.now()}.jpg`);
    await uploadBytes(r, await square(p.photo), { contentType: "image/jpeg", cacheControl: "public, max-age=31536000" });
    changes.photoURL = await getDownloadURL(r);
  } else if (p.providerPhoto) changes.photoURL = providerPhoto(user);
  await updateProfile(user, changes);
  // A fresh token, so the next proofs carry the new name and picture.
  await user.getIdToken(true);
  dispatchEvent(new Event(PROFILE_EVENT));
  return user;
}

/** The picture of the provider they signed in with (GitHub or Google), to go back to it. */
export const providerPhoto = (user: User) => user.providerData.find((d) => d.photoURL)?.photoURL ?? null;

"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { GithubAuthProvider, GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";

/** Firebase web config of the sparkflow-ai project (public by design: access is ruled by Auth, not by this key). */
const config = {
  apiKey: "AIzaSyAMDcjuxan6MZBdFPDQDd1S6X4b91SWXUI",
  authDomain: "sparkflow-ai.firebaseapp.com",
  projectId: "sparkflow-ai",
  storageBucket: "sparkflow-ai.firebasestorage.app",
  messagingSenderId: "705836289781",
  appId: "1:705836289781:web:9e23085fab59e047b7bfbc",
};

/** The site's Firebase app (Auth, and Firestore for the apps saved to each account). */
export const firebaseApp = () => (getApps().length ? getApp() : initializeApp(config));

const auth = () => getAuth(firebaseApp());

export type Provider = "google" | "github";

export const signIn = (provider: Provider) => signInWithPopup(auth(), provider === "github" ? new GithubAuthProvider() : new GoogleAuthProvider());

export const signOutUser = () => signOut(auth());

export const watchUser = (cb: (u: User | null) => void) => onAuthStateChanged(auth(), cb);

export const SIGNIN_EVENT = "sparkflow:signin-required";
export const SIGNIN_CLOSED = "sparkflow:signin-closed";

/**
 * Resolves true once someone is signed in: right away if they already are, otherwise after the
 * topbar sign-in menu (opened by this call) succeeds. Resolves false if they close it.
 */
export type SignInRequest = { reason: string; anchor: DOMRect | null };

/** `anchor`: the button that needs an account; the menu opens right under it instead of in the topbar. */
export async function requireSignIn(reason: string, anchor?: Element | null): Promise<boolean> {
  const a = auth();
  await a.authStateReady();
  if (a.currentUser) return true;
  return new Promise((resolve) => {
    const stop = watchUser((u) => {
      if (!u) return;
      done(true);
    });
    const onClose = () => done(!!a.currentUser);
    function done(ok: boolean) {
      stop();
      removeEventListener(SIGNIN_CLOSED, onClose);
      resolve(ok);
    }
    addEventListener(SIGNIN_CLOSED, onClose);
    dispatchEvent(new CustomEvent<SignInRequest>(SIGNIN_EVENT, { detail: { reason, anchor: anchor?.getBoundingClientRect() ?? null } }));
  });
}

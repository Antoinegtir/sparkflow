"use client";

import clsx from "clsx";
import type { User } from "firebase/auth";
import { Loader2, LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SIGNIN_CLOSED, SIGNIN_EVENT, signIn, signOutUser, watchUser, type Provider, type SignInRequest } from "@/lib/web/auth";
import { PROFILE_EVENT } from "@/lib/web/profile";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.6 10.6 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4 fill-current" aria-hidden>
      <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.05-.49.05-.49.8.06 1.23.83 1.23.83.72 1.22 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.66 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0Z" />
    </svg>
  );
}

/** Topbar sign-in: Google or GitHub through Firebase Auth; signed in, the user's avatar with a sign-out menu. */
/** `extra`: entries above Sign out (the IDE adds App settings and Profile, which open its Settings). */
export function SignIn({ extra }: { extra?: { label: string; icon: React.ReactNode; onClick: () => void }[] } = {}) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Why the menu opened by itself (building needs an account), shown above the buttons.
  const [reason, setReason] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => watchUser(setUser), []);
  // A new name or picture (Settings › Account): same user object, redrawn.
  const [, redraw] = useState(0);
  useEffect(() => {
    const on = () => redraw((n) => n + 1);
    addEventListener(PROFILE_EVENT, on);
    return () => removeEventListener(PROFILE_EVENT, on);
  }, []);
  useEffect(() => {
    const ask = (e: Event) => {
      const { reason, anchor } = (e as CustomEvent<SignInRequest>).detail;
      setReason(reason);
      setAnchor(anchor);
      setError(null);
      setOpen(true);
    };
    addEventListener(SIGNIN_EVENT, ask);
    return () => removeEventListener(SIGNIN_EVENT, ask);
  }, []);
  // Closing the menu without signing in cancels whatever asked for it.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) {
      setReason(null);
      setAnchor(null);
      dispatchEvent(new CustomEvent(SIGNIN_CLOSED));
    }
    wasOpen.current = open;
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && !menuRef.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  async function go(p: Provider) {
    setBusy(p);
    setError(null);
    try {
      await signIn(p);
      setOpen(false);
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        setError(
          code === "auth/operation-not-allowed"
            ? "This sign-in method isn't enabled yet."
            : code === "auth/account-exists-with-different-credential"
              ? "This email already signs in with another method."
              : "Sign-in failed. Try again.",
        );
      }
    } finally {
      setBusy(null);
    }
  }

  const item = "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-ink-100 transition hover:bg-white/5 disabled:opacity-50";
  const menu = (
    <div
      ref={menuRef}
      className={clsx("w-60 rounded-xl border border-white/10 bg-ink-900 p-1.5 shadow-2xl", anchor ? "fixed z-50" : "absolute right-0 mt-2")}
      // Opened for a button elsewhere on the page (Build app): right under it, right-aligned.
      style={anchor ? { top: anchor.bottom + 8, right: innerWidth - anchor.right } : undefined}>
      {user ? (
        <>
          <div className="truncate px-3 py-2 text-[12px] text-ink-400">{user.email ?? user.displayName}</div>
          {extra?.map((x) => (
            <button
              key={x.label}
              type="button"
              className={item}
              onClick={() => {
                setOpen(false);
                x.onClick();
              }}>
              {x.icon} {x.label}
            </button>
          ))}
          <button type="button" className={item} onClick={() => void signOutUser().then(() => setOpen(false))}>
            <LogOut size={15} /> Sign out
          </button>
        </>
      ) : (
        <>
          {reason && <p className="px-3 pb-2 pt-1.5 text-[12.5px] text-ink-300">{reason}</p>}
          <button type="button" className={item} disabled={!!busy} onClick={() => go("google")}>
            {busy === "google" ? <Loader2 size={16} className="animate-spin" /> : <GoogleIcon />} Continue with Google
          </button>
          <button type="button" className={item} disabled={!!busy} onClick={() => go("github")}>
            {busy === "github" ? <Loader2 size={16} className="animate-spin" /> : <GithubIcon />} Continue with GitHub
          </button>
          {error && <p className="px-3 pb-1 pt-1.5 text-[12px] text-red-400">{error}</p>}
        </>
      )}
    </div>
  );

  return (
    <div ref={ref} className="relative">
      {user ? (
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-[13px] text-ink-200 transition hover:bg-white/5" aria-label="Account">
          {user.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.photoURL} alt="" className="size-6 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <span className="grid size-6 place-items-center rounded-full bg-spark-500 text-[11px] font-semibold text-white">{(user.displayName ?? user.email ?? "?")[0]?.toUpperCase()}</span>
          )}
        </button>
      ) : (
        // On a phone, Start building is the one way in (it asks to sign in first).
        <button type="button" disabled={user === undefined} onClick={() => setOpen((o) => !o)} className="hidden cursor-pointer rounded-lg px-3 py-1.5 text-[13px] text-ink-200 transition hover:bg-white/5 hover:text-ink-100 md:inline-flex">
          Sign in
        </button>
      )}
      {open && (anchor ? createPortal(menu, document.body) : menu)}
    </div>
  );
}

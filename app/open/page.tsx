"use client";

import { useEffect, useState } from "react";

/**
 * Where the "Open on phone" QR code leads. A phone camera always reads an https link, while an
 * exp:// one is only offered when Expo Go is already installed: this page opens Expo Go with the
 * app, or links to install it first.
 */
export default function OpenOnPhone() {
  const [url, setUrl] = useState<string | null>(null);
  const [os, setOs] = useState<"ios" | "android" | "other">("other");
  useEffect(() => {
    const u = new URLSearchParams(location.search).get("u");
    const ok = u && /^exps?:\/\/[\w.-]+(:\d+)?(\/.*)?$/.test(u) ? u : null;
    setUrl(ok);
    setOs(/iPhone|iPad|iPod/.test(navigator.userAgent) ? "ios" : /Android/.test(navigator.userAgent) ? "android" : "other");
    // Expo Go installed: straight into the app.
    if (ok) setTimeout(() => (location.href = ok), 300);
  }, []);
  const store =
    os === "android" ? { label: "Get Expo Go on Google Play", href: "https://play.google.com/store/apps/details?id=host.exp.exponent" } : { label: "Get Expo Go on the App Store", href: "https://apps.apple.com/app/expo-go/id982107779" };

  return (
    <main className="grid min-h-dvh place-items-center bg-ink-950 px-6 text-center text-ink-100">
      <div className="w-full max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="mx-auto mb-5 size-14 rounded-2xl border border-white/15" />
        <h1 className="text-xl font-semibold">Open your app</h1>
        {url ? (
          <>
            <p className="mt-2 text-[14px] text-ink-400">It runs in Expo Go, from your computer: keep your phone on the same Wi‑Fi.</p>
            <a href={url} className="mt-6 block rounded-xl bg-spark-500 px-4 py-3 text-[15px] font-medium text-white">
              Open in Expo Go
            </a>
            <a href={store.href} className="mt-3 block rounded-xl border border-[var(--line)] px-4 py-3 text-[14px] text-ink-200">
              {store.label}
            </a>
            <p className="mt-4 text-[12px] text-ink-500">No Expo Go yet? Install it, come back to this page and tap Open.</p>
          </>
        ) : (
          <p className="mt-2 text-[14px] text-ink-400">This link is incomplete: scan the QR code in Sparkflow again.</p>
        )}
      </div>
    </main>
  );
}

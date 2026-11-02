"use client";

import { ArrowLeft, Sparkles } from "lucide-react";
import { AsciiSpark } from "./AsciiLoader";
import { LoopVideo } from "./LoopVideo";

const ASCII_404 = String.raw`
 _  _    ___   _  _
| || |  / _ \ | || |
| || |_| | | || || |_
|__   _| |_| ||__   _|
   |_|  \___/    |_|
`.slice(1, -1);

/** An app address that matches none of yours: the landing's look, a way back, a way to start one. */
export function AppNotFound({ name }: { name?: string }) {
  return (
    <div data-landing className="relative grid min-h-screen place-items-center overflow-hidden bg-[#0b0d12] px-6 text-center">
      <div className="pointer-events-none absolute left-1/2 top-1/3 size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-spark-500/15 blur-[120px]" />
      {/* The landing's Android and Apple glass logos on each side (wide screens). */}
      <div aria-hidden className="pointer-events-none absolute inset-0 mx-auto hidden max-w-6xl items-center justify-between px-6 lg:flex">
        <LoopVideo className="hero-logo h-56 w-56 -rotate-6" src="/videos/android.mp4" />
        <LoopVideo className="hero-logo h-56 w-56 rotate-6" src="/videos/apple.mp4#t=7.5" />
      </div>
      <div className="relative flex max-w-lg flex-col items-center">
        <AsciiSpark neon className="text-[15px] leading-none" />
        <pre aria-label="404" className="mt-5 select-none font-mono text-[9px] leading-[1.15] text-spark-500 [text-shadow:0_0_12px_color-mix(in_oklab,var(--color-spark-500)_70%,transparent)] sm:text-[12px]">
          {ASCII_404}
        </pre>
        {/* The default app icon from My apps, frozen before the install: there's nothing to install. */}
        <span className="mt-7 flex flex-col items-center gap-2.5">
          <span className="relative grid size-16 place-items-center overflow-hidden rounded-[15px] border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_10px_24px_-8px_rgba(0,0,0,.9)]">
            <svg viewBox="0 0 100 100" aria-hidden className="absolute inset-0 size-full bg-gradient-to-b from-white to-[#ececec]">
              <g fill="none" stroke="#7d7d7d" strokeWidth="0.9">
                <path d="M22 0v100M50 0v100M78 0v100M0 22h100M0 50h100M0 78h100" />
                <path d="M0 0l100 100M100 0L0 100" />
                <circle cx="50" cy="50" r="44" />
                <circle cx="50" cy="50" r="27" />
                <circle cx="50" cy="50" r="17" />
              </g>
            </svg>
            <span className="absolute inset-0 bg-black/45" />
            <span className="relative font-mono text-2xl font-bold text-white">?</span>
          </span>
          <span className="max-w-40 truncate text-sm text-ink-200">{name ?? "Unknown app"}</span>
          <span className="-mt-2 font-mono text-[11px] text-ink-500">not installed</span>
        </span>
        <h1 className="landing-head mt-6 text-balance text-2xl font-semibold text-ink-100 sm:text-3xl">
          {name ? (
            <>
              The app <span className="text-spark-500">{name}</span> doesn't exist
            </>
          ) : (
            "This app doesn't exist"
          )}
        </h1>
        <p className="mt-3 text-balance text-[15px] text-ink-400">It may have been deleted, renamed, or made with another account. Describe it again and Sparkflow builds it in minutes.</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a href="/" className="flex items-center gap-1.5 rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm text-ink-200 transition hover:bg-white/5">
            <ArrowLeft size={15} /> Back to my apps
          </a>
          <a href="/#how" className="flex items-center gap-1.5 rounded-xl bg-spark-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-spark-400">
            <Sparkles size={15} /> Start building
          </a>
        </div>
      </div>
    </div>
  );
}

"use client";

import { ArrowLeft, Sparkles } from "lucide-react";
import { AsciiSpark } from "./AsciiLoader";
import { LoopVideo } from "./LoopVideo";

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
        <p className="landing-head mt-5 text-7xl font-semibold tracking-tight text-ink-100 sm:text-8xl">404</p>
        <h1 className="landing-head mt-3 text-balance text-2xl font-semibold text-ink-100 sm:text-3xl">
          {name ? (
            <>
              No app called <span className="text-spark-500">{name}</span>
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

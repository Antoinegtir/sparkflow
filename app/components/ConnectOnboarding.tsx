"use client";

import clsx from "clsx";
import { ArrowUpRight, Check, Copy, Lock, Terminal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getBackend, setBackend, setMode } from "@/lib/web/backend";
import { carryToMac, takeCarry } from "@/lib/web/sync";
import { DotLens } from "./DotLens";
import { LoopVideo } from "./LoopVideo";

export const INSTALL = "curl -fsSL https://sparkflow-ai.web.app/install.sh | bash";

/** What runs the apps: each opens its official download page. */
export const TOOLS = [
  { name: "Xcode", note: "iOS Simulator", href: "https://apps.apple.com/app/xcode/id497799835", icon: "/tools/xcode.png" },
  { name: "Android Studio", note: "Android emulator", href: "https://developer.android.com/studio", icon: "/tools/android-studio.png" },
];
const POLL_MS = 2000;
/** Where `sparkflow` serves on this computer; /api/connect hands out its tunnel link (see remote.mjs). */
const LOCAL = "http://localhost:3002";

/** True once the connected computer answers: the saved tunnel, or a `sparkflow` just started here. */
async function reachable(): Promise<boolean> {
  // A cloud session isn't the Mac this page waits for.
  if (getBackend() && !getBackend()!.cloud) {
    if (await steady()) return true;
  }
  const link = await fetch(`${LOCAL}/api/connect`, { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<{ url: string; token: string }>) : null))
    .catch(() => null);
  if (!link?.url || !link.token) return false;
  setMode("mac");
  setBackend({ url: link.url, token: link.token });
  return steady();
}

/**
 * A tunnel that just came up can answer once and still fail the next requests for a few seconds:
 * wait for three good answers in a row before handing over to the IDE.
 */
async function steady(): Promise<boolean> {
  for (let i = 0; i < 3; i++) {
    const ok = await fetch("/api/projects", { cache: "no-store" }).then((r) => r.ok).catch(() => false);
    if (!ok) return false;
    await new Promise((r) => setTimeout(r, 700));
  }
  return true;
}

export function CopyLine({ text, small }: { text: string; small?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={clsx("group flex items-center gap-3 rounded-xl border border-[var(--line)] bg-black/40 pr-2 font-mono text-ink-100", small ? "py-1.5 pl-3 text-[11px]" : "py-2.5 pl-4 text-[12.5px]")}>
      <span className="select-none text-ink-500">$</span>
      <span className="min-w-0 flex-1 truncate">{text}</span>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg text-ink-400 transition hover:bg-white/10 hover:text-ink-100"
        aria-label="Copy">
        {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
      </button>
    </div>
  );
}

/**
 * The Mac setup in a few lines, for a menu (the device picker): the tools it needs, as their logos
 * linking to their downloads, the install command, then `sparkflow`.
 */
export function MacSetupMini({ projectId, onFound }: { projectId?: string; onFound?: () => void }) {
  const [found, setFound] = useState(false);
  const found$ = useRef(onFound);
  found$.current = onFound;
  // Listens for sparkflow starting on this Mac: then confetti, and the app opens there (the same code,
  // brought over from the cloud) with its simulators and emulators.
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      const link = await fetch(`${LOCAL}/api/connect`, { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<{ url: string; token: string }>) : null))
        .catch(() => null);
      if (stop) return;
      if (!link?.url || !link.token) return void setTimeout(tick, POLL_MS);
      stop = true;
      setFound(true);
      confetti();
      // From the cloud: the app stays there, the simulators of this Mac show up in the menu.
      if (found$.current) return found$.current();
      // Shown on the Mac side means its link went stale: the app goes back to the cloud, where this
      // menu then lists the Mac's simulators (the code stays in the cloud).
      setMode("cloud");
      setBackend(null);
      setTimeout(() => location.reload(), 900);
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [projectId]);
  return (
    <div className="space-y-2 px-2.5 py-2">
      <div className="flex items-center gap-1.5">
        <span className="mr-1 text-[11px] text-ink-500">One of</span>
        {TOOLS.map((t) => (
          <a
            key={t.name}
            href={t.href}
            target="_blank"
            rel="noreferrer"
            title={`${t.name} (${t.note})`}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white/[0.02] py-1 pr-2 pl-1 text-[11.5px] text-ink-200 transition hover:border-spark-500/50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.icon} alt="" className="size-5 object-contain" />
            {t.name}
            <span className="text-[10px] text-ink-500">opt.</span>
          </a>
        ))}
      </div>
      <p className="text-[11px] text-ink-500">1. Install once</p>
      <CopyLine text={INSTALL} small />
      <p className="text-[11px] text-ink-500">2. Start it, then open this app again</p>
      <CopyLine text="sparkflow" small />
      <div className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-black/20 px-3 py-2 text-[11.5px]">
        {found ? (
          <span className="text-emerald-300">Connected · opening this app on your Mac…</span>
        ) : (
          <>
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-spark-400 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-spark-400" />
            </span>
            <span className="text-ink-300">Waiting for sparkflow…</span>
          </>
        )}
      </div>
    </div>
  );
}

/** A burst of confetti over the whole page, gone after a few seconds. */
function confetti() {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:100";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  const dpr = devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.scale(dpr, dpr);
  const colors = ["#3b82f6", "#60a5fa", "#a78bfa", "#34d399", "#fbbf24", "#f472b6", "#ffffff"];
  const parts = Array.from({ length: 180 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 120,
    y: innerHeight * 0.42,
    vx: (Math.random() - 0.5) * 16,
    vy: -Math.random() * 15 - 5,
    w: 5 + Math.random() * 6,
    h: 3 + Math.random() * 4,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.35,
    c: colors[(Math.random() * colors.length) | 0],
  }));
  const start = performance.now();
  const frame = (now: number) => {
    const t = now - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - 2200) / 1000);
    for (const p of parts) {
      p.vy += 0.38;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (t < 3200) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}

/**
 * Shown when the hosted site has no computer to talk to: how to install and start `sparkflow`,
 * then a live check every 2 s. Once it answers steadily: confetti, and the page reloads into the app.
 */
export function ConnectOnboarding() {
  const [connected, setConnected] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (done.current) return;
      if (await reachable()) {
        done.current = true;
        setConnected(true);
        confetti();
        // A fresh page load once connected: the IDE then starts its live updates and previews on a
        // tunnel that is known to work (opening it in place could leave them failing until a refresh).
        setTimeout(() => location.reload(), 1600);
        return;
      }
      timer = setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => clearTimeout(timer);
  }, []);

  const step = "relative pl-12";
  const num = "absolute left-0 top-0 grid size-8 place-items-center rounded-full border text-[13px] font-semibold";
  return (
    <div
      data-ide
      data-landing="aurora"
      className="relative grid h-dvh place-items-center overflow-hidden bg-ink-950 px-4 py-4 text-ink-100"
      // The landing's dot color ([data-ide] would make them heavier).
      style={{ "--dot": "rgba(255, 255, 255, 0.07)" } as React.CSSProperties}>
      {/* The landing's dot grid and magnifier: flat dots hollowed out where the lens canvas redraws them. */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(var(--dot)_1px,transparent_1px)] [background-size:22px_22px]"
        style={{
          maskImage:
            "radial-gradient(ellipse at center, black, transparent 70%), radial-gradient(circle var(--lr, 0px) at var(--lx, -999px) var(--ly, -999px), transparent 98%, black 100%)",
          maskComposite: "intersect",
          WebkitMaskComposite: "source-in",
        }}
      />
      <DotLens />
      <div className="pointer-events-none absolute left-1/2 top-1/3 size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-spark-500/15 blur-[120px]" />
      {/* The landing's Android and Apple glass logos, on each side of the steps (wide screens only). */}
      {/* Centred with flex, not a transform: a transform isolates the videos, so their screen blend would show black. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 mx-auto hidden max-w-6xl items-center justify-between px-6 lg:flex">
        <LoopVideo className="hero-logo h-56 w-56 -rotate-6" src="/videos/android.mp4" />
        {/* Starts half a turn later (#t=): both loops last 15 s, so they never spin in sync. */}
        <LoopVideo className="hero-logo h-56 w-56 rotate-6" src="/videos/apple.mp4#t=7.5" />
      </div>

      <div className="relative w-full max-w-[520px]">
        <div className="mb-5 flex flex-col items-center text-center">
          <span className="mb-3 grid size-12 place-items-center overflow-hidden rounded-2xl border border-white/15 bg-black shadow-[0_20px_60px_-20px_rgba(59,130,246,.6)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="size-full object-cover" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Connect your computer</h1>
          <p className="mt-2 max-w-sm text-balance text-[14px] leading-relaxed text-ink-400">
            Sparkflow builds and runs your apps on your Mac. Your code and your Muse Spark key never leave it.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)]/90 p-5 shadow-2xl backdrop-blur">
          <ol className="space-y-5">
            <li className={step}>
              <span className={clsx(num, "border-[var(--line)] text-ink-300")}>1</span>
              <p className="mb-1 text-[14px] font-medium">Get the simulators</p>
              <p className="mb-3 text-[12.5px] text-ink-500">Your apps run in them. Skip what you already have.</p>
              <div className="grid grid-cols-2 gap-2">
                {TOOLS.map((t) => (
                  <a
                    key={t.name}
                    href={t.href}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center gap-3 rounded-xl border border-[var(--line)] bg-white/[0.02] px-3 py-2.5 transition hover:border-spark-500/50 hover:bg-spark-500/[0.06]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={t.icon} alt="" className="size-9 shrink-0 object-contain transition group-hover:scale-105" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1 text-[13px] font-medium text-ink-100">
                        {t.name}
                        <ArrowUpRight size={12} className="text-ink-500 transition group-hover:text-spark-400" />
                      </span>
                      <span className="block truncate text-[11.5px] text-ink-500">{t.note}</span>
                    </span>
                  </a>
                ))}
              </div>
            </li>
            <li className={step}>
              <span className={clsx(num, "border-[var(--line)] text-ink-300")}>2</span>
              <p className="mb-1 text-[14px] font-medium">Install it once</p>
              <p className="mb-3 text-[12.5px] text-ink-500">Checks Xcode, Node and the rest, and installs what's missing.</p>
              <CopyLine text={INSTALL} />
            </li>
            <li className={step}>
              <span className={clsx(num, "border-[var(--line)] text-ink-300")}>3</span>
              <p className="mb-1 text-[14px] font-medium">Start it</p>
              <p className="mb-3 text-[12.5px] text-ink-500">Keep the terminal open while you build.</p>
              <CopyLine text="sparkflow" />
            </li>
            <li className={step}>
              <span
                className={clsx(
                  num,
                  "transition-colors duration-500",
                  connected ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-300" : "border-spark-500/40 bg-spark-500/10 text-spark-400",
                )}>
                {connected ? <Check size={15} /> : <Terminal size={14} />}
              </span>
              <div className={clsx("flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors duration-500", connected ? "border-emerald-400/30 bg-emerald-400/10" : "border-[var(--line)] bg-white/[0.02]")}>
                {connected ? (
                  <p className="text-[13.5px] font-medium text-emerald-300">Connected to your computer</p>
                ) : (
                  <>
                    <span className="relative flex size-2.5">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-spark-400 opacity-60" />
                      <span className="relative inline-flex size-2.5 rounded-full bg-spark-400" />
                    </span>
                    <p className="flex-1 text-[13.5px] text-ink-200">Waiting for sparkflow…</p>
                  </>
                )}
              </div>
            </li>
          </ol>
        </div>

        <p className="mt-3 flex items-start justify-center gap-2 text-center text-[12px] leading-relaxed text-ink-500">
          <Lock size={12} className="mt-0.5 shrink-0" />
          If your browser asks to access devices on your local network, allow it: that's how this page finds sparkflow.
        </p>
      </div>
    </div>
  );
}

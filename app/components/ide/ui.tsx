"use client";

import clsx from "clsx";
import { Check, Loader2, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { QualityReport, ScreenState, ScreenStatus } from "@/lib/shared";
import { outerSize, PREVIEW_DEVICES, type PreviewDevice } from "@/lib/web/devices";

type Glow = "spark" | "ok" | "bad" | null;

/** Phone frame: black bezel on top of a rounded, clipped screen. `hardware` adds the titanium band and side keys. */
export function PhoneFrame({
  children,
  width,
  height,
  radius,
  bezel = 6,
  glow,
  hardware,
  ipad,
  android,
  onButton,
  className,
  style,
}: {
  children: ReactNode;
  width: number;
  height: number;
  radius: number;
  bezel?: number;
  glow?: Glow;
  hardware?: boolean;
  ipad?: boolean;
  android?: boolean;
  onButton?: (button: "VOLUME_UP" | "VOLUME_DOWN" | "SIDE_BUTTON", holdMs: number) => void;
  className?: string;
  style?: CSSProperties;
}) {
  const inner = Math.max(2, radius - bezel);
  const glowStyle =
    glow === "spark"
      ? "0 0 0 1px color-mix(in oklab,var(--color-spark-500) 60%,transparent), 0 0 40px -6px var(--color-spark-500)"
      : glow === "bad"
        ? "0 0 0 1px rgba(248,113,113,.6), 0 0 36px -8px rgba(248,113,113,.9)"
        : glow === "ok"
          ? "0 0 0 1px rgba(52,211,153,.5)"
          : "none";
  return (
    <div className={clsx("relative isolate", className)} style={{ width, height, ...style }}>
      {hardware && <Hardware width={width} height={height} radius={radius} bezel={bezel} ipad={ipad} android={android} onButton={onButton} />}
      <div className="absolute inset-0 bg-black" style={{ borderRadius: radius, boxShadow: `var(--phone-shadow), ${glowStyle}` }} />
      <div className="absolute overflow-hidden bg-ink-900" style={{ inset: bezel, borderRadius: inner, clipPath: `inset(0 round ${inner}px)` }}>
        {children}
      </div>
      {/* The bezel is drawn on top to hide anti-aliasing fringes of bright screenshots. */}
      <div className="pointer-events-none absolute inset-0 z-[70]" style={{ borderRadius: radius, boxShadow: `inset 0 0 0 ${bezel}px #000` }} />
    </div>
  );
}

type HwButton = "VOLUME_UP" | "VOLUME_DOWN" | "SIDE_BUTTON";

/**
 * Titanium band and side keys. Keys are placed and sized in % of the phone (like a real iPhone), so they keep
 * their proportions at any size: canvas pages, the focus view and the landing cards.
 */
function Hardware({ radius, bezel, ipad, android, onButton }: { width: number; height: number; radius: number; bezel: number; ipad?: boolean; android?: boolean; onButton?: (b: HwButton, hold: number) => void }) {
  const band = Math.max(1.5, Math.min(bezel * 0.32, 3));
  const key = (side: "left" | "right" | "top", pos: number, len: number, button?: HwButton, title?: string) => (
    <HardwareKey key={`${side}${pos}`} side={side} pos={pos} len={len} band={band} button={button} title={title} onButton={onButton} />
  );
  return (
    <>
      <div className="absolute -z-10" style={{ inset: -band, borderRadius: radius + band, background: "linear-gradient(135deg,#8a8c93,#3c3d42 40%,#9a9ca3 60%,#4a4b50)", boxShadow: "inset 0 0 0 0.5px rgba(255,255,255,.35)" }} />
      {android
        ? // Android (Pixel-style): power key above a long volume rocker, both on the right.
          [key("right", 20, 6), key("right", 30, 13)]
        : ipad
        ? [key("top", 88, 5, "SIDE_BUTTON", "Top button"), key("top", 70, 6, "VOLUME_UP", "Volume up"), key("top", 62, 6, "VOLUME_DOWN", "Volume down")]
        : [
            key("left", 15.5, 3.8, undefined, "Action button (no Simulator equivalent)"),
            key("left", 22, 7.2, "VOLUME_UP", "Volume up"),
            key("left", 31, 7.2, "VOLUME_DOWN", "Volume down"),
            key("right", 25, 11, "SIDE_BUTTON", "Side button"),
          ]}
    </>
  );
}

/** One key: `pos` and `len` in % of the phone's height (left/right) or width (top). Thickness is 1.4% of the width. */
function HardwareKey({ side, pos, len, band, button, title, onButton }: { side: "left" | "right" | "top"; pos: number; len: number; band: number; button?: HwButton; title?: string; onButton?: (b: HwButton, hold: number) => void }) {
  const [down, setDown] = useState(false);
  const t0 = useRef(0);
  // Keys stick out by about their band's thickness, in px: a % of a tall iPad made them far too big.
  const thick = `${Math.max(2, band * 1.1)}px`;
  const out = down ? `-${band}px` : `calc(-${band}px - ${thick})`;
  const style: CSSProperties =
    side === "top"
      ? { top: out, left: `${pos - len / 2}%`, width: `${len}%`, height: thick }
      : { [side]: out, top: `${pos}%`, width: thick, height: `${len}%` };
  const enabled = !!button && !!onButton;
  // Decorative keys (canvas pages, web preview) are plain spans: a button may not sit inside another button.
  if (!onButton) return <span aria-hidden className="absolute -z-20 rounded-[1px]" style={{ ...style, background: "#5c5c63" }} />;
  return (
    <button
      type="button"
      title={title}
      disabled={!enabled}
      onPointerDown={() => {
        if (!enabled) return;
        t0.current = Date.now();
        setDown(true);
      }}
      onPointerUp={() => {
        if (!enabled || !down) return;
        setDown(false);
        onButton!(button!, Date.now() - t0.current);
      }}
      onPointerLeave={() => setDown(false)}
      className={clsx("absolute -z-20 rounded-[1px] transition-all", enabled ? "cursor-pointer" : "cursor-not-allowed")}
      style={{ ...style, background: "#5c5c63" }}
    />
  );
}

export const STATUS_LABEL: Record<ScreenStatus, string> = { pending: "Queued", building: "Building", verifying: "Verifying", done: "Verified", failed: "Needs work" };

export function StatusDot({ status }: { status: ScreenStatus }) {
  return (
    <span
      className={clsx(
        "inline-block size-1.5 shrink-0 rounded-full",
        status === "pending" && "bg-ink-500",
        status === "building" && "animate-pulse-soft bg-violet-400",
        status === "verifying" && "animate-pulse-soft bg-sky-400",
        status === "done" && "bg-emerald-400",
        status === "failed" && "bg-red-400",
      )}
    />
  );
}

export function StatusPill({ screen }: { screen: Pick<ScreenState, "status" | "attempt"> }) {
  const s = screen.status;
  const label = s === "building" && screen.attempt > 1 ? `Building · fix ${screen.attempt - 1}` : STATUS_LABEL[s];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        s === "done" && "border-emerald-400/30 bg-emerald-400/10 text-emerald-400",
        s === "failed" && "border-red-400/30 bg-red-400/10 text-red-400",
        s === "building" && "border-violet-400/30 bg-violet-400/10 text-violet-300",
        s === "verifying" && "border-sky-400/30 bg-sky-400/10 text-sky-300",
        s === "pending" && "border-ink-700 text-ink-400",
      )}>
      {s === "done" ? <Check size={11} /> : s === "failed" ? <X size={11} /> : s === "pending" ? null : <Loader2 size={11} className="animate-spin" />}
      {label}
    </span>
  );
}

export const scoreClass = (score: number) => (score >= 90 ? "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" : score >= 70 ? "text-amber-400 border-amber-400/30 bg-amber-400/10" : "text-red-400 border-red-400/30 bg-red-400/10");

export function QualityBadge({ report, compact }: { report?: QualityReport; compact?: boolean }) {
  if (!report) return null;
  return (
    <span title={`Accessibility ${report.score}/100 · ${report.issues.length} issue(s)`} className={clsx("inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums", scoreClass(report.score))}>
      {compact ? "a11y" : "Accessibility"} {report.score}
    </span>
  );
}

/** Before/after slider over two screenshots. ←/→ move it by 5%. */
export function CompareSlider({ before, after, beforeLabel, afterLabel }: { before: string; after: string; beforeLabel: string; afterLabel: string }) {
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const move = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  };
  return (
    <div
      ref={ref}
      className="relative h-full w-full touch-none select-none"
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        move(e.clientX);
      }}
      onPointerMove={(e) => e.buttons && move(e.clientX)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={after} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover object-top" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={before} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover object-top" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
      <div className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,.5)]" style={{ left: `${pos}%` }}>
        <div
          role="slider"
          tabIndex={0}
          aria-label="Compare versions"
          aria-valuenow={Math.round(pos)}
          aria-valuemin={0}
          aria-valuemax={100}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - 5));
            if (e.key === "ArrowRight") setPos((p) => Math.min(100, p + 5));
          }}
          className="absolute top-1/2 left-1/2 grid size-8 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded-full bg-white text-[10px] font-bold text-black shadow-lg">
          ⇆
        </div>
      </div>
      <span className="absolute top-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">{beforeLabel}</span>
      <span className="absolute top-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">{afterLabel}</span>
    </div>
  );
}

const THEME_EVENT = "sparkflow-theme";
type ThemePref = "system" | "light" | "dark";

function applyTheme(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function cycleTheme() {
  let cur: ThemePref = "system";
  try {
    cur = (localStorage.getItem(THEME_EVENT) as ThemePref) || "system";
  } catch {}
  const next: ThemePref = cur === "system" ? "light" : cur === "light" ? "dark" : "system";
  try {
    localStorage.setItem(THEME_EVENT, next);
  } catch {}
  applyTheme(next);
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: next }));
}

/** System → light → dark. "system" follows the OS live. All toggles stay in sync through a window event. */
export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>("system");
  useEffect(() => {
    try {
      setPref((localStorage.getItem(THEME_EVENT) as ThemePref) || "system");
    } catch {}
    const onChange = (e: Event) => setPref((e as CustomEvent).detail);
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onOs = () => {
      try {
        if ((localStorage.getItem(THEME_EVENT) || "system") === "system") applyTheme("system");
      } catch {}
    };
    window.addEventListener(THEME_EVENT, onChange);
    mq.addEventListener("change", onOs);
    return () => {
      window.removeEventListener(THEME_EVENT, onChange);
      mq.removeEventListener("change", onOs);
    };
  }, []);
  const icon = pref === "light" ? "☀︎" : pref === "dark" ? "☾" : "◐";
  return (
    <button onClick={cycleTheme} title={`Theme: ${pref}`} aria-label={`Sparkflow theme: ${pref}`} className="grid size-8 cursor-pointer place-items-center rounded-lg text-[15px] text-ink-300 hover:bg-ink-800 hover:text-ink-100">
      {icon}
    </button>
  );
}

// iPhone safe areas in points: status bar on top, home indicator at the bottom.
export const SAFE_TOP = 47;
export const SAFE_BOTTOM = 34;

/** iOS status bar. `island` leaves the middle free for the Dynamic Island; a short bar (SE, iPad) is smaller and centred. */
export function StatusBar({ dark, height = SAFE_TOP, island = false, android = false }: { dark: boolean; height?: number; island?: boolean; android?: boolean }) {
  const c = dark ? "#fff" : "#000";
  if (android) {
    // Android: time on the left, wifi, signal and an upright battery on the right, all smaller.
    return (
      <div className="flex items-center justify-between px-[22px] text-[13px] font-medium" style={{ height, color: c }}>
        <span>9:41</span>
        <span className="flex items-center gap-[6px]">
          <svg width="14" height="11" viewBox="0 0 16 12" fill={c} aria-hidden>
            <path d="M8 11.5 0.5 3.4a10.8 10.8 0 0 1 15 0z" />
          </svg>
          <svg width="12" height="12" viewBox="0 0 12 12" fill={c} aria-hidden>
            <path d="M11.5 0.5v11h-11z" />
          </svg>
          <svg width="8" height="13" viewBox="0 0 8 13" fill={c} aria-hidden>
            <rect x="2.5" y="0" width="3" height="1.5" rx="0.5" />
            <rect x="0" y="1.5" width="8" height="11.5" rx="1.3" />
          </svg>
        </span>
      </div>
    );
  }
  const compact = height < 30;
  return (
    <div
      className={clsx("flex items-center justify-between font-semibold", compact ? "px-[8px] text-[12px]" : "px-[30px] text-[16px]")}
      style={{ height, color: c, paddingTop: compact ? 0 : island ? 18 : 14 }}>
      <span className={clsx(island && "w-[100px] text-center")}>9:41</span>
      <span className={clsx("flex items-center justify-end gap-[5px]", island && "w-[100px]")}>
        <svg width="18" height="11" viewBox="0 0 18 11" fill={c} aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={i * 5} y={8 - i * 2.6} width="3" height={3 + i * 2.6} rx="0.8" />
          ))}
        </svg>
        <svg width="16" height="11" viewBox="0 0 16 11" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <path d="M1.5 4a9.5 9.5 0 0 1 13 0M4 6.6a6 6 0 0 1 8 0M6.5 9.2a2.5 2.5 0 0 1 3 0" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12" aria-hidden>
          <rect x="0.5" y="0.5" width="22" height="11" rx="3.2" fill="none" stroke={c} strokeOpacity="0.4" />
          <rect x="2" y="2" width="19" height="8" rx="2" fill={c} />
          <rect x="23.5" y="4" width="1.6" height="4" rx="0.8" fill={c} fillOpacity="0.4" />
        </svg>
      </span>
    </div>
  );
}

export type SafeAreas = { width: number; top: number; bottom: number; island?: boolean; android?: boolean };
/** iPhone 14/15/16 class (390×844): 47 pt status bar, 34 pt home indicator. */
export const IPHONE_SAFE: SafeAreas = { width: 390, top: SAFE_TOP, bottom: SAFE_BOTTOM };

/**
 * A device screen scaled to its box: status bar, the app in between, home indicator. `areas` gives the
 * device's logical width and insets; the default iPhone layout is shared by the canvas pages and the focus
 * view, so a page looks the same before, during and after the hero transition.
 */
/** Is a CSS rgb()/rgba() colour dark (for status bar contrast)? */
export function isDarkColor(c: string) {
  const m = c.match(/\d+(\.\d+)?/g);
  if (!m) return false;
  const [r, g, b] = m.map(Number);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
}

export function SafeAreaScreen({ dark: darkProp, children, areas = IPHONE_SAFE, surface }: { dark: boolean; children: ReactNode; areas?: SafeAreas; surface?: string | null }) {
  // The app's own background wins over the requested scheme: the app may force its appearance.
  const dark = surface ? isDarkColor(surface) : darkProp;
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ scale: 1, height: 844 });
  useLayoutEffect(() => {
    const el = box.current!;
    // Width sets the scale; the height fills the screen exactly so nothing behind shows through.
    const measure = () => {
      const scale = el.clientWidth / areas.width || 1;
      setSize({ scale, height: el.clientHeight / scale });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [areas.width]);
  const bg = surface ?? (dark ? "#0b0b10" : "#ffffff");
  const fg = dark ? "#fff" : "#000";
  return (
    <div ref={box} className="absolute inset-0 overflow-hidden" style={{ background: bg }}>
      <div className="relative flex origin-top-left flex-col" style={{ width: areas.width, height: size.height, transform: `scale(${size.scale})` }}>
        {/* The bars sit above the app and it slides 1 pt under each, so no seam shows at fractional scales. */}
        <div className="relative z-10 shrink-0" style={{ background: bg }}>
          <StatusBar dark={dark} height={areas.top} island={areas.island} android={areas.android} />
        </div>
        <div className="relative -my-px min-h-0 flex-1">{children}</div>
        {areas.bottom > 0 && (
          <div className="relative z-10 flex shrink-0 items-center justify-center" style={{ height: areas.bottom, background: bg }}>
            {/* iOS home indicator, or Android's thinner, shorter gesture handle. */}
            <span className={clsx("rounded-full", areas.android ? "h-[4px]" : "h-[5px]")} style={{ width: Math.round(areas.width * (areas.android ? 0.27 : 0.34)), background: fg, opacity: areas.android ? 0.85 : 1 }} />
          </div>
        )}
        {/* Dynamic Island: 126×37 pt, 11 pt from the top. */}
        {areas.island && <span className="absolute top-[11px] left-1/2 z-20 h-[37px] w-[126px] -translate-x-1/2 rounded-full bg-black" />}
        {/* Android punch-hole front camera. */}
        {areas.android && <span className="absolute left-1/2 z-20 size-[13px] -translate-x-1/2 rounded-full bg-black" style={{ top: Math.round((areas.top - 13) / 2) }} />}
      </div>
    </div>
  );
}

/** iOS activity indicator: 12 spokes fading in turn. */
export function CupertinoSpinner() {
  return (
    <div className="relative size-7">
      {Array.from({ length: 12 }).map((_, i) => (
        <span
          key={i}
          className="absolute top-0 left-[13px] h-2 w-[2.5px] rounded-full bg-white"
          style={{ transform: `rotate(${i * 30}deg)`, transformOrigin: "1.25px 14px", animation: `cupertino-fade 1s linear ${-1 + i / 12}s infinite` }}
        />
      ))}
    </div>
  );
}


/**
 * iPhone SE (2nd/3rd gen): black glass front with rounded corners, earpiece and front camera above the screen,
 * Touch ID home button below, aluminium band with mute switch and volume keys on the left, power on the right.
 */
export function SeFrame({ width, height, screenW, screenH, children }: { width: number; height: number; screenW: number; screenH: number; children: React.ReactNode }) {
  const side = (width - screenW) / 2;
  const chin = (height - screenH) / 2;
  const radius = width * 0.17;
  const key = (s: "left" | "right", top: number, len: number) => (
    <span className="absolute -z-10 w-[4px] rounded-[1px] bg-[#2b2b2e]" style={{ [s]: -5, top: `${top}%`, height: `${len}%` }} />
  );
  return (
    <div className="relative isolate" style={{ width, height }}>
      {/* Aluminium band, then the black glass front. */}
      <div className="absolute -z-10" style={{ inset: -3, borderRadius: radius + 3, background: "linear-gradient(135deg,#3d3d40,#1b1b1d 45%,#4a4a4e 60%,#202022)" }} />
      <div className="absolute inset-0 bg-[#0a0a0b]" style={{ borderRadius: radius, boxShadow: "var(--phone-shadow), inset 0 0 0 1px rgba(255,255,255,.06)" }} />
      {key("left", 14, 4)}
      {key("left", 21, 7)}
      {key("left", 30, 7)}
      {key("right", 21, 9)}
      {/* Earpiece slot and front camera. */}
      <span className="absolute left-1/2 h-[7px] w-[64px] -translate-x-1/2 rounded-full bg-[#1c1c1f]" style={{ top: chin / 2 - 3 }} />
      <span className="absolute left-1/2 size-[11px] -translate-x-[78px] rounded-full bg-[#141418] shadow-[inset_0_0_0_2px_#222228]" style={{ top: chin / 2 - 5 }} />
      <span className="absolute left-1/2 size-[5px] -translate-x-[28px] rounded-full bg-[#1a1a1e]" style={{ top: chin / 2 - 26 }} />
      <div className="absolute overflow-hidden bg-black" style={{ left: side, top: chin, width: screenW, height: screenH }}>
        {children}
      </div>
      {/* Glass drawn over the screen edge: hides the light fringes a scaled screen leaves at its border. */}
      <div className="pointer-events-none absolute" style={{ left: side - 1, top: chin - 1, width: screenW + 2, height: screenH + 2, boxShadow: "inset 0 0 0 2px #0a0a0b" }} />
      {/* Touch ID home button: a flat ring. */}
      <span className="absolute left-1/2 size-[64px] -translate-x-1/2 rounded-full" style={{ top: height - chin / 2 - 32, boxShadow: "inset 0 0 0 2.5px #3a3a3f" }} />
    </div>
  );
}

export const deviceById = (id?: string | null): PreviewDevice => PREVIEW_DEVICES.find((d) => d.id === id) ?? PREVIEW_DEVICES.find((d) => d.id === "iphone")!;

/**
 * A preview device drawn at its real size in points (frame, side keys, safe areas), then scaled to `width`.
 * Canvas pages, landing cards and the focus view all draw the project's device with it.
 */
export function DeviceMockup({
  device,
  width,
  dark,
  surface,
  glow,
  bare,
  children,
}: {
  device: PreviewDevice;
  width: number;
  dark: boolean;
  surface?: string | null;
  glow?: Glow;
  /** Native screenshots already include the real status bar: no safe areas drawn around them. */
  bare?: boolean;
  children: ReactNode;
}) {
  const outer = outerSize(device);
  const k = width / outer.w;
  const screen = bare ? children : (
    <SafeAreaScreen dark={dark} areas={device.areas} surface={surface}>
      {children}
    </SafeAreaScreen>
  );
  return (
    <div style={{ width, height: outer.h * k }}>
      <div className="origin-top-left" style={{ width: outer.w, height: outer.h, transform: `scale(${k})` }}>
        {device.homeButton ? (
          <SeFrame width={outer.w} height={outer.h} screenW={device.areas.width} screenH={device.h}>
            {screen}
          </SeFrame>
        ) : (
          <PhoneFrame width={outer.w} height={outer.h} radius={device.radius + device.bezel} bezel={device.bezel} glow={glow} hardware ipad={device.ipad} android={device.platform === "android"}>
            {screen}
          </PhoneFrame>
        )}
      </div>
    </div>
  );
}

"use client";

import clsx from "clsx";
import { Camera, Check, Crosshair, ExternalLink, FileDiff, Loader2, Moon, Play, RotateCcw, RotateCw, Smartphone, Sun, Tablet, X } from "lucide-react";
import { animate, motion, useMotionValue } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { isAppMessage, matchRoute, qualityFixPrompt, type ProjectState, type ScreenState } from "@/lib/shared";
import { withScheme, type AppScheme } from "@/lib/web/app-scheme";
import { outerSize, PREVIEW_DEVICES } from "@/lib/web/devices";
import { useSimDevice } from "@/lib/web/sim-device";
import { DotLens } from "../DotLens";
import type { LayoutPick } from "./LayoutTree";
import type { Selection } from "./PromptBar";
import { SimulatorView, type SimPick } from "./SimulatorView";
import { describe } from "./History";
import { CompareSlider, CupertinoSpinner, PhoneFrame, SafeAreaScreen, scoreClass, SeFrame, StatusPill, type SafeAreas } from "./ui";

const SIDE_W = 380;
const SPRING = { type: "spring" as const, stiffness: 210, damping: 28, mass: 0.9 };

type Props = {
  projectId: string;
  onScheme: (s: AppScheme) => void;
  capturingDark: boolean;
  onInspect: (on: boolean) => void;
  onPlay: () => void;
  /** Saves the project's preview device. */
  onDevice: (id: string) => void;
  /** Show in place without the fly-in (the page was reopened from the URL). */
  instant?: boolean;
  state: ProjectState;
  screen: ScreenState;
  scheme: AppScheme;
  closing: boolean;
  onClosed: () => void;
  compare: number | null;
  onCompare: (v: number | null) => void;
  inspect: boolean;
  selections: Selection[];
  onSelect: (s: { testId: string; text: string; anchors?: { ids: string[]; texts: string[]; labels?: string[]; climb?: boolean; control?: boolean }; rect?: { x: number; y: number; width: number; height: number }; area?: { x: number; y: number; width: number; height: number } }) => void;
  onNavigate: (route: string) => void;
  layoutHover: LayoutPick | null;
  simPoints: { width: number; height: number } | null;
  ipad: boolean;
  simFrozen: string | null;
  onSimPage: (p: { title: string; parent?: string }) => void;
  onSendPrompt: (text: string) => void;
  onRestore: (v: number) => void;
  onUndo: () => void;
  onDiff: (sha: string) => void;
  onSimButton: (b: "VOLUME_UP" | "VOLUME_DOWN" | "SIDE_BUTTON", hold: number) => void;
};

/** The focused page: flies in from its canvas node, shows the live app (iframe or simulator) and the page's report. */
export function HeroFocus(p: Props) {
  const s = p.screen;
  const native = !!p.state.native;
  const root = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0, barTop: 0, barRight: 0, barLeft: 0 });
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  // The phone keeps its real size and is scaled as one piece: bezel, screen and content stay in proportion in flight.
  const sc = useMotionValue(1);
  const [flying, setFlying] = useState(!p.instant);
  const [interacted, setInteracted] = useState(false);
  const iframe = useRef<HTMLIFrameElement>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const [surface, setSurface] = useState<string | null>(null);
  const busy = s.status === "building" || s.status === "verifying";

  // Target rect: height clamp(h − 190, 380..800), aspect of the simulator (native) or 390×844.
  // Web projects: the page is previewed in the project's device, picked in the tool rail.
  const deviceId = p.state.previewDevice ?? "iphone";
  const pickDevice = (id: string) => p.onDevice(id);
  const device = PREVIEW_DEVICES.find((d) => d.id === deviceId) ?? PREVIEW_DEVICES[1];
  const outer = outerSize(device);
  const aspect = native ? (p.simPoints ? p.simPoints.width / p.simPoints.height : p.ipad ? 0.75 : 390 / 844) : outer.w / outer.h;
  const targetH = Math.max(380, Math.min(800, box.h - 190));
  const targetW = targetH * aspect;
  const showSide = box.w > targetW + SIDE_W + 120;
  const groupW = targetW + (showSide ? SIDE_W + 28 : 0);
  // The tool rail (44 px + 28 px gap) lines up with the prompt bar's left edge; the phone follows it.
  const GAP = 28;
  const RAIL = 44 + GAP;
  const railTx = box.barLeft ? Math.max((box.w - groupW) / 2, box.barLeft + RAIL) : (box.w - groupW) / 2;
  // Exception: a tablet is too wide to fit beside the prompt bar, so rail + device + panel are centred as one group instead.
  const tablet = aspect > 0.6 && !!box.barRight && box.barRight - (railTx + targetW + GAP) < 220;
  const tx = tablet ? Math.max(RAIL + 16, (box.w - (RAIL + targetW + GAP + SIDE_W)) / 2 + RAIL) : railTx;
  const ty = Math.max(24, (box.barTop - targetH) / 2);
  // Side panel: right edge on the prompt bar's, GAP from the phone; it narrows rather than overflow.
  const sideRight = tablet ? Math.min(box.w - 16, tx + targetW + GAP + SIDE_W) : box.barRight || tx + targetW + GAP + SIDE_W;
  const sideW = Math.min(SIDE_W, sideRight - (tx + targetW + GAP));
  const radius = aspect > 0.6 ? targetW * 0.03 : targetW * 0.137;

  useLayoutEffect(() => {
    const el = root.current!;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const bar = document.querySelector("[data-prompt-bar]")?.getBoundingClientRect();
      setBox({ w: r.width, h: r.height, barTop: bar ? bar.top - r.top - 12 : r.height - 140, barRight: bar ? bar.right - r.left : 0, barLeft: bar ? bar.left - r.left : 0 });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const nodeRect = () => {
    const n = document.querySelector(`[data-phone="${CSS.escape(s.route)}"] button`)?.getBoundingClientRect();
    const r = root.current?.getBoundingClientRect();
    if (!n || !r) return null;
    return { x: n.left - r.left, y: n.top - r.top, w: n.width, h: n.height };
  };

  // Fly in from the node.
  const opened = useRef(false);
  // Reopened from the URL (a reload): appear in place, no flight, while the layout settles.
  const instant = useRef(!!p.instant);
  useEffect(() => {
    if (!instant.current) return;
    const t = setTimeout(() => (instant.current = false), 800);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!box.w || p.closing || !targetW) return;
    if (instant.current) {
      opened.current = true;
      x.set(tx);
      y.set(ty);
      sc.set(1);
      setFlying(false);
      return;
    }
    if (!opened.current) {
      opened.current = true;
      const from = nodeRect();
      if (from) {
        x.set(from.x);
        y.set(from.y);
        sc.set(from.w / targetW);
      } else {
        x.set(tx);
        y.set(ty + 24);
        sc.set(0.96);
      }
      setFlying(true);
    }
    void Promise.all([animate(x, tx, SPRING), animate(y, ty, SPRING), animate(sc, 1, SPRING)]).then(() => setFlying(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box.w, box.h, targetW, targetH, tx, ty, p.closing]);

  // Fly back to wherever the node is now, shrinking as one piece.
  useEffect(() => {
    if (!p.closing) return;
    setFlying(true);
    const to = nodeRect();
    const done = to
      ? Promise.all([animate(x, to.x, SPRING), animate(y, to.y, SPRING), animate(sc, to.w / targetW, SPRING)])
      : Promise.all([animate(sc, 0.9, SPRING)]);
    void done.then(p.onClosed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.closing]);

  // ---- web bridge ----
  const routes = p.state.order;
  const src = p.state.preview && !native ? withScheme(p.state.preview.webUrl + s.previewPath, p.scheme) : null;
  const [srcLoaded, setSrcLoaded] = useState(src);
  if (src && !srcLoaded) setSrcLoaded(src);
  const post = (m: unknown) => iframe.current?.contentWindow?.postMessage(m, "*");

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframe.current?.contentWindow || !isAppMessage(e.data)) return;
      const m = e.data;
      if (m.type === "surface") return setSurface(m.color);
      if (m.type === "ready" || m.type === "route") {
        if (m.type === "ready") {
          setIframeReady(true);
          post({ type: "inspect", enabled: p.inspect });
          post({ type: "color-scheme", scheme: p.scheme });
        }
        const r = matchRoute(m.path, routes);
        if (r && r !== s.route) p.onNavigate(r);
      } else if (m.type === "select") {
        p.onSelect({ testId: m.testId, text: m.text, rect: m.rect, anchors: m.anchors });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  });
  useEffect(() => post({ type: "inspect", enabled: p.inspect }), [p.inspect]);
  useEffect(() => post({ type: "color-scheme", scheme: p.scheme }), [p.scheme]);
  useEffect(() => post({ type: "navigate", path: s.previewPath }), [s.previewPath]);
  // What the app outlines: a testID, or for elements without one, the testIDs and texts they contain.
  const target = (x: { testId?: string; anchors?: { ids: string[]; texts: string[]; labels?: string[]; climb?: boolean; control?: boolean } }) => (x.anchors ? { anchors: x.anchors } : { testId: x.testId });
  const selectedKey = JSON.stringify(p.selections.map(target));
  // A selected element keeps its blue outline: hovering it must not cover it in violet.
  const hover = p.layoutHover && !p.selections.some((x) => x.key === p.layoutHover?.key) ? target(p.layoutHover) : null;
  const hoverKey = JSON.stringify(hover);
  useEffect(() => post({ type: "highlight", testId: hover?.testId ?? null, ...(hover?.anchors ? { anchors: hover.anchors } : {}) }), [hoverKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => post({ type: "selection", items: JSON.parse(selectedKey) }), [selectedKey, iframeReady]); // eslint-disable-line react-hooks/exhaustive-deps
  // No preview after 15 s (Metro down): stop the spinner and show the capture as is.
  const [gaveUp, setGaveUp] = useState(false);
  // The app says "ready" once it runs. Right after the server starts, Metro is still bundling and the
  // first load can fail for good: reload the iframe every 8 s until it does, keeping the capture
  // (blurred, with the spinner) in front. After 6 tries, show the iframe anyway (an app without the
  // bridge never says "ready").
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!src || iframeReady) return;
    const t = setTimeout(() => (attempt < 6 ? setAttempt((a) => a + 1) : setIframeReady(true)), 8000);
    return () => clearTimeout(t);
  }, [src, iframeReady, attempt]);
  useEffect(() => {
    if (src) return;
    const t = setTimeout(() => setGaveUp(true), 15000);
    return () => clearTimeout(t);
  }, [src]);
  const loading = !native && !iframeReady && !gaveUp;

  const older = p.compare != null ? s.history.find((v) => v.version === p.compare) : undefined;
  const nativePage = useMemo(() => {
    if (!native) return null;
    const parentRoute = p.state.edges.find((e) => e.to === s.route)?.from;
    return { title: s.title, ...(parentRoute ? { parent: p.state.screens[parentRoute]?.title } : {}) };
  }, [native, s.route, s.title, p.state.edges, p.state.screens]);

  const screenContent = (
    <>
          {older && s.screenshotUrl ? (
            // Both versions sit between the same safe areas as the live preview.
            <SafeAreaScreen dark={p.scheme === "dark"} areas={device.areas} surface={surface}>
              <CompareSlider before={shotOf(older, p.scheme)} after={shotOf(s.history.find((h) => h.version === s.screenshotVersion) ?? { url: s.screenshotUrl! }, p.scheme)} beforeLabel={`v${older.version}`} afterLabel={`v${s.version} · now`} />
            </SafeAreaScreen>
          ) : native ? (
            <div className="h-full" onPointerDown={() => setInteracted(true)}>
              <SimulatorView
                page={nativePage}
                onPageChange={p.onSimPage}
                frozen={!!p.simFrozen}
                frozenLabel={p.simFrozen ?? undefined}
                inspect={p.inspect}
                onPick={(pk: SimPick) => p.onSelect({ testId: pk.testId, text: pk.text, area: pk.area })}
                highlights={p.layoutHover ? { texts: p.layoutHover.texts, each: p.layoutHover.each } : null}
              />
            </div>
          ) : (
            <div className="relative h-full bg-white" onPointerDown={() => setInteracted(true)}>
              {/* While the live preview loads: the last capture, between the same safe areas, blurred under an iOS spinner. */}
              <SafeAreaScreen dark={p.scheme === "dark"} areas={device.areas} surface={surface}>
                {s.screenshotUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.screenshotUrl} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
                )}
                <div
                  className={clsx(
                    "pointer-events-none absolute inset-0 grid place-items-center backdrop-blur-md transition-opacity duration-300",
                    loading ? "opacity-100" : "opacity-0",
                  )}>
                  <span className="scale-[1.4]">
                    <CupertinoSpinner />
                  </span>
                </div>
              </SafeAreaScreen>
              {srcLoaded && (
                <ScaledIframe key={attempt} ref={iframe} src={srcLoaded} ready={iframeReady} dark={p.scheme === "dark"} surface={surface} areas={device.areas} onLoad={() => {}} />
              )}
            </div>
          )}
          {busy && (
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 overflow-hidden bg-spark-500/20">
              <div className="animate-shimmer h-full w-1/2 bg-spark-500" />
            </div>
          )}
          {native && (
            <div className="pointer-events-none absolute inset-0">
              {p.selections
                .filter((sel) => sel.area)
                .map((sel, i) => (
                  <div
                    key={sel.key}
                    className="absolute rounded-md border-2 border-[#0a84ff] bg-[#0a84ff]/10"
                    style={{ left: `${sel.area!.x * 100}%`, top: `${sel.area!.y * 100}%`, width: `${sel.area!.width * 100}%`, height: `${sel.area!.height * 100}%` }}>
                    <span className="absolute -top-2.5 -left-2.5 grid size-5 place-items-center rounded-full bg-[#0a84ff] text-[10px] font-bold text-white">{i + 1}</span>
                  </div>
                ))}
            </div>
          )}
    </>
  );

  return (
    <div ref={root} data-landing className="absolute inset-0 z-30">
      <motion.div
        initial={p.instant ? false : { opacity: 0 }}
        animate={{ opacity: p.closing ? 0 : 1 }}
        transition={{ duration: 0.25 }}
        className="absolute inset-0 bg-ink-950"
        style={{ backgroundImage: "radial-gradient(ellipse at 40% 30%, var(--hero-gradient-to), transparent 60%)" }}
      />
      <DotMagnifier />

      <motion.div data-hero-phone className="absolute" style={{ left: x, top: y, width: targetW, height: targetH, scale: sc, transformOrigin: "0 0" }}>
        {native ? (
        <PhoneFrame
          width={9999}
          height={9999}
          radius={radius}
          bezel={Math.max(5, targetW * 0.025)}
          glow={busy ? "spark" : null}
          // The canvas pages wear the same side keys, so they stay on in flight.
          hardware
          ipad={aspect > 0.6}
          onButton={native ? p.onSimButton : undefined}
          style={{ width: "100%", height: "100%" }}>
            {screenContent}
          </PhoneFrame>
        ) : (
          // The device is drawn at its real size in points, then scaled to the focus box as one piece.
          <div className="origin-top-left" style={{ width: outer.w, height: outer.h, transform: `scale(${targetW / outer.w})` }}>
            {device.homeButton ? (
              <SeFrame width={outer.w} height={outer.h} screenW={device.areas.width} screenH={device.h}>
                {screenContent}
              </SeFrame>
            ) : (
              <PhoneFrame width={outer.w} height={outer.h} radius={device.radius + device.bezel} bezel={device.bezel} glow={busy ? "spark" : null} hardware ipad={device.ipad} android={device.platform === "android"}>
                {screenContent}
              </PhoneFrame>
            )}
          </div>
        )}
      </motion.div>

      {!p.closing && box.w > 0 && (
        <ToolRail
          {...p}
          device={native ? null : device.id}
          onDevice={pickDevice}
          // Vertically centred on the phone.
          style={{ left: Math.max(8, tx - RAIL), top: ty + targetH / 2, transform: "translateY(-50%)" }}
          onReload={() => {
            setIframeReady(false);
            const f = iframe.current;
            if (f) f.src = f.src;
          }}
        />
      )}

      {showSide && sideW >= 220 && !p.closing && (
        <motion.aside
          initial={p.instant ? false : { opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.12 }}
          className="absolute overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4"
          style={{ left: sideRight - sideW, top: ty, width: sideW, maxHeight: box.barTop - ty }}>
          <SidePanel {...p} srcReady={iframeReady} />
        </motion.aside>
      )}
    </div>
  );
}

/** 390×844 iframe scaled to the frame; fades in once the app reports ready. */
/** Vertical tools beside the phone: appearance, screenshot, point at elements, reload, open, play. */
function ToolRail(p: Omit<Props, "onDevice"> & { style: React.CSSProperties; onReload: () => void; device: string | null; onDevice: (id: string) => void }) {
  const [picker, setPicker] = useState(false);
  const native = !!p.state.native;
  const sim = useSimDevice();
  const [saving, setSaving] = useState(false);

  const screenshot = async () => {
    setSaving(true);
    try {
      // Native: a fresh frame from the simulator. Web: the last verified capture of the page.
      const url = native && sim.device ? `/api/sim/${sim.device.udid}/frame` : p.screen.screenshotUrl;
      if (!url) return;
      const blob = await fetch(url).then((r) => r.blob());
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${p.screen.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-v${p.screen.version}${p.scheme === "dark" ? "-dark" : ""}.${blob.type.includes("jpeg") ? "jpg" : "png"}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setSaving(false);
    }
  };

  const btn = "grid size-9 cursor-pointer place-items-center rounded-xl text-ink-300 transition hover:bg-ink-800 hover:text-ink-100 disabled:cursor-not-allowed disabled:opacity-40";
  return (
    // The wrapper holds the position (and its centring transform); motion animates the inside.
    <div className="absolute z-10" style={p.style}>
    <motion.div
      initial={p.instant ? false : { opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.12 }}
      className="flex flex-col items-center gap-1 rounded-2xl border border-[var(--line)] bg-[var(--panel)]/95 p-1 shadow-xl backdrop-blur">
      {(["light", "dark"] as const).map((m) => (
        <button
          key={m}
          disabled={p.capturingDark}
          onClick={() => p.onScheme(m)}
          title={native ? `Switch the iOS Simulator to ${m} mode` : `Show the app in ${m} mode`}
          aria-label={`${m} mode`}
          className={clsx(btn, p.scheme === m && "bg-ink-800 text-ink-100")}>
          {m === "dark" && p.capturingDark ? <Loader2 size={15} className="animate-spin" /> : m === "light" ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      ))}
      <span className="my-0.5 h-px w-6 bg-[var(--line)]" />
      {p.device && (
        // Preview device: iPhone, SE, iPad mini, Pixel or Galaxy.
        <div className="relative">
          <button onClick={() => setPicker((o) => !o)} title="Preview device" aria-label="Preview device" className={clsx(btn, picker && "bg-ink-800 text-ink-100")}>
            {PREVIEW_DEVICES.find((d) => d.id === p.device)?.ipad ? <Tablet size={15} /> : <Smartphone size={15} />}
          </button>
          {picker && (
            <div className="absolute top-0 left-full ml-2 w-40 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1 shadow-2xl">
              {(["ios", "android"] as const).map((pf) => (
                <div key={pf}>
                  <p className="px-2.5 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-500">{pf === "ios" ? "iOS" : "Android"}</p>
                  {PREVIEW_DEVICES.filter((d) => d.platform === pf).map((d) => (
                    <button
                      key={d.id}
                      onClick={() => {
                        p.onDevice(d.id);
                        setPicker(false);
                      }}
                      className={clsx("flex w-full cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[12.5px] hover:bg-ink-800", d.id === p.device ? "text-ink-100" : "text-ink-300")}>
                      {d.label}
                      {d.id === p.device && <Check size={13} className="text-spark-400" />}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <button onClick={() => void screenshot()} disabled={saving || (!native && !p.screen.screenshotUrl)} title="Save a screenshot" aria-label="Save a screenshot" className={btn}>
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
      </button>
      <button onClick={() => p.onInspect(!p.inspect)} disabled={p.state.status === "running"} title="Point at elements" aria-label="Point at elements" className={clsx(btn, p.inspect && "bg-spark-500/15 text-spark-400")}>
        <Crosshair size={15} />
      </button>
      {!native && (
        <>
          <button onClick={p.onReload} title="Reload the preview" aria-label="Reload the preview" className={btn}>
            <RotateCw size={15} />
          </button>
          {p.state.preview && (
            <a href={p.state.preview.webUrl + p.screen.previewPath} target="_blank" rel="noreferrer" title="Open in a new tab" aria-label="Open in a new tab" className={btn}>
              <ExternalLink size={15} />
            </a>
          )}
        </>
      )}
      <button onClick={p.onPlay} title="Play" aria-label="Play" className={btn}>
        <Play size={15} />
      </button>
    </motion.div>
    </div>
  );
}

/** Live app (iframe) between the iPhone safe areas. Fades in once the app reports ready. */
const ScaledIframe = ({ ref, src, ready, dark, surface, areas, onLoad }: { ref: React.Ref<HTMLIFrameElement>; src: string; ready: boolean; dark: boolean; surface: string | null; areas: SafeAreas; onLoad: () => void }) => (
  <div className={clsx("absolute inset-0 transition-opacity duration-300", ready ? "opacity-100" : "opacity-0")}>
    <SafeAreaScreen dark={dark} surface={surface} areas={areas}>
      <iframe ref={ref} src={src} onLoad={onLoad} title="Live preview" className="block h-full w-full border-0" />
    </SafeAreaScreen>
  </div>
);

/** Same dot grid and "attract" lens as the landing: flat dots, hollowed out where the lens canvas redraws them. */
function DotMagnifier() {
  return (
    // Dots and lens fade out toward the right so the right half (the side panel) stays clear.
    <div className="pointer-events-none absolute inset-0" style={{ maskImage: "linear-gradient(90deg, black 0%, black 30%, transparent 50%)" }}>
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(var(--dot)_1.4px,transparent_1.6px)] [background-size:22px_22px]"
        style={{
          maskImage: "radial-gradient(circle var(--lr, 0px) at var(--lx, -999px) var(--ly, -999px), transparent 98%, black 100%)",
        }}
      />
      <DotLens contained />
    </div>
  );
}

function SidePanel(p: Props & { srcReady: boolean }) {
  const s = p.screen;
  const plan = p.state.plan?.screens.find((x) => x.route === s.route);
  const native = !!p.state.native;
  const running = p.state.status === "running";
  const criteria = s.verdict?.criteria ?? plan?.acceptance.map((text) => ({ text, pass: null as boolean | null, reason: "" })) ?? [];
  const q = s.quality;
  const grouped = useMemo(() => {
    if (!q) return [];
    const map = new Map<string, { message: string; severity: string; ids: Set<string>; count: number }>();
    for (const i of q.issues) {
      const g = map.get(i.message) ?? { message: i.message, severity: i.severity, ids: new Set(), count: 0 };
      g.count++;
      if (i.testId) g.ids.add(i.testId.replace(/-\d+$/, "-*"));
      if (i.severity === "high") g.severity = "high";
      map.set(i.message, g);
    }
    return [...map.values()].sort((a, b) => (a.severity === b.severity ? b.count - a.count : a.severity === "high" ? -1 : 1)).slice(0, 6);
  }, [q]);
  const commits = p.state.commits.filter((c) => c.routes.includes(s.route)).slice(-6).reverse();
  const [confirmRestore, setConfirmRestore] = useState<number | null>(null);

  return (
    <div className="space-y-5 text-[12.5px]">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-[16px] font-semibold text-ink-100">
            {s.title} <span className="font-mono text-[11px] font-normal text-ink-500">v{s.version}</span>
          </h2>
          {!native && p.state.preview && (
            <a href={p.state.preview.webUrl + s.previewPath} target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-1 text-[11px] text-spark-400 hover:underline">
              Open <ExternalLink size={11} />
            </a>
          )}
        </div>
        <p className="mt-0.5 font-mono text-[10.5px] text-ink-500">{s.file}</p>
        <div className="mt-2 flex items-center gap-2">
          <StatusPill screen={s} />
          {!native && !p.srcReady && p.state.preview && (
            <span className="flex items-center gap-1 text-[11px] text-ink-500">
              <Loader2 size={11} className="animate-spin" /> Live preview starting…
            </span>
          )}
        </div>
        {plan?.purpose && <p className="mt-2 leading-relaxed text-ink-400">{plan.purpose}</p>}
      </div>

      {criteria.length > 0 && (
        <section>
          <h3 className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-500">Acceptance criteria</h3>
          <ul className="space-y-1.5">
            {criteria.map((c, i) => (
              <li key={i} title={c.reason || undefined} className="flex gap-2 text-ink-300">
                {c.pass === true ? <Check size={13} className="mt-0.5 shrink-0 text-emerald-400" /> : c.pass === false ? <X size={13} className="mt-0.5 shrink-0 text-red-400" /> : <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ink-600" />}
                <span>{c.text}</span>
              </li>
            ))}
          </ul>
          {!s.verdict && <p className="mt-1 text-[11px] text-ink-500">Not verified yet.</p>}
        </section>
      )}

      {q && (
        <section>
          <div className="mb-1.5 flex items-center justify-between">
            <h3 className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-500">Accessibility</h3>
            <span className={clsx("rounded-full border px-1.5 py-0.5 text-[10.5px] font-semibold", scoreClass(q.score))}>{q.score}</span>
          </div>
          {grouped.length ? (
            <ul className="space-y-1.5">
              {grouped.map((g) => (
                <li key={g.message} className="flex gap-2 text-ink-300">
                  <span className={clsx("mt-1.5 size-1.5 shrink-0 rounded-full", g.severity === "high" ? "bg-red-400" : "bg-amber-400")} />
                  <span>
                    {g.message}
                    {g.count > 1 && <span className="text-ink-500"> ×{g.count}</span>}
                    {g.ids.size > 0 && <span className="block font-mono text-[10.5px] text-ink-500">{[...g.ids].slice(0, 3).join(", ")}</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-400">
              No issue found in {q.checked.texts} texts and {q.checked.controls} controls.
            </p>
          )}
          {!native && q.issues.length > 0 && (
            <button
              disabled={running}
              onClick={() => p.onSendPrompt(qualityFixPrompt(q, { dark: p.scheme === "dark" }))}
              className="mt-2 w-full cursor-pointer rounded-lg border border-[var(--line)] py-1.5 text-[12px] text-ink-200 hover:bg-ink-800 disabled:opacity-40">
              Fix with the agent
            </button>
          )}
        </section>
      )}

      {s.verdict && s.verdict.defects.length > 0 && (
        <section>
          <h3 className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-500">Verifier notes</h3>
          <ul className="space-y-1.5">
            {s.verdict.defects.slice(0, 6).map((d, i) => (
              <li key={i} className="flex gap-2 text-ink-300">
                <span className={clsx("mt-1.5 size-1.5 shrink-0 rounded-full", d.severity === "high" ? "bg-red-400" : "bg-ink-500")} />
                <span>{d.description}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {s.history.length > 1 && (
        <section>
          <div className="mb-1.5 flex items-center justify-between">
            <h3 className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-500">Versions</h3>
            <button
              onClick={() => p.onCompare(null)}
              className={clsx("flex items-center gap-1.5 rounded-full bg-spark-500/15 px-2 py-0.5 text-[10.5px] text-spark-400 transition", p.compare == null ? "pointer-events-none opacity-0" : "cursor-pointer opacity-100")}>
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-spark-400 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-spark-400" />
              </span>
              Back to live
            </button>
          </div>
          <div className="relative max-h-64 overflow-y-auto py-2" style={{ maskImage: "linear-gradient(transparent, black 12px, black calc(100% - 12px), transparent)" }}>
            <div className="absolute top-0 bottom-0 left-[6px] w-px bg-spark-500/30" />
            {[...s.history].reverse().map((v, i) => {
              const latest = i === 0;
              const active = p.compare === v.version || (latest && p.compare == null);
              return (
                <button
                  key={v.version}
                  onClick={() => p.onCompare(latest || p.compare === v.version ? null : v.version)}
                  className="relative flex w-full cursor-pointer items-center gap-2.5 py-1 pl-5 text-left">
                  <span className={clsx("absolute left-[3px] size-[7px] rounded-full", active ? "bg-spark-500" : "bg-ink-600")} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={shotOf(v, p.scheme)} alt="" draggable={false} className="h-[74px] w-[34px] rounded object-cover object-top" />
                  <span className="text-[11.5px]">
                    <span className={clsx("font-medium", active ? "text-ink-100" : "text-ink-300")}>v{v.version}</span> {latest && <span className="text-[10px] text-emerald-400">now</span>}
                    <span className="block text-[10.5px] text-ink-500">{new Date(v.ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {!native && p.compare != null ? (
            <button
              disabled={running}
              onClick={() => {
                if (confirmRestore !== p.compare) return setConfirmRestore(p.compare);
                setConfirmRestore(null);
                p.onRestore(p.compare!);
              }}
              className={clsx("mt-1 w-full cursor-pointer rounded-lg border py-1.5 text-[12px] disabled:opacity-40", confirmRestore === p.compare ? "border-amber-400/40 text-amber-400" : "border-[var(--line)] text-ink-200 hover:bg-ink-800")}>
              {confirmRestore === p.compare ? `Click again to restore v${p.compare}` : `Restore v${p.compare}`}
            </button>
          ) : (
            <p className="mt-1 text-[11px] text-ink-500">Pick an older version to compare it with now.</p>
          )}
          {confirmRestore === p.compare && p.compare != null && <p className="mt-1 text-[10.5px] text-ink-500">Saved as a new version.</p>}
        </section>
      )}

      {commits.length > 0 && (
        <section>
          <h3 className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-500">History</h3>
          <ul className="space-y-0.5">
            {commits.map((c) => {
              // Same plain-words label and coloured badge as the History in the explorer.
              const e = describe(c, (r) => p.state.screens[r]?.title);
              return (
                <li key={c.sha}>
                  <button disabled={native} onClick={() => p.onDiff(c.sha)} title={`See the changes (${c.sha})`} className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-ink-800">
                    <span className={clsx("grid size-5 shrink-0 place-items-center rounded-full", e.tone)}>
                      <e.icon size={11} />
                    </span>
                    <span className="flex-1 truncate text-ink-300">{e.title}</span>
                    <FileDiff size={12} className="shrink-0 text-ink-500" />
                  </button>
                </li>
              );
            })}
          </ul>
          {!native && commits.length > 1 && !running && (
            <button onClick={p.onUndo} className="mt-1.5 flex cursor-pointer items-center gap-1.5 text-[11.5px] text-ink-400 hover:text-ink-100">
              <RotateCcw size={12} /> Undo last change
            </button>
          )}
        </section>
      )}
    </div>
  );
}

/** A version's shot in the current appearance; versions without a dark capture fall back to light. */
function shotOf(v: { url: string; dark?: string }, scheme: AppScheme) {
  return scheme === "dark" ? (v.dark ?? v.url) : v.url;
}

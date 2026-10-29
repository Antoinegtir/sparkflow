"use client";

import clsx from "clsx";
import { ExternalLink, Globe, RotateCw, Smartphone, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { isAppMessage, matchRoute, type ProjectState } from "@/lib/shared";
import { withScheme, type AppScheme } from "@/lib/web/app-scheme";
import { useDeviceSkin } from "@/lib/web/device-skin";
import { useSimDevice } from "@/lib/web/sim-device";
import { openInSimulator } from "@/lib/web/sim-open";
import { DevClientOverlay } from "./DevClientOverlay";
import { SimulatorView } from "./SimulatorView";
import { PREVIEW_DEVICES, SE_CHIN } from "@/lib/web/devices";
import { SkinFrame } from "./SkinFrame";
import { CupertinoSpinner, PhoneFrame, SafeAreaScreen, SeFrame, type SafeAreas } from "./ui";

type Platform = "web" | "ios" | "android";
type Device = { id: string; label: string; areas: SafeAreas; h: number; radius: number; bezel: number; ipad?: boolean; homeButton?: boolean; simulator?: boolean };

/** Web preview sizes per platform (the web build in a device frame). */
const PREVIEWS: Record<Exclude<Platform, "web">, Device[]> = {
  ios: PREVIEW_DEVICES.filter((d) => d.platform === "ios"),
  android: PREVIEW_DEVICES.filter((d) => d.platform === "android"),
};
/** The running iOS Simulator or Android emulator; its size comes from the device itself. */
const LIVE: Omit<Device, "label"> = { id: "simulator", areas: { width: 393, top: 59, bottom: 34 }, h: 852, radius: 55, bezel: 12, simulator: true };
/** Desktop browser window for the web preview. */
const WEB = { w: 1280, h: 800, chrome: 40 };
const PREFS_KEY = "sparkflow-play";

/**
 * Fullscreen play. Web: the web build in a browser window. iOS and Android: the web build in a device frame with
 * that platform's safe areas, or the live iOS Simulator. Esc or a backdrop click closes it.
 */
export function PlayMode({ state, scheme, startPath, onClose, onSimButton, onDevice }: { state: ProjectState; scheme: AppScheme; startPath: string; onClose: () => void; onSimButton: (b: "VOLUME_UP" | "VOLUME_DOWN" | "SIDE_BUTTON", hold: number) => void; onDevice: (id: string) => void }) {
  const native = !!state.native;
  const sim = useSimDevice();
  // Opens on the device the page is shown on (the focus view's), so the phone carries straight over.
  const onSim = state.previewDevice === "simulator";
  // The live device's platform is only known once the device list has loaded (see below).
  const current = native || !state.preview ? undefined : onSim ? { id: "simulator", platform: sim.device?.platform ?? ("ios" as const) } : PREVIEW_DEVICES.find((d) => d.id === state.previewDevice);
  const [platform, setPlatform] = useState<Platform>(current?.platform ?? "ios");
  const picked = useRef(false);
  useEffect(() => {
    if (!picked.current && (native || onSim) && sim.device) setPlatform(sim.device.platform);
  }, [native, onSim, sim.device]);
  const [deviceId, setDeviceId] = useState<Record<Exclude<Platform, "web">, string>>({
    ios: native || !state.preview || onSim ? "simulator" : current?.platform === "ios" ? current.id : "iphone",
    android: onSim ? "simulator" : current?.platform === "android" ? current.id : "pixel",
  });
  const [path, setPath] = useState(startPath);
  const [run, setRun] = useState(0);
  const [ready, setReady] = useState(false);
  const [surface, setSurface] = useState<string | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [fit, setFit] = useState(1);
  const [measured, setMeasured] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (native || current) return;
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null");
      if (saved?.platform) setPlatform(saved.platform);
      if (saved?.deviceId) setDeviceId((d) => ({ ...d, ...saved.deviceId }));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [native]);
  const save = (p: Platform, ids: typeof deviceId) => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ platform: p, deviceId: ids }));
    } catch {}
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || !isAppMessage(e.data)) return;
      if (e.data.type === "ready") setReady(true);
      if (e.data.type === "surface") setSurface(e.data.color);
      if (e.data.type === "ready" || e.data.type === "route") setPath(e.data.path);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Per platform: the device running it live (when one is), then the web preview sizes. An imported
  // native project only runs live.
  const liveHere = sim.device && platform !== "web" && sim.device.platform === platform ? sim.device : null;
  const devices: Device[] =
    platform === "web" ? [] : [...(liveHere ? [{ ...LIVE, label: liveHere.name }] : []), ...(native ? [] : PREVIEWS[platform])];
  const skin = useDeviceSkin(liveHere?.platform === "android" ? liveHere : null);
  const device = platform === "web" ? null : (devices.find((d) => d.id === deviceId[platform]) ?? devices[0]);
  const live = !!device?.simulator;
  // The Simulator shows whatever app it has open: for a generated app, open it there first, natively
  // in Sparkflow Dev (built once, then installed on the device); DevClientOverlay covers the old app
  // meanwhile and shows any failure.
  const udid = sim.device?.udid;
  useEffect(() => {
    if (!live || native || !state.preview || !udid) return;
    openInSimulator(udid, state.preview, startPath, matchRoute(startPath, state.order) ?? undefined).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, udid, run]);
  // A device picked here becomes the project's preview device: the focus view (and the canvas) follow.
  useEffect(() => {
    // The Simulator too: the focus view then shows the live Simulator instead of the web preview.
    // Not before the simulator list has loaded: until then "Simulator" isn't offered and the first
    // device (SE) would replace it.
    if (native || !sim.loaded || !device || device.id === state.previewDevice) return;
    onDevice(device.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device?.id, sim.loaded]);
  const simPoints = sim.device?.points;

  // Outer size of what is drawn, for fitting it to the stage.
  const dims = !device
    ? null
    : live
      ? { w: simPoints?.width ?? 393, h: simPoints?.height ?? 852, r: sim.device?.ipad ? 21 : 55, bezel: sim.device?.ipad ? 36 : 12 }
      : { w: device.areas.width, h: device.h, r: device.radius, bezel: device.bezel };
  const se = !!device?.homeButton;
  // A live Android emulator in its own frame (SDK skin), its screen at the device's size in points.
  const skinK = live && skin && dims ? dims.w / skin.screen.width : 0;
  const outerW = skinK ? skin!.width * skinK : dims ? dims.w + dims.bezel * 2 : WEB.w;
  const outerH = skinK ? skin!.height * skinK : dims ? dims.h + (se ? 2 * SE_CHIN : dims.bezel * 2) : WEB.h + WEB.chrome;
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setFit(Math.min(1, (el.clientHeight - 40) / outerH, (el.clientWidth - 40) / outerW));
      setMeasured(true);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [outerW, outerH]);

  // Wheel and trackpad scrolling stay in the overlay: the Simulator turns them into swipes, and the
  // page behind must not scroll or pan meanwhile.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const stop = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    el.addEventListener("wheel", stop, { passive: false });
    return () => el.removeEventListener("wheel", stop);
  }, []);

  // Opening: the backdrop fades in and the device flies from where it sat in the focus view (hero),
  // or grows in place when there is none (canvas).
  useLayoutEffect(() => {
    if (!measured) return;
    const el = box.current;
    const opts = { duration: 480, easing: "cubic-bezier(.2,.8,.2,1)" };
    const r = root.current;
    if (r) {
      r.animate([{ backgroundColor: "rgba(0,0,0,0)", backdropFilter: "blur(0px)" }, { backgroundColor: "rgba(0,0,0,.85)", backdropFilter: "blur(12px)" }], { duration: 300, easing: "ease-out" });
      for (const bar of [r.firstElementChild, r.lastElementChild]) bar?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 120, easing: "ease-out", fill: "backwards" });
    }
    if (!el) return;
    const from = document.querySelector("[data-hero-phone]")?.getBoundingClientRect();
    const to = el.getBoundingClientRect();
    if (from && from.width && to.width) {
      const s = from.width / to.width;
      el.animate([{ transformOrigin: "0 0", transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${s})` }, { transformOrigin: "0 0", transform: "none" }], opts);
    } else {
      el.animate([{ opacity: 0, transform: "scale(.92)" }, { opacity: 1, transform: "none" }], opts);
    }
  }, [measured]);

  // Closing: the same flight backwards, back to the focus view's phone, then the overlay goes.
  const closing = useRef(false);
  const dismiss = () => {
    if (closing.current) return;
    closing.current = true;
    const r = root.current;
    const el = box.current;
    const opts = { duration: 380, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" as const };
    if (r) {
      r.animate([{ backgroundColor: "rgba(0,0,0,.85)", backdropFilter: "blur(12px)" }, { backgroundColor: "rgba(0,0,0,0)", backdropFilter: "blur(0px)" }], opts);
      for (const bar of [r.firstElementChild, r.lastElementChild]) bar?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: "forwards" });
    }
    const from = document.querySelector("[data-hero-phone]")?.getBoundingClientRect();
    const to = el?.getBoundingClientRect();
    const anim =
      el && to && from && from.width && to.width
        ? el.animate([{ transformOrigin: "0 0", transform: "none" }, { transformOrigin: "0 0", transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width})` }], opts)
        : el?.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.92)" }], opts);
    // A timer rather than onfinish: animations don't advance in a background tab, the close must still happen.
    setTimeout(onClose, anim ? opts.duration : 0);
  };

  // A new frame size reloads the app: show the spinner until it repaints.
  const key = `${platform}:${device?.id ?? "web"}:${run}`;
  useEffect(() => setReady(false), [key]);

  const route = matchRoute(path, state.order);
  const src = state.preview ? withScheme(`${state.preview.webUrl}${startPath}${startPath.includes("?") ? "&" : "?"}play=${run}`, scheme) : null;

  const app = (
    <>
      {src && (
        <iframe key={key} ref={frame} src={src} title="App" className={clsx("h-full w-full border-0 transition-opacity duration-300", ready ? "opacity-100" : "opacity-0")} onLoad={() => setTimeout(() => setReady(true), 8000)} />
      )}
      {/* Until the app has painted: a spinner instead of a white page. */}
      <div className={clsx("pointer-events-none absolute inset-0 grid place-items-center transition-opacity duration-300", ready ? "opacity-0" : "opacity-100")}>
        <span className="scale-[1.4]">
          <CupertinoSpinner />
        </span>
      </div>
    </>
  );

  let body: React.ReactNode;
  if (!device) {
    body = (
      <BrowserWindow width={WEB.w} height={WEB.h} chrome={WEB.chrome} url={state.preview ? state.preview.webUrl.replace(/^https?:\/\//, "") + cleanPath(path) : "localhost"} dark={scheme === "dark"}>
        {app}
      </BrowserWindow>
    );
  } else if (live && skinK) {
    body = (
      <SkinFrame skin={skin!} style={{ width: outerW, height: outerH }}>
        <SimulatorView />
        {!native && <DevClientOverlay name={state.name} />}
      </SkinFrame>
    );
  } else if (live) {
    body = (
      <PhoneFrame width={outerW} height={outerH} radius={dims!.r + dims!.bezel} bezel={dims!.bezel} hardware ipad={sim.device?.ipad} onButton={onSimButton}>
        <SimulatorView />
        {!native && <DevClientOverlay name={state.name} />}
      </PhoneFrame>
    );
  } else {
    const screen = (
      <SafeAreaScreen dark={scheme === "dark"} areas={device.areas} surface={surface}>
        {app}
      </SafeAreaScreen>
    );
    body = se ? (
      <SeFrame width={outerW} height={outerH} screenW={dims!.w} screenH={dims!.h}>
        {screen}
      </SeFrame>
    ) : (
      <PhoneFrame width={outerW} height={outerH} radius={dims!.r + dims!.bezel} bezel={dims!.bezel} hardware ipad={device.ipad} android={platform === "android"}>
        {screen}
      </PhoneFrame>
    );
  }

  const seg = "flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 transition";
  const pickPlatform = (m: Platform) => {
    picked.current = true;
    setPlatform(m);
    save(m, deviceId);
  };
  const pickDevice = (id: string) => {
    if (platform === "web") return;
    picked.current = true;
    const ids = { ...deviceId, [platform]: id };
    setDeviceId(ids);
    save(platform, ids);
  };
  const previews = devices.filter((d) => !d.simulator);
  return (
    <div ref={root} data-ide className="fixed inset-0 z-[80] flex flex-col bg-black/85 backdrop-blur-md" onMouseDown={(e) => e.target === e.currentTarget && dismiss()}>
      <div className="relative flex h-14 shrink-0 items-center justify-between gap-3 px-4 text-[12.5px] text-white/80">
        <div className="flex min-w-0 items-center gap-3">
          {/* 1. Where it runs: the web build in a browser, or on iOS / Android. */}
          <div className="flex rounded-lg bg-white/10 p-0.5">
            {(["web", "ios", "android"] as const).map((m) => (
              <button
                key={m}
                disabled={native && m !== "ios"}
                onClick={() => pickPlatform(m)}
                className={clsx(seg, platform === m ? "bg-white/20 text-white" : "text-white/60 hover:text-white", "disabled:cursor-not-allowed disabled:opacity-30")}>
                {m === "web" ? <Globe size={13} /> : <Smartphone size={13} />}
                {m === "web" ? "Web" : m === "ios" ? "iOS" : "Android"}
              </button>
            ))}
          </div>
          {/* 2. On what: the device running it live, or a web preview size. */}
          {platform !== "web" && (
            <div className="flex min-w-0 items-center gap-1 rounded-lg bg-white/10 p-0.5">
              {liveHere ? (
                <button onClick={() => pickDevice("simulator")} className={clsx(seg, live ? "bg-emerald-400/20 text-white" : "text-white/60 hover:text-white")} title={`The ${platform === "android" ? "Android emulator" : "iOS Simulator"} running on this computer`}>
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                  </span>
                  <span className="truncate">
                    {platform === "android" ? "Emulator" : "Simulator"} · {liveHere.name}
                  </span>
                </button>
              ) : (
                !native && <span className="px-2.5 py-1 text-[11.5px] text-white/40">No {platform === "android" ? "emulator" : "Simulator"} running</span>
              )}
              {previews.length > 0 && (
                <>
                  <span className="mx-1 h-4 w-px bg-white/15" />
                  <span className="pl-1 text-[10.5px] uppercase tracking-wide text-white/35">Web preview</span>
                  {previews.map((d) => (
                    <button key={d.id} onClick={() => pickDevice(d.id)} className={clsx(seg, "text-[11.5px]", device?.id === d.id ? "bg-white/20 text-white" : "text-white/60 hover:text-white")}>
                      {d.label}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
          {!live && (
            <>
              <button onClick={() => setRun((r) => r + 1)} className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 hover:bg-white/10">
                <RotateCw size={13} /> Restart
              </button>
              {src && (
                <a href={src} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-white/10">
                  <ExternalLink size={13} /> New tab
                </a>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!live && (
            // The page on screen, by name (the URL path means little to the user).
            <span className="truncate text-white/70">{route ? state.screens[route]?.title : cleanPath(path)}</span>
          )}
          <button onClick={dismiss} aria-label="Close" className="grid size-8 cursor-pointer place-items-center rounded-md hover:bg-white/10">
            <X size={16} />
          </button>
        </div>
      </div>
      <div ref={stage} className="grid min-h-0 flex-1 place-items-center" onMouseDown={(e) => e.target === e.currentTarget && dismiss()}>
        {/* The box takes the scaled size, so a tall device (iPad) is centred instead of overflowing. */}
        <div ref={box} style={{ width: outerW * fit, height: outerH * fit }}>
          <div className="origin-top-left" style={{ width: outerW, height: outerH, transform: `scale(${fit})` }}>
            {body}
          </div>
        </div>
      </div>
      <p className="pb-3 text-center text-[11px] text-white/40">
        {live
          ? `The live ${sim.device?.platform === "android" ? "Android emulator" : "iOS Simulator"}: click to tap, drag or use the trackpad to scroll. Esc to close.`
          : platform === "web"
            ? "Your app as a website, in a desktop browser. Esc to close."
            : `The web build of your app in ${platform === "ios" ? "an iOS" : "an Android"} device frame. Esc to close.`}
      </p>
    </div>
  );
}

/** A desktop browser window: traffic lights, address bar, then the page. */
function BrowserWindow({ width, height, chrome, url, dark, children }: { width: number; height: number; chrome: number; url: string; dark: boolean; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[12px] border border-white/15 shadow-2xl" style={{ width, height: height + chrome, background: dark ? "#0b0b10" : "#fff" }}>
      <div className="flex items-center gap-3 border-b border-white/10 bg-[#1f1f23] px-4" style={{ height: chrome }}>
        <span className="flex gap-2">
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <span key={c} className="size-3 rounded-full" style={{ background: c }} />
          ))}
        </span>
        <span className="mx-auto w-[46%] truncate rounded-md bg-black/30 px-3 py-1 text-center font-mono text-[12px] text-white/70">{url}</span>
        <span className="w-[52px]" />
      </div>
      <div className="relative" style={{ height }}>
        {children}
      </div>
    </div>
  );
}

/** URL path as the app sees it, without Sparkflow's own query parameters. */
function cleanPath(p: string) {
  const u = new URL(p, "http://x");
  u.searchParams.delete("play");
  u.searchParams.delete("sf-scheme");
  return u.pathname + (u.search.length > 1 ? u.search : "");
}


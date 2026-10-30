"use client";

import clsx from "clsx";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MediaInput, ScreenState } from "@/lib/shared";
import type { Access } from "@/lib/shared/share";
import { AccessProvider, can } from "@/lib/web/access";
import { APP_SCHEME_KEY, darkStale, inScheme, type AppScheme } from "@/lib/web/app-scheme";
import { useDeviceSkin } from "@/lib/web/device-skin";
import { usePresence } from "@/lib/web/presence";
import { SIM_CHANGED, useSimDevice } from "@/lib/web/sim-device";
import { useProject } from "@/lib/web/useProject";
import { ActivityPanel, type FlowAction, type PanelTab } from "./ActivityPanel";
import { SHOW_ACTIVITY } from "./ReleaseMenu";
import { Canvas } from "./Canvas";
import { CommandPalette, type Command } from "./CommandPalette";
import { DiffViewer } from "./DiffViewer";
import { FileTree } from "./FileTree";
import { FlowDialog, flowPrompt } from "./FlowDialog";
import { HeroFocus } from "./HeroFocus";
import type { LayoutPick } from "./LayoutTree";
import { AppSettings } from "./AppSettings";
import { PlayMode } from "./PlayMode";
import { PromptBar, type Selection } from "./PromptBar";
import { ShareDialog } from "./ShareDialog";
import { TopBar } from "./TopBar";
import { askToNotify, markTitle, notify } from "@/lib/web/notify";

const PANEL_KEY = "sparkflow-panel-width";
const EXPLORER_KEY = "sparkflow-explorer-width";
const pageSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "page";

/** The device the pages are captured in: the live Simulator shows the iPhone captures. */
const shotDevice = (d?: string) => (!d || d === "simulator" ? "iphone" : d);

const OWNER_ACCESS = (projectId: string): Access => ({ role: "owner", me: "owner", projectId, people: {}, sharing: false });

/**
 * `access` is given for a shared app (a guest, through SharedShell), with `basePath` its /s/ URL.
 * Without it this is the owner, whose people come from GET /access.
 */
export function IDE({ id, slug: initialSlug, initialPage, access: given, basePath }: { id: string; slug: string; initialPage: string[]; access?: Access; basePath?: string }) {
  const [ownerAccess, setOwnerAccess] = useState<Access>(() => OWNER_ACCESS(id));
  const access = given ?? ownerAccess;
  const guest = access.role !== "owner";
  const [shareOpen, setShareOpen] = useState(false);
  // null until GET /access answers; false on an older server that has no sharing.
  const [canShare, setCanShare] = useState<boolean | null>(null);
  const api = useProject(id, access.role);
  const { state } = api;
  const sim = useSimDevice();

  // Owner: who the app is shared with. A 404 means an older server that can't share: no Share button.
  const loadAccess = useCallback(() => {
    if (given) return;
    void fetch(`/api/projects/${id}/access`, { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 404) setCanShare(false);
        if (!r.ok) return null;
        setCanShare(true);
        return (await r.json()) as Access;
      })
      .then((a) => a && setOwnerAccess({ ...a, role: "owner", me: "owner" }))
      .catch(() => {});
  }, [given, id]);
  useEffect(loadAccess, [loadAccess]);
  const hasMembers = Object.keys(ownerAccess.people).some((k) => k !== "owner");
  useEffect(() => {
    if (given || (!shareOpen && !hasMembers)) return;
    const t = setInterval(loadAccess, 30_000);
    return () => clearInterval(t);
  }, [given, shareOpen, hasMembers, loadAccess]);
  // Pages shown in an Android emulator wear its frame, on the canvas as in focus.
  const skin = useDeviceSkin(state?.native || state?.previewDevice === "simulator" ? sim.device : null, !sim.loaded || !state);
  const ipad = !!state?.native && !!sim.device?.ipad;

  const [focused, setFocused] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [compare, setCompare] = useState<number | null>(null);
  const [inspect, setInspect] = useState(false);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [layoutHover, setLayoutHover] = useState<LayoutPick | null>(null);
  const [tab, setTab] = useState<PanelTab>("layout");
  const [file, setFile] = useState<{ path: string | null; line: number | null }>({ path: null, line: null });
  // Bumped to show the open file in the explorer's Source tree.
  const [reveal, setReveal] = useState(0);
  const [panelOpen, setPanelOpen] = useState(true);
  // Ship started a build: its log is in Activity.
  useEffect(() => {
    const show = () => {
      setTab("activity");
      setPanelOpen(true);
    };
    addEventListener(SHOW_ACTIVITY, show);
    return () => removeEventListener(SHOW_ACTIVITY, show);
  }, []);
  const [panelW, setPanelW] = useState(340);
  const [explorerW, setExplorerW] = useState(232);
  const [resizing, setResizing] = useState(false);
  const [palette, setPalette] = useState(false);
  const [play, setPlay] = useState(false);
  const [settings, setSettings] = useState<false | "app" | "account">(false);
  const [diff, setDiff] = useState<string | null>(null);
  const [flowDraft, setFlowDraft] = useState<{ type: "link" | "unlink"; from: string; to: string } | null>(null);
  const [scheme, setSchemeState] = useState<AppScheme>("light");
  const [capturingDark, setCapturingDark] = useState(false);
  const [simFrozen, setSimFrozen] = useState<string | null>(null);
  const triedDark = useRef(new Set<string>());

  // The `sparkflow` terminal follows along: this app, the page in focus, Play.
  usePresence(
    state && !guest
      ? { view: "app", projectId: id, page: focused ? state.screens[focused]?.title : undefined, mode: play ? "play" : focused ? "page" : "canvas", device: state.native ? "simulator" : state.previewDevice }
      : null,
  );

  // ---- persisted UI prefs ----
  useEffect(() => {
    try {
      const w = Number(localStorage.getItem(PANEL_KEY));
      if (w) setPanelW(w);
      const ew = Number(localStorage.getItem(EXPLORER_KEY));
      if (ew) setExplorerW(ew);
      if (localStorage.getItem(APP_SCHEME_KEY) === "dark") setSchemeState("dark");
    } catch {}
  }, []);

  // ---- screens as shown: scheme and iPad shots applied ----
  const screens: ScreenState[] = useMemo(() => {
    if (!state) return [];
    return state.order
      .map((r) => state.screens[r])
      .filter(Boolean)
      .map((s) => {
        let x = s;
        if (ipad && sim.device) {
          const shot = s.devices?.[sim.device.name]?.[scheme === "dark" ? "dark" : "light"];
          // iPad numbering starts at v1 and only counts a shot at least as new as the page.
          x = { ...s, screenshotUrl: shot && shot.version >= s.version ? shot.url : undefined, history: shot ? [{ version: 1, url: shot.url, ts: 0 }] : [], version: 1 };
        }
        x = inScheme(x, scheme);
        // Web app in the live Simulator: the pages as captured there (status bar included), once ready.
        if (!state.native && state.previewDevice === "simulator") {
          const shot = s.devices?.simulator?.[scheme];
          if (shot && shot.version >= s.version) return { ...x, screenshotUrl: shot.url };
          return s.screenshotUrl ? { ...x, deviceLoading: true } : x;
        }
        // Web: other preview devices get their own capture, so pages keep that device's proportions.
        const device = shotDevice(state.previewDevice);
        const dev = !state.native && device !== "iphone" ? s.devices?.[device]?.[scheme] : undefined;
        if (dev && dev.version >= s.version) return { ...x, screenshotUrl: dev.url };
        return !state.native && device !== "iphone" && s.screenshotUrl ? { ...x, deviceLoading: true } : x;
      });
  }, [state, scheme, ipad, sim.device]);
  const byRoute = useMemo(() => new Map(screens.map((s) => [s.route, s])), [screens]);

  // ---- URL sync: /p/<id>/<page>?v=<compare> ----
  const slugOf = useCallback(
    (route: string) => {
      const s = state?.screens[route];
      if (!s) return "";
      if (state?.native) {
        const parent = state.edges.find((e) => e.to === route)?.from;
        return parent ? `${pageSlug(state.screens[parent]?.title ?? "")}/${pageSlug(s.title)}` : pageSlug(s.title);
      }
      return pageSlug(s.title);
    },
    [state],
  );
  const restored = useRef(false);
  const [fromUrl, setFromUrl] = useState(false);
  useEffect(() => {
    if (!state || restored.current || !state.order.length) return;
    restored.current = true;
    const wanted = initialPage.join("/");
    if (!wanted) return;
    const r = state.order.find((x) => slugOf(x) === wanted);
    if (r) {
      setFromUrl(true);
      setFocused(r);
      const v = Number(new URLSearchParams(location.search).get("v"));
      if (v) setCompare(v);
    }
  }, [state, initialPage, slugOf]);
  // The URL name follows the app's name (renames, the planner naming a new app).
  const [slug, setSlug] = useState(initialSlug);
  const appName = state?.customName ?? state?.name;
  useEffect(() => {
    // A shared app's URL is its /s/ path, and guests can't list the owner's projects.
    if (!appName || basePath) return;
    void fetch("/api/projects", { cache: "no-store" })
      .then((r) => r.json())
      .then((list: { id: string; slug: string }[]) => {
        const s = list.find((p) => p.id === id)?.slug;
        if (s) setSlug(s);
      })
      .catch(() => {});
  }, [appName, id, basePath]);
  useEffect(() => {
    if (!restored.current && initialPage.length) return;
    const path = `${basePath ?? `/${slug}`}${focused ? `/${slugOf(focused)}` : ""}${focused && compare ? `?v=${compare}` : ""}`;
    if (location.pathname + location.search !== path) history.replaceState(null, "", path);
  }, [focused, compare, slug, basePath, slugOf, initialPage.length]);

  // ---- focus ----
  const open = useCallback(
    (route: string) => {
      setClosing(false);
      setFromUrl(false);
      setCompare(null);
      setFocused(route);
      setTab((t) => (t === "activity" ? t : "layout"));
    },
    [focused],
  );
  const close = useCallback(() => {
    setInspect(false);
    setClosing(true);
  }, []);

  // Picks belong to the page they were made on: leaving it (from the explorer, the preview or a tap in
  // the Simulator) drops them, so they never outline something on another page.
  useEffect(() => setSelections([]), [focused]);

  // Focusing a web page opens its file in Code.
  useEffect(() => {
    if (!focused || !state || state.native) return;
    const f = state.screens[focused]?.file;
    if (f) setFile({ path: f, line: null });
  }, [focused, state?.native]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- selections ----
  const addSelection = useCallback(
    async (sel: Selection) => {
      setSelections((cur) => (cur.some((x) => x.key === sel.key) ? cur.filter((x) => x.key !== sel.key) : [...cur, sel]));
      if (!sel.file && !sel.layout && state && !state.native) {
        const r = await fetch(`/api/projects/${id}/resolve?testId=${encodeURIComponent(sel.testId)}`).then((x) => x.json()).catch(() => null);
        if (r?.file) {
          setSelections((cur) => cur.map((x) => (x.key === sel.key ? { ...x, file: r.file, line: r.line } : x)));
          setFile({ path: r.file, line: r.line });
        }
      }
    },
    [id, state],
  );
  const onHeroSelect = (s: { testId: string; text: string; anchors?: Selection["anchors"]; rect?: { x: number; y: number; width: number; height: number }; area?: { x: number; y: number; width: number; height: number } }) => {
    const area = s.area ?? (s.rect ? { x: s.rect.x / 390, y: s.rect.y / 844, width: s.rect.width / 390, height: s.rect.height / 844 } : undefined);
    const key = `${s.testId}@${area ? [area.x, area.y, area.width, area.height].map((n) => n.toFixed(3)).join(",") : ""}`;
    void addSelection({ key, testId: s.testId, label: s.testId, text: s.text, area, ...(s.anchors ? { anchors: s.anchors } : {}) });
  };
  const onLayoutPick = (p: LayoutPick) => {
    // The hover outline gives way to the persistent blue selection.
    setLayoutHover(null);
    void addSelection({ key: p.key, testId: p.testId ?? p.label, label: p.label, text: p.container ? undefined : p.texts[0], file: p.file, line: p.line, layout: true, anchors: p.anchors, find: p.find });
  };

  // ---- prompts ----
  // When a run ends: a system notification if the tab is in the background (else a toast), and a mark
  // on the tab's title until it's looked at. Not for a run the user stopped.
  const lastStatus = useRef<string | null>(null);
  useEffect(() => {
    if (!state) return;
    const prev = lastStatus.current;
    lastStatus.current = state.status;
    if (prev !== "running" || state.status === "running" || state.status === "stopped" || state.status === "idle") return;
    const ok = state.status === "done";
    const verified = state.order.filter((r) => state.screens[r]?.status === "done").length;
    const said = state.timeline.findLast((t) => t.kind === "agent")?.text;
    const title = ok ? `${state.name} is ready` : `${state.name}: Sparkflow stopped on an error`;
    const body = ok ? `${verified}/${state.order.length} pages verified${said ? ` · ${said.slice(0, 120)}` : ""}` : "Open it to see what went wrong.";
    if (!notify(title, body, `sparkflow-${id}`)) api.setToast(ok ? `Done · ${verified}/${state.order.length} pages verified` : title);
    markTitle(ok ? "✓" : "!");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.status]);

  const send = useCallback(
    async (text: string, image?: MediaInput, audio?: MediaInput, routeOverride?: string | null) => {
      askToNotify();
      const route = routeOverride !== undefined ? (routeOverride ?? undefined) : (focused ?? undefined);
      const first = selections[0];
      const needsPicks = selections.length > 1 || selections.some((s) => s.layout);
      const ok = await api.sendPrompt({
        text,
        ...(route ? { route } : {}),
        ...(first ? { testId: first.testId, ...(first.area ? { area: first.area } : {}) } : {}),
        ...(needsPicks ? { picks: selections.map((s) => ({ testId: s.testId, ...(s.area ? { area: s.area } : {}), ...(s.file ? { file: s.file, line: s.line } : {}) })) } : {}),
        ...(image ? { image } : {}),
        ...(audio ? { audio } : {}),
      });
      if (ok) {
        setSelections([]);
        setInspect(false);
      }
      return !!ok;
    },
    [api, focused, selections],
  );
  const runFlow = (a: FlowAction) => {
    if (!state || !can(access, "agent")) return;
    const { text, route } = flowPrompt(a, (r) => state.screens[r]?.title ?? r);
    void send(text, undefined, undefined, route ?? null);
  };

  // ---- app scheme ----
  const setScheme = async (next: AppScheme) => {
    setSchemeState(next);
    try {
      localStorage.setItem(APP_SCHEME_KEY, next);
    } catch {}
    if (!state || !sim.device) return;
    // A generated app in the live Simulator: the Simulator switches with it (its pages are web captures).
    if (!state.native) {
      if (state.previewDevice === "simulator")
        void fetch("/api/sim/appearance", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ appearance: next, udid: sim.device.udid }) }).catch(() => {});
      return;
    }
    setCapturingDark(true);
    try {
      await fetch("/api/sim/appearance", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ appearance: next, udid: sim.device.udid }) });
      const missing = state.order.some((r) => (next === "dark" ? !state.screens[r]?.dark : !state.screens[r]?.screenshotUrl));
      if (missing) {
        await new Promise((r) => setTimeout(r, 800));
        setSimFrozen("Capturing pages…");
        await api.capture(next === "dark" ? { dark: true } : { refresh: true });
      }
    } finally {
      setSimFrozen(null);
      setCapturingDark(false);
    }
  };

  // Native: adopt the simulator's appearance on mount.
  useEffect(() => {
    if (!state?.native || !sim.device) return;
    fetch("/api/sim/appearance")
      .then((r) => r.json())
      .then((j) => (j.appearance === "dark" || j.appearance === "light") && setSchemeState(j.appearance))
      .catch(() => {});
  }, [state?.native, sim.device]);

  // Web: capture every new version in dark mode too, so the version history covers both appearances.
  useEffect(() => {
    if (!state || state.native || state.status === "running" || capturingDark || !can(access, "agent")) return;
    const stale = state.order.filter((r) => state.screens[r] && darkStale(state.screens[r]));
    const key = stale.map((r) => `${r}@${state.screens[r].version}`).join(",");
    if (!stale.length || triedDark.current.has(key)) return;
    triedDark.current.add(key);
    setCapturingDark(true);
    void api.captureDark().finally(() => setCapturingDark(false));
  }, [state, capturingDark, api, access]);

  // Web: capture pages in the project's preview device (and scheme) when it is not the default iPhone.
  const triedDevice = useRef(new Set<string>());
  const [capturingDevice, setCapturingDevice] = useState(false);
  useEffect(() => {
    const device = shotDevice(state?.previewDevice);
    if (!state || state.native || device === "iphone" || state.status === "running" || capturingDevice || capturingDark || !can(access, "agent")) return;
    const stale = state.order.filter((r) => state.screens[r]?.screenshotUrl && state.screens[r].devices?.[device]?.[scheme]?.version !== state.screens[r].version);
    const key = `${device}:${scheme}:` + stale.map((r) => `${r}@${state.screens[r].version}`).join(",");
    if (!stale.length || triedDevice.current.has(key)) return;
    triedDevice.current.add(key);
    setCapturingDevice(true);
    void api.captureDevice(device, scheme).finally(() => setCapturingDevice(false));
  }, [state, scheme, capturingDevice, capturingDark, api, access]);

  // Web app shown in the live Simulator: capture its pages there (in Sparkflow Dev) when they aren't yet,
  // or are older than the page. The Simulator is driven meanwhile, so it shows a spinner.
  const triedSim = useRef(new Set<string>());
  useEffect(() => {
    if (!state || state.native || state.previewDevice !== "simulator" || !sim.device || state.status === "running" || simFrozen) return;
    const stale = state.order.filter((r) => state.screens[r] && state.screens[r].devices?.simulator?.[scheme]?.version !== state.screens[r].version);
    const key = `${scheme}:` + stale.map((r) => `${r}@${state.screens[r].version}`).join(",");
    if (!stale.length || triedSim.current.has(key)) return;
    triedSim.current.add(key);
    setSimFrozen("Capturing pages…");
    void api.captureSimulator(scheme).finally(() => setSimFrozen(null));
  }, [state, scheme, sim.device, simFrozen, api]);

  // Native: after an agent run, re-capture both appearances.
  const prevStatus = useRef(state?.status);
  useEffect(() => {
    const before = prevStatus.current;
    prevStatus.current = state?.status;
    if (!state?.native || before !== "running" || state.status !== "done" || !sim.device) return;
    const t = setTimeout(async () => {
      setSimFrozen("Capturing pages…");
      try {
        const current = await fetch("/api/sim/appearance").then((r) => r.json()).catch(() => ({}));
        const set = (appearance: string) => fetch("/api/sim/appearance", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ appearance }) });
        await set("light");
        await api.capture();
        await set("dark");
        await api.capture({ dark: true });
        if (current.appearance !== "dark") await set("light");
      } finally {
        setSimFrozen(null);
      }
    }, 1800);
    return () => clearTimeout(t);
  }, [state?.status, state?.native, sim.device, api]);

  // iPad: capture missing shots once per (device, scheme, missing set).
  const iPadTried = useRef(new Set<string>());
  useEffect(() => {
    if (!ipad || !state || !sim.device || state.status === "running") return;
    const missing = state.order.filter((r) => !state.screens[r]?.devices?.[sim.device!.name]?.[scheme === "dark" ? "dark" : "light"]);
    const key = `${sim.device.name}|${scheme}|${missing.join(",")}`;
    if (!missing.length || iPadTried.current.has(key)) return;
    iPadTried.current.add(key);
    setSimFrozen("Capturing pages…");
    void api.capture(scheme === "dark" ? { dark: true } : {}).finally(() => setSimFrozen(null));
  }, [ipad, state, sim.device, scheme, api]);

  const simButton = (button: string, hold: number) => {
    if (!sim.device) return;
    void fetch(`/api/sim/${sim.device.udid}/button`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ button, hold: hold / 1000 }) });
  };

  // ---- keyboard ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement).tagName) || (e.target as HTMLElement).isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
        return;
      }
      if (play || palette) return;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        document.querySelector<HTMLTextAreaElement>("[data-prompt]")?.focus();
      }
      if (e.key === "Escape") {
        if (inspect) setInspect(false);
        else if (focused && !closing) close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [play, palette, inspect, focused, closing, close]);

  // ---- panel resize ----
  /** Drag a side panel's edge. The explorer grows to the right, the right panel to the left. */
  const startResize = (e: React.PointerEvent, side: "left" | "right") => {
    e.preventDefault();
    setResizing(true);
    const startX = e.clientX;
    const startW = side === "right" ? panelW : explorerW;
    const set = side === "right" ? setPanelW : setExplorerW;
    const clamp = (w: number) => (side === "right" ? Math.max(280, Math.min(window.innerWidth * 0.6, w)) : Math.max(180, Math.min(window.innerWidth * 0.4, w)));
    const move = (ev: PointerEvent) => set(clamp(side === "right" ? startW - (ev.clientX - startX) : startW + (ev.clientX - startX)));
    const up = () => {
      setResizing(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      set((w) => {
        try {
          localStorage.setItem(side === "right" ? PANEL_KEY : EXPLORER_KEY, String(Math.round(w)));
        } catch {}
        return w;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const grip = (side: "left" | "right") => (
    <div
      onPointerDown={(e) => startResize(e, side)}
      onDoubleClick={() => (side === "right" ? setPanelW(340) : setExplorerW(232))}
      title="Drag to resize · double-click to reset"
      className={clsx("group absolute top-0 bottom-0 z-20 flex w-4 cursor-col-resize items-center justify-center", side === "right" ? "-left-2" : "-right-2")}>
      {/* Visible grip, brighter while hovered or dragged; outlined so it reads the same over the canvas and over a panel. */}
      <span className={clsx("h-10 w-1 rounded-full ring-1 ring-black/50 transition-colors", resizing ? "bg-spark-500" : "bg-ink-500 group-hover:bg-ink-300")} />
    </div>
  );

  if (api.error) {
    return (
      <div data-ide className="grid h-screen place-items-center bg-ink-950 text-center">
        <div>
          <p className="text-[14px] text-ink-200">{api.error}</p>
          <Link href="/" className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-spark-400 hover:underline">
            <ArrowLeft size={14} /> Back to projects
          </Link>
        </div>
      </div>
    );
  }
  if (!state) {
    return (
      <div data-ide className="grid h-screen place-items-center bg-ink-950">
        <Loader2 className="animate-spin text-ink-500" size={20} />
      </div>
    );
  }

  const focusedScreen = focused ? byRoute.get(focused) : undefined;
  const running = state.status === "running";
  const title = (r: string) => state.screens[r]?.title ?? r;
  const commands: Command[] = [
    ...state.order.map((r) => ({ id: `page:${r}`, group: "Pages" as const, label: title(r), hint: state.screens[r]?.previewPath, keywords: r, run: () => open(r) })),
    { id: "play", group: "Actions", label: "Play", needs: "owner", run: () => setPlay(true) },
    { id: "ask", group: "Actions", label: "Ask the agent…", hint: "/", needs: "agent", run: () => document.querySelector<HTMLTextAreaElement>("[data-prompt]")?.focus() },
    ...(focused ? [{ id: "all", group: "Actions" as const, label: "Show all pages", hint: "esc", run: close }] : []),
    ...(!state.native && state.preview && focused ? [{ id: "point", group: "Actions" as const, label: "Point at an element", needs: "agent" as const, run: () => setInspect(true) }] : []),
    ...(!state.native && focused && (state.screens[focused]?.history.length ?? 0) > 1 && !running
      ? [{ id: "undo", group: "Actions" as const, label: `Undo last change on ${title(focused)}`, needs: "agent" as const, run: () => void api.undo(focused) }]
      : []),
    ...(state.native ? [{ id: "recapture", group: "Actions" as const, label: "Recapture pages from the simulator", needs: "owner" as const, run: () => void api.capture({ refresh: true }) }] : []),
    ...(running ? [{ id: "stop", group: "Actions" as const, label: "Stop the agent", needs: "agent" as const, run: () => void api.stop() }] : []),
    ...(!state.native && state.plan ? [{ id: "export", group: "Project" as const, label: "Export .zip", needs: "owner" as const, run: () => (location.href = `/api/projects/${id}/export`) }] : []),
    { id: "projects", group: "Project", label: "All projects", needs: "owner", run: () => (location.href = "/") },
    { id: "panel", group: "View", label: panelOpen ? "Hide activity panel" : "Show activity panel", run: () => setPanelOpen((o) => !o) },
    { id: "scheme", group: "View", label: scheme === "dark" ? "Show the app in light mode" : "Show the app in dark mode", keywords: "dark light appearance", run: () => void setScheme(scheme === "dark" ? "light" : "dark") },
  ];

  return (
    <AccessProvider value={access}>
    <div data-ide className="flex h-screen flex-col overflow-hidden bg-ink-950 text-ink-100">
      <TopBar
        state={state}
        connected={api.connected}
        scheme={scheme}
        capturingDark={capturingDark}
        onScheme={(s) => void setScheme(s)}
        onRename={(n) => void api.rename(n)}
        onPlay={() => setPlay(true)}
        onPalette={() => setPalette(true)}
        panelOpen={panelOpen}
        onTogglePanel={() => setPanelOpen((o) => !o)}
        onDevice={(d) => void api.setPreviewDevice(d)}
        panelWidth={panelOpen ? panelW : 0}
        onSettings={state.native || guest ? undefined : (section) => setSettings(section ?? "app")}
        onShare={!given && canShare ? () => setShareOpen(true) : undefined}
        onDeviceSwitching={(name) => {
          setSimFrozen(name ? `Starting ${name}…` : null);
          if (!name) window.dispatchEvent(new Event(SIM_CHANGED));
        }}
      />
      <div
        className={clsx("grid min-h-0 flex-1", !resizing && "transition-[grid-template-columns] duration-200")}
        style={{ gridTemplateColumns: `${explorerW}px minmax(0,1fr) ${panelOpen ? panelW : 0}px` }}>
        {/* Full height so the explorer footer (branch · sha · commits) stays pinned at the bottom. */}
        <div className="relative flex min-h-0 flex-col">
        {grip("left")}
        <FileTree
          projectId={id}
          state={state}
          focused={focused}
          onOpenPage={open}
          onAsk={(text) => void send(text)}
          active={file.path}
          reveal={reveal}
          onOpenFile={(p) => {
            setFile({ path: p, line: null });
            setTab("code");
            setPanelOpen(true);
          }}
        />
        </div>
        <main className="relative isolate min-h-0 overflow-hidden">
          <Canvas
            projectId={id}
            screens={screens}
            edges={state.edges}
            hiddenRoute={focused && !closing ? focused : null}
            scanning={new Set(capturingDark ? state.order.filter((r) => state.screens[r] && darkStale(state.screens[r])) : [])}
            ipad={ipad}
            // Simulator captures already hold the status bar: drawn bare, like a native app's.
            native={!!state.native || state.previewDevice === "simulator"}
            skin={skin}
            dark={scheme === "dark"}
            device={shotDevice(state.previewDevice)}
            status={state.status}
            canLink={!state.native && !running && can(access, "canvas")}
            // The canvas lights up again while the phone flies back.
            dimmed={!!focused && !closing}
            onOpen={open}
            onLink={(from, to) => setFlowDraft({ type: "link", from, to })}
            onUnlink={(from, to) => setFlowDraft({ type: "unlink", from, to })}
            onAddPage={(a) => runFlow({ type: "add", ...a })}
            onAsk={(text, route) => void send(text, undefined, undefined, route)}
          />
          {focused && focusedScreen && (
            <HeroFocus
              // Stable: switching pages keeps the phone in place instead of flying it in again.
              key="hero"
              instant={fromUrl}
              projectId={id}
              state={state}
              screen={focusedScreen}
              scheme={scheme}
              closing={closing}
              onClosed={() => {
                setFocused(null);
                setClosing(false);
                setCompare(null);
              }}
              compare={compare}
              onCompare={setCompare}
              inspect={inspect}
              selections={selections}
              onSelect={onHeroSelect}
              onNavigate={(r) => r !== focused && setFocused(r)}
              layoutHover={layoutHover}
              simPoints={sim.device?.points ?? null}
              ipad={ipad}
              simFrozen={simFrozen}
              onSimPage={(pg) => {
                const same = (a?: string) => a?.trim().toLowerCase() === pg.title.trim().toLowerCase();
                const tabs = state.order.filter((x) => x.includes("/(tabs)/"));
                const r = state.order.find((x) => same(state.screens[x]?.title)) ?? (pg.tab ? tabs[pg.tab - 1] : undefined);
                if (r) setFocused(r);
              }}
              onSendPrompt={(t) => void send(t)}
              onRestore={(v) => void api.restore(focused, v)}
              onUndo={() => void api.undo(focused)}
              onDiff={setDiff}
              onSimButton={simButton}
              onScheme={(m) => void setScheme(m)}
              capturingDark={capturingDark}
              onInspect={setInspect}
              onPlay={() => setPlay(true)}
              onDevice={(d) => void api.setPreviewDevice(d)}
            />
          )}
          <PromptBar
            state={state}
            focusedTitle={focusedScreen?.title}
            selections={selections}
            inspect={inspect}
            canInspect={!!focused && (!!state.preview || !!state.native) && can(access, "agent")}
            onInspect={setInspect}
            onRemoveSelection={(k) => setSelections((s) => s.filter((x) => x.key !== k))}
            onAllPages={close}
            onSend={(t, img, aud) => send(t, img, aud)}
            onStop={() => void api.stop()}
          />
          {api.toast && <div className="animate-fade-in absolute top-4 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-2 text-[12.5px] text-ink-100 shadow-xl">{api.toast}</div>}
        </main>
        <div className="relative min-h-0 border-l border-[var(--line)]">
          {panelOpen && (
            <>
              {grip("right")}
              <ActivityPanel
                projectId={id}
                state={state}
                focused={focused}
                tab={tab}
                onTab={setTab}
                file={file.path}
                line={file.line}
                onFile={(p, l) => {
                  setFile({ path: p, line: l ?? null });
                  setTab("code");
                }}
                onReveal={() => setReveal((n) => n + 1)}
                onLayoutHover={setLayoutHover}
                onLayoutPick={onLayoutPick}
                selectedKeys={new Set(selections.map((x) => x.key))}
                onOpenPage={open}
                onFlow={runFlow}
              />
            </>
          )}
        </div>
      </div>
      {palette && <CommandPalette commands={commands} onClose={() => setPalette(false)} />}
      {play && !guest && <PlayMode state={state} scheme={scheme} startPath={focusedScreen?.previewPath ?? "/"} onClose={() => setPlay(false)} onSimButton={simButton} onDevice={(d) => void api.setPreviewDevice(d)} />}
      {settings && !guest && <AppSettings projectId={id} appName={state.name} initial={settings} onClose={() => setSettings(false)} />}
      {diff && <DiffViewer projectId={id} sha={diff} onClose={() => setDiff(null)} />}
      {flowDraft && (
        <FlowDialog
          draft={flowDraft}
          title={title}
          onCancel={() => setFlowDraft(null)}
          onConfirm={(a) => {
            setFlowDraft(null);
            runFlow(a);
          }}
        />
      )}
      {shareOpen && <ShareDialog projectId={id} appName={state.customName ?? state.name} onClose={() => setShareOpen(false)} onChanged={loadAccess} />}
    </div>
    </AccessProvider>
  );
}

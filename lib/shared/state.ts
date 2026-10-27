import type { MediaInput } from "./api";
import type { AgentEvent, NavEdge, Phase, RunStatus, ScreenStatus, StoredEvent, Usage } from "./events";
import type { AppPlan } from "./plan";
import type { QualityReport } from "./quality";
import { previewPathFor } from "./routes";
import type { Verdict } from "./verdict";

export type ProjectMeta = {
  id: string;
  name: string;
  prompt: string;
  createdAt: number;
  inputs: { image: boolean; audio: boolean };
  native?: { dir: string; bundleId?: string };
};
export type { MediaInput };

export type Shot = { url: string; version: number; quality?: QualityReport };

export type ScreenState = {
  route: string;
  title: string;
  file: string;
  previewPath: string;
  status: ScreenStatus;
  version: number;
  attempt: number;
  screenshotUrl?: string;
  screenshotVersion?: number;
  /** One shot per version; `dark` is the same version captured in dark mode. */
  history: { version: number; url: string; ts: number; dark?: string }[];
  verdict?: Verdict;
  quality?: QualityReport & { version: number };
  dark?: Shot;
  devices?: Record<string, { light?: Shot; dark?: Shot }>;
  /** Client only: the preview device's capture is still being taken. */
  deviceLoading?: boolean;
};

export type TimelineEntry =
  | { kind: "user"; seq: number; ts: number; id: string; text: string; route?: string; testId?: string }
  | { kind: "agent"; seq: number; ts: number; text: string; route?: string };

export type ProjectState = ProjectMeta & {
  customName?: string;
  /** Device the web build is previewed in (focus view, canvas, landing cards). */
  previewDevice?: string;
  status: RunStatus;
  statusMessage?: string;
  phase: Phase;
  phaseRoute?: string;
  phaseDetail?: string;
  plan?: AppPlan;
  order: string[];
  screens: Record<string, ScreenState>;
  edges: NavEdge[];
  tree: string[];
  preview?: { webUrl: string; expoGoUrl: string | null };
  usage: Usage;
  logs: { seq: number; ts: number; level: "info" | "error"; message: string; route?: string }[];
  timeline: TimelineEntry[];
  commits: { sha: string; message: string; routes: string[]; ts: number }[];
  lastSeq: number;
};

const MAX_LOGS = 400;
const MAX_HISTORY = 20;

export function initialState(meta: ProjectMeta): ProjectState {
  return {
    ...meta,
    status: "idle",
    phase: "idle",
    order: [],
    screens: {},
    edges: [],
    tree: [],
    usage: { inputTokens: 0, outputTokens: 0, cachedTokens: 0, costUsd: 0, calls: 0 },
    logs: [],
    timeline: [],
    commits: [],
    lastSeq: 0,
  };
}

export function mergeEdges(...lists: NavEdge[][]) {
  const seen = new Map<string, NavEdge>();
  for (const e of lists.flat()) {
    if (e.from === e.to) continue;
    const k = `${e.from}→${e.to}`;
    if (!seen.has(k)) seen.set(k, e);
  }
  return [...seen.values()];
}

function blankScreen(route: string): ScreenState {
  return { route, title: route, file: "", previewPath: previewPathFor(route), status: "pending", version: 0, attempt: 0, history: [] };
}

/** Pure reducer shared by the server and the browser. Events at or below lastSeq are ignored. */
export function applyEvent(state: ProjectState, ev: StoredEvent): ProjectState {
  if (ev.seq <= state.lastSeq) return state;
  const s: ProjectState = { ...state, lastSeq: ev.seq };
  const screen = (route: string) => {
    const cur = s.screens[route] ?? blankScreen(route);
    const next = { ...cur };
    s.screens = { ...s.screens, [route]: next };
    if (!s.order.includes(route)) s.order = [...s.order, route];
    return next;
  };
  const e = ev as AgentEvent & { seq: number; ts: number };
  switch (e.type) {
    case "plan": {
      s.plan = e.plan;
      s.name = s.customName ?? e.plan.name;
      s.order = e.plan.screens.map((p) => p.route);
      const screens = { ...s.screens };
      for (const p of e.plan.screens) {
        const cur = screens[p.route] ?? blankScreen(p.route);
        screens[p.route] = { ...cur, title: p.title, file: p.file, previewPath: p.previewPath ?? previewPathFor(p.route) };
      }
      s.screens = screens;
      const planEdges = e.plan.screens.flatMap((p) => p.navigatesTo.map((to) => ({ from: p.route, to, source: "plan" as const })));
      s.edges = mergeEdges(
        s.edges.filter((x) => x.source === "code"),
        planEdges,
      );
      break;
    }
    case "screen_status": {
      const sc = screen(e.route);
      sc.status = e.status;
      sc.version = e.version;
      if (e.attempt != null) sc.attempt = e.attempt;
      break;
    }
    case "screenshot": {
      const sc = screen(e.route);
      sc.screenshotUrl = e.url;
      sc.screenshotVersion = e.version;
      const prev = sc.history.find((h) => h.version === e.version);
      sc.history = [...sc.history.filter((h) => h.version !== e.version), { version: e.version, url: e.url, ts: e.ts, dark: prev?.dark }]
        .sort((a, b) => a.version - b.version)
        .slice(-MAX_HISTORY);
      break;
    }
    case "verdict":
      screen(e.verdict.route).verdict = e.verdict;
      break;
    case "quality":
      screen(e.route).quality = { ...e.report, version: e.version };
      break;
    case "dark_shot":
    {
      const sc = screen(e.route);
      sc.dark = { url: e.url, version: e.version, quality: e.report };
      sc.history = sc.history.map((h) => (h.version === e.version ? { ...h, dark: e.url } : h));
      break;
    }
    case "device_shot": {
      const sc = screen(e.route);
      const d = { ...(sc.devices?.[e.device] ?? {}) };
      d[e.dark ? "dark" : "light"] = { url: e.url, version: e.version };
      sc.devices = { ...sc.devices, [e.device]: d };
      break;
    }
    case "log":
      s.logs = [...s.logs, { seq: e.seq, ts: e.ts, level: e.level, message: e.message, route: e.route }].slice(-MAX_LOGS);
      break;
    case "files_changed":
      break;
    case "preview_ready":
      s.preview = { webUrl: e.webUrl, expoGoUrl: e.expoGoUrl };
      break;
    case "run_status":
      s.status = e.status;
      s.statusMessage = e.message;
      break;
    case "phase":
      s.phase = e.phase;
      s.phaseRoute = e.route;
      s.phaseDetail = e.detail;
      break;
    case "nav":
      s.edges = mergeEdges(
        s.edges.filter((x) => x.source === "plan"),
        e.edges,
      );
      break;
    case "tree":
      s.tree = e.files;
      break;
    case "usage": {
      const { type: _t, seq: _s, ts: _ts, ...u } = e;
      s.usage = u;
      break;
    }
    case "user_prompt":
      s.timeline = [...s.timeline, { kind: "user", seq: e.seq, ts: e.ts, id: e.id, text: e.text, route: e.route, testId: e.testId }];
      break;
    case "agent_message":
      s.timeline = [...s.timeline, { kind: "agent", seq: e.seq, ts: e.ts, text: e.text, route: e.route }];
      break;
    case "commit":
      s.commits = [...s.commits, { sha: e.sha, message: e.message, routes: e.routes, ts: e.ts }];
      break;
    case "preview_device":
      s.previewDevice = e.device;
      break;
    case "renamed":
      s.name = e.name;
      s.customName = e.name;
      break;
  }
  return s;
}

export function foldEvents(meta: ProjectMeta, events: StoredEvent[]) {
  return events.reduce(applyEvent, initialState(meta));
}

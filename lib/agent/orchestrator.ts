import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { lstat, readdir, readFile, readlink, symlink, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { isCode, rewriteImports } from "./rename";
import { prepareAttachments } from "./attachments";
import { scheduleSnapshot } from "../share/cloud";
import sharp from "sharp";
import {
  appSlugs,
  fileToRoute,
  isScreenFile,
  previewPathFor,
  routeSlug,
  verdictPasses,
  type AppPlan,
  type CreateProjectRequest,
  type MediaInput,
  type Phase,
  type ProjectMeta,
  type ProjectSummary,
  type PromptRequest,
  type ResolvedElement,
  type ScreenPlan,
  type StoredEvent,
  type Verdict,
} from "../shared";
import { PREVIEW_DEVICES } from "../web/devices";
import { createDriver } from "../sandbox";
import { FolderSandbox, listSourceFiles } from "../sandbox/local";
import type { InspectTargetResult, Sandbox, SandboxDriver } from "../sandbox/types";
import { dataDir, expandHome, migrateDataDir } from "../sandbox/util";
import { isMac } from "../web/platform";
import { loadEnv } from "./env";
import { createProvider } from "./llm";
import type { LLMProvider } from "./llm/types";
import { describeSegments, metaMediaAvailable, segmentUI } from "./meta";
import { edgesFromSources } from "./nav";
import {
  builderSystem,
  fixTask,
  foundationTask,
  nativeBuilderSystem,
  nativePromptTask,
  screenTask,
  userPromptTask,
  type PickInfo,
} from "./prompts";
import { runBuilderTask, runPlanner, runtimeProblems, runVerifier, type RoleDeps } from "./roles";
import { ProjectRuntime } from "./runtime";
import { applyDemoOverlay, DEMO_NAME, DEMO_PROMPT, demoAction, isDemoProject, isSeeded, loadDemoPlan, markSeeded } from "./seed";
import { ProjectStore } from "./store";
import { lang, type LangRequest } from "./lang";
import type { ReleaseTarget } from "@/lib/web/release";
import { gitCommit, typecheck, type ToolContext, type ToolName } from "./tools";
import { BudgetExceededError, UsageMeter } from "./usage";

/** What the app Settings dialog edits (app.json). */
export type AppSettings = {
  name: string;
  version: string;
  bundleIdentifier: string;
  androidPackage: string;
  orientation: "portrait" | "landscape" | "default";
  appearance: "automatic" | "light" | "dark";
  splashBackground: string;
  iconBackground: string;
};

export type SyncPackage = { meta: ProjectMeta; events: string; bundle: string; shots: string[] };

export class BusyError extends Error {
  constructor() {
    super("The agent is already working on this project.");
  }
}

export type OrchestratorConfig = { maxAttempts: number; maxBuilderTurns: number; maxCostUsd: number; maxRunMinutes: number };

export function configFromEnv(): OrchestratorConfig {
  loadEnv();
  const n = (k: string, d: number) => (Number(process.env[k]) > 0 ? Number(process.env[k]) : d);
  return {
    maxAttempts: n("SPARKFLOW_MAX_ATTEMPTS", 3),
    maxBuilderTurns: n("SPARKFLOW_MAX_BUILDER_TURNS", 30),
    maxCostUsd: n("SPARKFLOW_MAX_COST_USD", 5),
    maxRunMinutes: n("SPARKFLOW_MAX_RUN_MINUTES", 45),
  };
}

const SHARED_FILES = ["lib/store.ts", "theme.json"];
const ASSET_EXT = /\.(png|jpe?g|gif|webp|svg|ttf|otf|mp3|wav|m4a|aac|json|lottie)$/i;
const MAX_ASSET = 15 * 1024 * 1024;
const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "untitled";
const shq = (s: string) => `'${s.replace(/'/g, "'\\''")}'`;

export type NativePage = { title: string; parent?: string; file?: string; png: Buffer };

export class Orchestrator {
  store = new ProjectStore();
  provider: LLMProvider;
  cfg = configFromEnv();
  private driverP: Promise<SandboxDriver>;
  private runtimes = new Map<string, Promise<ProjectRuntime>>();
  /** Runs started by a shared-project guest; every tool context of such a run is restricted. */
  private guestRuns = new WeakSet<ProjectRuntime>();

  constructor() {
    migrateDataDir();
    this.provider = createProvider();
    this.driverP = createDriver();
    // The cloud starts empty: each person's own apps only (no demo built for nobody).
    if (process.env.SPARKFLOW_CLOUD !== "1") this.seedDemo().catch((err) => this.seedFailed(err));
  }

  async info() {
    const driver = await this.driverP;
    return { llm: this.provider.name, sandbox: driver.name, model: this.provider.modelFor("builder"), cfg: this.cfg };
  }

  // ---------- runtime plumbing ----------

  runtime(id: string): Promise<ProjectRuntime> {
    let p = this.runtimes.get(id);
    if (!p) {
      p = (async () => {
        const meta = await this.store.readMeta(id);
        const rt = new ProjectRuntime(meta, await this.store.readEvents(id), this.store);
        // A run cut short by a server restart is reported as stopped.
        if (rt.state.status === "running") {
          rt.emit({ type: "run_status", status: "stopped", message: "Interrupted (server restart)" });
          this.phase(rt, { phase: "idle" });
        }
        rt.meter = new UsageMeter(this.provider, this.cfg.maxCostUsd, (u) => rt.emit({ type: "usage", ...u }), rt.state.usage);
        void this.pruneDeleted(rt).catch(() => {});
        // Every project keeps a read-only copy in the cloud (pages, links, screenshots) for when this Mac is off.
        rt.listeners.add((e) => {
          if (["plan", "screenshot", "dark_shot", "nav", "renamed", "run_status"].includes(e.type)) this.cloudSync(id);
        });
        // Once on load too: projects made before the cloud copy existed get theirs.
        if (rt.state.order.length) this.cloudSync(id);
        return rt;
      })();
      this.runtimes.set(id, p);
      p.catch(() => this.runtimes.delete(id));
    }
    return p;
  }

  /** A step of the agent loop, with the Meta model doing it (shown in Activity and the prompt bar). */
  private phase(rt: ProjectRuntime, e: { phase: Phase; route?: string; detail?: string; model?: string }) {
    const role = e.phase === "planner" || e.phase === "builder" || e.phase === "verifier" ? e.phase : null;
    return rt.emit({ type: "phase", ...e, ...(e.model || !role ? {} : { model: this.provider.modelFor(role) }) });
  }

  /** Refreshes the project's cloud copy soon (none until this server has its Firebase identity). */
  cloudSync(id: string) {
    scheduleSnapshot(id, async () => {
      const rt = await this.runtime(id);
      return { state: rt.state, readShot: (name: string) => this.store.readShot(id, name) };
    });
  }

  /**
   * On load: pages whose file was deleted (git saw it) but are still in the plan, from before deleted pages
   * left it, are dropped. Local projects only (a cloud sandbox isn't opened just for this).
   */
  private async pruneDeleted(rt: ProjectRuntime) {
    const plan = rt.state.plan;
    if (rt.meta.native || !plan || rt.running || (await this.driverP).name !== "local") return;
    const sb = await this.sandbox(rt);
    const files = plan.screens.filter((sc) => !sc.file.endsWith("_layout.tsx")).map((sc) => sc.file);
    const deleted = await this.deletedFiles(sb, files, new Set(), "HEAD");
    if (!deleted.size || rt.running || rt.state.plan !== plan) return;
    const gone = new Set(plan.screens.filter((sc) => deleted.has(sc.file)).map((sc) => sc.route));
    const next = { ...plan, screens: plan.screens.filter((sc) => !gone.has(sc.route)).map((sc) => ({ ...sc, navigatesTo: sc.navigatesTo.filter((r) => !gone.has(r)) })) };
    rt.emit({ type: "plan", plan: next, removed: [...gone] });
    await rt.flush();
  }

  private async sandbox(rt: ProjectRuntime): Promise<Sandbox> {
    if (rt.meta.native) return (rt.sandbox ??= new FolderSandbox(rt.meta.id, rt.meta.native.dir));
    // Shared promise: concurrent callers (the run, the explorer) wait for the same sandbox.
    rt.sandboxP ??= this.driverP.then((d) => d.open(rt.meta.id));
    rt.sandbox = await rt.sandboxP;
    return rt.sandbox;
  }

  private deps(rt: ProjectRuntime): RoleDeps {
    return { provider: this.provider, meter: rt.meter!, signal: rt.abort?.signal, emit: rt.emit };
  }

  private async toolCtx(rt: ProjectRuntime, extra: Partial<ToolContext> = {}): Promise<ToolContext> {
    const sandbox = await this.sandbox(rt);
    const driver = await this.driverP;
    return {
      sandbox,
      plan: rt.state.plan,
      emit: rt.emit,
      signal: rt.abort?.signal,
      local: driver.name === "local",
      media: metaMediaAvailable(this.provider),
      touched: new Set(),
      commit: (m) => gitCommit(sandbox, m),
      ...extra,
      // Last, so no caller's extra (native runs pass unrestricted) can lift it.
      ...(this.guestRuns.has(rt) ? { guest: true, unrestricted: false } : {}),
    };
  }

  /** Runs one job at a time per project, with wall-clock and status bookkeeping. */
  private runExclusive(rt: ProjectRuntime, job: () => Promise<void>) {
    if (rt.running) throw new BusyError();
    rt.running = true;
    rt.abort = new AbortController();
    const timer = setTimeout(() => rt.abort?.abort(new Error(`Run exceeded ${this.cfg.maxRunMinutes} minutes`)), this.cfg.maxRunMinutes * 60_000);
    rt.emit({ type: "run_status", status: "running" });
    rt.idle = (async () => {
      try {
        await job();
        rt.emit({ type: "run_status", status: "done" });
      } catch (err) {
        const aborted = rt.abort?.signal.aborted;
        const reason = rt.abort?.signal.reason;
        const message = aborted ? (reason instanceof Error ? reason.message : "Stopped") : String((err as Error).message ?? err);
        if (err instanceof BudgetExceededError) rt.log(err.message, undefined, "error");
        else if (!aborted) rt.log(`Run failed: ${message}`, undefined, "error");
        // Nothing may keep spinning on the canvas.
        for (const s of rt.state.order.map((r) => rt.state.screens[r]).filter(Boolean)) {
          if (s.status === "building" || s.status === "verifying") rt.emit({ type: "screen_status", route: s.route, status: "failed", version: s.version, attempt: s.attempt });
        }
        rt.emit({ type: "run_status", status: aborted ? "stopped" : "failed", message });
      } finally {
        clearTimeout(timer);
        this.phase(rt, { phase: "idle" });
        await rt.sandbox?.persist?.().catch(() => {});
        await rt.flush();
        // In the cloud, the code ready for a Mac to take, while the sandbox is awake.
        if (rt.sandbox?.persist && !rt.meta.native) await this.cacheBundle(rt).catch(() => {});
        this.guestRuns.delete(rt);
        rt.running = false;
      }
    })();
  }

  // ---------- projects ----------

  /** `claim`: runs once the project exists, before its build (the cloud records whose it is). */
  async createProject(req: CreateProjectRequest, claim?: (id: string) => unknown): Promise<ProjectMeta> {
    // Files dropped on the landing prompt: the first picture is the sketch the Planner looks at, text joins the prompt.
    if (req.attachments?.length) {
      const att = await prepareAttachments(req.attachments);
      const first = att.images[0];
      req = { ...req, prompt: [req.prompt, att.text].filter(Boolean).join("\n\n"), ...(!req.image && first ? { image: { mediaType: first.mediaType, data: first.data } } : {}) };
    }
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const meta: ProjectMeta = {
      id,
      // The Planner names the app; until then, a neutral name rather than the start of the prompt.
      name: "New app",
      prompt: req.prompt,
      createdAt: Date.now(),
      inputs: { image: !!req.image, audio: !!req.audio },
    };
    await this.store.create(meta);
    if (req.image) await this.store.saveInput(id, "image", req.image);
    if (req.audio) await this.store.saveInput(id, "audio", req.audio);
    await claim?.(id);
    const rt = await this.runtime(id);
    this.runExclusive(rt, () => this.generate(rt, req.prompt));
    return meta;
  }

  async listProjects(): Promise<ProjectSummary[]> {
    const metas = await this.store.list();
    const list = await Promise.all(
      metas.map(async (m) => {
        const rt = await this.runtime(m.id).catch(() => null);
        const s = rt?.state;
        const cover = s?.order.map((r) => s.screens[r]).find((x) => x?.screenshotUrl)?.screenshotUrl;
        if (!m.native) void this.linkFolder(m.id, s?.name ?? m.name).catch(() => {});
        return {
          id: m.id,
          name: s?.name ?? m.name,
          prompt: m.prompt,
          createdAt: m.createdAt,
          status: s?.status ?? "idle",
          screenCount: s?.order.length ?? 0,
          ...(cover ? { coverUrl: cover } : {}),
          ...(m.native ? { native: true } : {}),
          ...(s?.previewDevice ? { previewDevice: s.previewDevice } : {}),
          bundleId: m.native ? m.native.bundleId : await this.bundleIdOf(m.id, s?.name ?? m.name),
        };
      }),
    );
    const slugs = appSlugs(list);
    return list.map((p) => ({ ...p, slug: slugs.get(p.id)! }));
  }

  /** Project id for a URL name (or an id, for old links). */
  async resolveSlug(slug: string) {
    const list = await this.listProjects();
    return (list.find((p) => p.slug === slug) ?? list.find((p) => p.id === slug))?.id ?? null;
  }

  async getState(id: string) {
    return (await this.runtime(id)).state;
  }

  async renameProject(id: string, name: string) {
    const rt = await this.runtime(id);
    const clean = name.trim().slice(0, 60);
    if (!clean) throw new Error("Name cannot be empty");
    rt.emit({ type: "renamed", name: clean });
    rt.meta = { ...rt.meta, name: clean };
    await this.store.updateMeta(rt.meta);
  }

  async setPreviewDevice(id: string, device: string) {
    const rt = await this.runtime(id);
    if (!/^[a-z0-9-]{1,32}$/.test(device)) throw new Error("Invalid device");
    rt.emit({ type: "preview_device", device });
    await rt.flush();
  }

  async deleteProject(id: string) {
    const rt = await this.runtime(id);
    rt.abort?.abort(new Error("Project deleted"));
    await rt.idle.catch(() => {});
    rt.listeners.clear();
    // Never delete a native project's own folder.
    if (!rt.meta.native) await (await this.driverP).remove(id).catch(() => {});
    else await rt.sandbox?.terminate();
    this.runtimes.delete(id);
    await this.store.delete(id);
  }

  async stop(id: string) {
    const rt = await this.runtime(id);
    rt.abort?.abort(new Error("Stopped"));
  }

  async ensurePreview(id: string) {
    const rt = await this.runtime(id);
    if (rt.meta.native) return null;
    const sb = await this.sandbox(rt);
    const p = await sb.startDevServer();
    if (rt.state.preview?.webUrl !== p.webUrl) rt.emit({ type: "preview_ready", webUrl: p.webUrl, expoGoUrl: p.expoGoUrl });
    return p;
  }

  /** Replays from `since` then streams live. No gaps: the ring or the log file, with live events buffered meanwhile. */
  async streamEvents(id: string, since: number, send: (e: StoredEvent) => void): Promise<() => void> {
    const rt = await this.runtime(id);
    let last = since;
    const deliver = (e: StoredEvent) => {
      if (e.seq <= last) return;
      last = e.seq;
      send(e);
    };
    const first = rt.ring[0];
    if (!first || first.seq <= since + 1) {
      for (const e of rt.ring) deliver(e);
      rt.listeners.add(deliver);
      return () => rt.listeners.delete(deliver);
    }
    const buffer: StoredEvent[] = [];
    const buffering = (e: StoredEvent) => buffer.push(e);
    rt.listeners.add(buffering);
    await rt.flush();
    for (const e of await this.store.readEvents(id)) deliver(e);
    for (const e of buffer) deliver(e);
    rt.listeners.delete(buffering);
    rt.listeners.add(deliver);
    return () => rt.listeners.delete(deliver);
  }

  // ---------- generation ----------

  private async generate(rt: ProjectRuntime, prompt: string) {
    const deps = this.deps(rt);
    this.phase(rt, { phase: "sandbox" });
    const sb = await this.sandbox(rt);
    const preview = sb.startDevServer().then(
      (p) => (rt.emit({ type: "preview_ready", webUrl: p.webUrl, expoGoUrl: p.expoGoUrl }), p),
      (err) => (rt.log(`Preview failed to start: ${(err as Error).message.split("\n")[0]}`, undefined, "error"), null),
    );

    this.phase(rt, { phase: "planner" });
    const image = await this.store.readInput(rt.meta.id, "image");
    const audio = await this.store.readInput(rt.meta.id, "audio");
    let segments: string | undefined;
    if (image && metaMediaAvailable(this.provider)) {
      this.phase(rt, { phase: "planner", detail: "segmenting the sketch", model: "sam-3.1" });
      rt.log("Segmenting the sketch with SAM 3.1…");
      try {
        const segs = await segmentUI(image, undefined, rt.abort?.signal);
        segments = describeSegments(segs);
        if (segs.length) rt.meter!.addCost(0.025);
        rt.log(`SAM found ${segs.length} UI regions.`);
      } catch (err) {
        rt.log(`Segmentation failed, planning from the image only (${(err as Error).message})`, undefined, "error");
      }
    }
    // The planner, listening to the voice memo when there is one (an audio-capable Muse model).
    this.phase(rt, { phase: "planner", detail: audio ? "listening and planning" : "planning the pages", model: this.provider.modelFor("planner", { hasAudio: !!audio }) });
    rt.log(`Planning with ${this.provider.modelFor("planner", { hasAudio: !!audio })}…`);
    const plan = await runPlanner(deps, { prompt, image, audio, segments });
    rt.emit({ type: "plan", plan });
    if (!rt.state.customName) {
      rt.meta = { ...rt.meta, name: plan.name };
      await this.store.updateMeta(rt.meta);
    }
    for (const s of plan.screens) rt.emit({ type: "screen_status", route: s.route, status: "pending", version: 0 });
    rt.emit({ type: "agent_message", text: `Plan ready: ${plan.screens.length} screens — ${plan.screens.map((s) => s.title).join(", ")}.` });

    // The template's kit gallery would shadow "/".
    if (!plan.screens.some((s) => s.file === "app/index.tsx")) await sb.exec("rm -f app/index.tsx");

    const rules = await sb.readFile("AGENT_RULES.md").catch(() => "");
    const system = builderSystem(rules, plan, prompt);
    this.phase(rt, { phase: "builder", detail: "foundation" });
    const ctx = await this.toolCtx(rt);
    const files = await this.readFiles(sb, ["theme.json", "lib/storage.ts", "lib/store.ts", "app/_layout.tsx", ...plan.screens.map((s) => s.file).filter((f) => f.endsWith("_layout.tsx"))]);
    await runBuilderTask(deps, ctx, { system, task: foundationTask(plan, files), maxTurns: this.cfg.maxBuilderTurns });
    await this.compileGate(rt, system);
    const sha = await gitCommit(sb, "Foundation: theme, store, navigation");
    if (sha) rt.emit({ type: "commit", sha, message: "Foundation: theme, store, navigation", routes: [] });
    await preview;
    await this.emitTree(rt);

    for (const s of plan.screens) await this.buildScreen(rt, system, s);

    this.phase(rt, { phase: "verifier", detail: "final pass" });
    await this.refreshShots(rt, plan.screens.map((s) => s.route), false);
    await this.updateNav(rt);
    const passed = plan.screens.filter((s) => rt.state.screens[s.route]?.status === "done").length;
    rt.emit({
      type: "agent_message",
      text: `${rt.state.name} is ready: ${passed}/${plan.screens.length} screens passed visual verification. Click a page to focus it, then describe changes.`,
    });
  }

  private async readFiles(sb: Sandbox, paths: string[]) {
    const out: Record<string, string> = {};
    for (const p of [...new Set(paths)]) {
      try {
        out[p] = await sb.readFile(p);
      } catch {}
    }
    return out;
  }

  private screenPlan(rt: ProjectRuntime, route: string) {
    return rt.state.plan?.screens.find((s) => s.route === route);
  }

  private async buildScreen(rt: ProjectRuntime, system: string, s: ScreenPlan) {
    const sb = await this.sandbox(rt);
    const version = (rt.state.screens[s.route]?.version ?? 0) + 1;
    rt.emit({ type: "screen_status", route: s.route, status: "building", version, attempt: 1 });
    this.phase(rt, { phase: "builder", route: s.route, detail: s.title });
    const preview = rt.state.preview?.webUrl ?? "";
    const files = await this.readFiles(sb, [s.file, ...SHARED_FILES]);
    const ctx = await this.toolCtx(rt);
    await runBuilderTask(this.deps(rt), ctx, { system, task: screenTask(s, preview + (s.previewPath ?? "/"), files), maxTurns: this.cfg.maxBuilderTurns, route: s.route });
    const ok = await this.verifyLoop(rt, system, s, version);
    const msg = `${s.title} v${version}${ok ? "" : " (unverified)"}`;
    const sha = await gitCommit(sb, msg);
    if (sha) rt.emit({ type: "commit", sha, message: msg, routes: [s.route] });
    await this.updateNav(rt);
    await this.emitTree(rt);
  }

  // ---------- demo app ----------

  /**
   * First start: the Wander demo (templates/demo) joins My apps, planned and captured without a model call.
   * Marked seeded only once built: a failed build is rebuilt from the overlay at the next start, or by Retry.
   */
  private async seedDemo() {
    const action = await demoAction(await this.store.list());
    if (action.kind !== "create" && action.kind !== "rebuild") return;
    let id = action.kind === "rebuild" ? action.id : "";
    if (!id) {
      const meta: ProjectMeta = { id: "wander", name: DEMO_NAME, prompt: DEMO_PROMPT, createdAt: Date.now(), inputs: { image: false, audio: false } };
      await this.store.create(meta);
      id = meta.id;
    }
    const rt = await this.runtime(id);
    if (!rt.running) this.runExclusive(rt, () => this.buildDemo(rt));
  }

  /**
   * The Wander demo, asked for from My apps: recreated (and built again) when it's gone, even after it was
   * seeded once, e.g. after you emptied the apps folder. Returns its id.
   */
  async ensureDemo(scope?: { mine: Set<string>; claim: (id: string) => unknown }) {
    const list = await this.store.list();
    // In the cloud each person has their own demo (`scope`: theirs, and how to make one theirs).
    const demo = list.find((p) => isDemoProject(p) && (!scope || scope.mine.has(p.id)));
    if (demo) return demo.id;
    const id = list.some((p) => p.id === "wander") ? `wander-${Date.now().toString(36)}` : "wander";
    await this.store.create({ id, name: DEMO_NAME, prompt: DEMO_PROMPT, createdAt: Date.now(), inputs: { image: false, audio: false } });
    await scope?.claim(id);
    const rt = await this.runtime(id);
    if (!rt.running) this.runExclusive(rt, () => this.buildDemo(rt));
    return id;
  }

  /** A seeding error outside the build (creating the project): logged on the demo project when there is one. */
  private async seedFailed(err: unknown) {
    console.error("[sparkflow] demo app seeding failed", err);
    const demo = (await this.store.list().catch(() => [])).find(isDemoProject);
    if (!demo) return;
    const rt = await this.runtime(demo.id).catch(() => null);
    rt?.log(`Setting up the ${DEMO_NAME} demo failed: ${String((err as Error)?.message ?? err)}`, undefined, "error");
    await rt?.flush();
  }

  /** Builds the demo from its overlay (again after a failure); errors land in the project's log via runExclusive. */
  private async buildDemo(rt: ProjectRuntime) {
    let plan: AppPlan;
    try {
      plan = await loadDemoPlan();
    } catch (err) {
      throw new Error(`The demo app's plan is invalid: ${(err as Error).message}`);
    }
    this.phase(rt, { phase: "sandbox" });
    const sb = await this.sandbox(rt);
    rt.emit({ type: "plan", plan });
    for (const s of plan.screens) rt.emit({ type: "screen_status", route: s.route, status: "building", version: 1, attempt: 1 });
    await applyDemoOverlay(sb);
    const sha = await gitCommit(sb, `${plan.name} demo app`);
    if (sha) rt.emit({ type: "commit", sha, message: `${plan.name}, demo app`, routes: plan.screens.map((s) => s.route) });
    await this.emitTree(rt);
    await this.updateNav(rt);
    const p = await sb.startDevServer();
    rt.emit({ type: "preview_ready", webUrl: p.webUrl, expoGoUrl: p.expoGoUrl });

    // Same capture as a generated app; verdicts only when a model is configured.
    this.phase(rt, { phase: "verifier", detail: "capturing pages" });
    for (const s of plan.screens) rt.emit({ type: "screen_status", route: s.route, status: "verifying", version: 1, attempt: 1 });
    const results = await sb.inspect({ targets: plan.screens.map((s) => ({ name: s.route, path: s.previewPath ?? previewPathFor(s.route) })) });
    const judge = this.provider.name !== "mock";
    for (const [i, s] of plan.screens.entries()) {
      const r = results[i];
      if (r?.screenshot) rt.emit({ type: "screenshot", route: s.route, url: await this.store.saveShot(rt.meta.id, await this.shotName(rt, s.route, 1), r.screenshot), version: 1 });
      if (r?.audit) rt.emit({ type: "quality", route: s.route, version: 1, report: r.audit });
      let ok = !!r?.screenshot && !(runtimeProblems(r).length && (r.errorOverlay || !r.ok));
      if (ok && judge) {
        const verdict = await runVerifier(this.deps(rt), s, r);
        rt.emit({ type: "verdict", verdict, attempt: 1 });
        ok = verdictPasses(verdict);
      }
      rt.emit({ type: "screen_status", route: s.route, status: ok ? "done" : "failed", version: 1, attempt: 1 });
    }
    await markSeeded();
    rt.emit({
      type: "agent_message",
      text: `${plan.name} is a demo app made with Sparkflow. Open a page, then describe a change to watch the agent at work. The first time on a device builds Sparkflow Dev once (about 6 minutes for the iOS Simulator, 15 for the Android emulator); after that apps open in seconds.`,
    });
  }

  /** Up to two typecheck + fix rounds. Metro may still render if it keeps failing. */
  private async compileGate(rt: ProjectRuntime, system: string, route?: string) {
    const sb = await this.sandbox(rt);
    for (let round = 0; round < 2; round++) {
      const tc = await typecheck(sb);
      if (tc.ok) return true;
      rt.log(`Typecheck failed (${tc.errors.length} errors), fixing…`, route);
      const ctx = await this.toolCtx(rt);
      await runBuilderTask(this.deps(rt), ctx, {
        system,
        task: `TASK: The project does not typecheck. Fix every error, run typecheck again, then finish.\n\n${tc.text}`,
        maxTurns: Math.min(15, this.cfg.maxBuilderTurns),
        route,
      });
    }
    const ok = (await typecheck(sb)).ok;
    if (!ok) rt.log("Typecheck still failing, continuing (Metro may still render)", route, "error");
    return ok;
  }

  private async shotName(rt: ProjectRuntime, route: string, version: number, suffix = "") {
    return `${routeSlug(route)}-v${version}${suffix}-${Date.now()}.png`;
  }

  /** Inspect → screenshot → quality → verdict, fixing until it passes or attempts run out. */
  private async verifyLoop(rt: ProjectRuntime, system: string, s: ScreenPlan, version: number, extraCriteria: string[] = []): Promise<boolean> {
    const sb = await this.sandbox(rt);
    for (let attempt = 1; attempt <= this.cfg.maxAttempts; attempt++) {
      await this.compileGate(rt, system, s.route);
      rt.emit({ type: "screen_status", route: s.route, status: "verifying", version, attempt });
      this.phase(rt, { phase: "verifier", route: s.route, detail: s.title });
      const [r] = await sb.inspect({ targets: [{ name: s.route, path: s.previewPath ?? previewPathFor(s.route) }] });
      const url = r.screenshot ? await this.store.saveShot(rt.meta.id, await this.shotName(rt, s.route, version), r.screenshot) : null;
      if (url) rt.emit({ type: "screenshot", route: s.route, url, version });
      if (r.audit) rt.emit({ type: "quality", route: s.route, version, report: r.audit });
      const verdict = await runVerifier(this.deps(rt), s, r, extraCriteria);
      rt.emit({ type: "verdict", verdict, attempt });
      const passed = verdict.criteria.filter((c) => c.pass).length;
      if (verdictPasses(verdict)) {
        rt.log(`✓ ${s.title}: ${passed}/${verdict.criteria.length} criteria pass`, s.route);
        rt.emit({ type: "screen_status", route: s.route, status: "done", version, attempt });
        return true;
      }
      rt.log(`✗ ${s.title}: ${passed}/${verdict.criteria.length} criteria pass (attempt ${attempt}/${this.cfg.maxAttempts})`, s.route);
      if (attempt === this.cfg.maxAttempts) {
        rt.log(`Giving up on ${s.title} after ${attempt} attempts`, s.route, "error");
        rt.emit({ type: "screen_status", route: s.route, status: "failed", version, attempt });
        return false;
      }
      rt.emit({ type: "screen_status", route: s.route, status: "building", version, attempt: attempt + 1 });
      this.phase(rt, { phase: "builder", route: s.route, detail: `fix ${attempt}/${this.cfg.maxAttempts - 1}` });
      const files = await this.readFiles(sb, [s.file, ...SHARED_FILES]);
      const ctx = await this.toolCtx(rt);
      await runBuilderTask(this.deps(rt), ctx, {
        system,
        task: fixTask(s, attempt + 1, this.cfg.maxAttempts, verdict, runtimeProblems(r), files),
        images: r.screenshot ? [{ mediaType: "image/png", data: r.screenshot.toString("base64"), caption: "The rejected screenshot:" }] : [],
        maxTurns: this.cfg.maxBuilderTurns,
        route: s.route,
      });
    }
    return false;
  }

  /** Re-captures pages in one inspector run. With bump, each page gets a new version and a pass/fail from the runtime. */
  private async refreshShots(rt: ProjectRuntime, routes: string[], bump: boolean) {
    const sb = await this.sandbox(rt);
    const screens = routes.map((r) => this.screenPlan(rt, r)).filter((s): s is ScreenPlan => !!s);
    if (!screens.length) return;
    const versions = new Map(screens.map((s) => [s.route, (rt.state.screens[s.route]?.version ?? 0) + (bump ? 1 : 0)]));
    if (bump) for (const s of screens) rt.emit({ type: "screen_status", route: s.route, status: "verifying", version: versions.get(s.route)! });
    const results = await sb.inspect({ targets: screens.map((s) => ({ name: s.route, path: s.previewPath ?? previewPathFor(s.route) })) });
    for (const [i, s] of screens.entries()) {
      const r = results[i];
      const v = versions.get(s.route)!;
      if (r?.screenshot) rt.emit({ type: "screenshot", route: s.route, url: await this.store.saveShot(rt.meta.id, await this.shotName(rt, s.route, v), r.screenshot), version: v });
      if (r?.audit) rt.emit({ type: "quality", route: s.route, version: v, report: r.audit });
      const broken = !r || !!runtimeProblems(r).length && (r.errorOverlay || !r.ok);
      if (bump) rt.emit({ type: "screen_status", route: s.route, status: broken ? "failed" : "done", version: v });
      else if (broken) rt.emit({ type: "screen_status", route: s.route, status: "failed", version: v });
    }
  }

  private async updateNav(rt: ProjectRuntime) {
    const plan = rt.state.plan;
    if (!plan || rt.meta.native) return;
    const sb = await this.sandbox(rt);
    const sources = await Promise.all(plan.screens.map(async (s) => ({ route: s.route, source: await sb.readFile(s.file).catch(() => "") })));
    rt.emit({ type: "nav", edges: edgesFromSources(sources, plan.screens.map((s) => s.route)) });
  }

  private async emitTree(rt: ProjectRuntime) {
    const sb = await this.sandbox(rt);
    rt.emit({ type: "tree", files: await sb.listFiles() });
  }

  /** A changed screen file impacts its route only; any other non-asset file impacts every route. */
  /** Which of these files exist, in one exec; a failed check says none (so nothing is taken as deleted). */
  private async existing(sb: Sandbox, files: string[]) {
    if (!files.length) return new Set<string>();
    const out = await sb.exec(files.map((f) => `[ -e ${shq(f)} ] && printf '%s\\n' ${shq(f)}`).join("; ") + "; true").catch(() => ({ stdout: "" }));
    return new Set(out.stdout.split("\n").filter((f) => files.includes(f)));
  }

  /**
   * Files missing now that were there before (`existedBefore`) or that git saw deleted, since `head` or in
   * history. Each check prints its own file name, git reads the paths literally (`[id].tsx` isn't a glob),
   * and a failed exec says none.
   */
  private async deletedFiles(sb: Sandbox, files: string[], existedBefore: Set<string>, head: string) {
    if (!files.length) return new Set<string>();
    const checks = files.map((f) => {
      const q = shq(f);
      const was = existedBefore.has(f)
        ? "true"
        : `[ -n "$(git diff --name-only --diff-filter=D ${shq(head)} -- ${q})$(git log -1 --format=%h --diff-filter=D -- ${q})" ]`;
      return `if [ ! -e ${q} ] && ${was}; then printf '%s\\n' ${q}; fi`;
    });
    const out = await sb.exec(`export GIT_LITERAL_PATHSPECS=1; ${checks.join("; ")}; true`).catch(() => ({ stdout: "" }));
    return new Set(out.stdout.split("\n").filter((f) => files.includes(f)));
  }

  /** Still a page of the app (a run may have deleted it while a capture was going). */
  private live(rt: ProjectRuntime, route: string) {
    return !!rt.state.screens[route] && rt.state.order.includes(route);
  }

  private impactedRoutes(rt: ProjectRuntime, changed: string[]) {
    const plan = rt.state.plan;
    if (!plan) return [];
    const byFile = new Map(plan.screens.map((s) => [s.file, s.route]));
    const out = new Set<string>();
    for (const f of changed) {
      if (f.startsWith("assets/")) continue;
      const r = byFile.get(f);
      if (r) out.add(r);
      else return plan.screens.map((s) => s.route);
    }
    return [...out];
  }

  // ---------- iteration ----------

  async prompt(id: string, req: PromptRequest, opts: { by?: string; guest?: boolean } = {}) {
    const rt = await this.runtime(id);
    if (rt.running) throw new BusyError();
    if (opts.guest) this.guestRuns.add(rt);
    else this.guestRuns.delete(rt);
    const extras = [req.audio && "🎤 voice memo", req.image && "🖼 image"].filter(Boolean).join(" + ");
    rt.emit({
      type: "user_prompt",
      id: Math.random().toString(36).slice(2, 10),
      text: `${req.text.trim()}${extras ? `${req.text.trim() ? " " : ""}(${extras})` : ""}`,
      route: req.route,
      testId: req.picks?.[0]?.testId ?? req.testId,
      by: opts.by,
    });
    // The demo app whose build failed: any prompt (Retry included) rebuilds it from the overlay first.
    if (isDemoProject(rt.meta) && !isSeeded()) return this.runExclusive(rt, () => this.buildDemo(rt));
    this.runExclusive(rt, () => (rt.meta.native ? this.iterateNative(rt, req) : this.iterate(rt, req)));
  }

  private async iterate(rt: ProjectRuntime, req: PromptRequest) {
    const sb = await this.sandbox(rt);
    this.phase(rt, { phase: "sandbox" });
    const p = await sb.startDevServer();
    if (rt.state.preview?.webUrl !== p.webUrl) rt.emit({ type: "preview_ready", webUrl: p.webUrl, expoGoUrl: p.expoGoUrl });
    let plan = rt.state.plan;
    // A run that died before planning: start over with the original prompt plus the new text.
    if (!plan) return this.generate(rt, [rt.meta.prompt, req.text].filter(Boolean).join("\n\n"));

    const head = (await sb.exec("git rev-parse HEAD")).stdout.trim();
    const focused = req.route ? plan.screens.find((s) => s.route === req.route) : undefined;
    const picks: PickInfo[] = [];
    const pickIds = req.picks?.length ? req.picks : req.testId ? [{ testId: req.testId }] : [];
    for (const pk of pickIds) {
      if (pk.file) {
        picks.push({ testId: pk.testId, file: pk.file, line: pk.line, snippet: await this.snippet(sb, pk.file, pk.line, 6) });
      } else picks.push({ testId: pk.testId, ...(await this.resolveIn(sb, pk.testId)) });
    }
    const images: { mediaType: string; data: string; caption: string }[] = [];
    if (req.image) images.push({ mediaType: req.image.mediaType, data: req.image.data, caption: "Image attached by the user:" });
    // Files dropped on the prompt: their pictures for the model to look at, their text to read.
    const attached = await prepareAttachments(req.attachments);
    images.push(...attached.images);
    const text = [req.text, attached.text].filter(Boolean).join("\n\n");
    const cur = focused && rt.state.screens[focused.route];
    if (cur?.screenshotUrl) {
      const png = await this.store.readShot(rt.meta.id, path.basename(cur.screenshotUrl)).catch(() => null);
      if (png) images.push({ mediaType: "image/png", data: png.toString("base64"), caption: `Current screenshot of ${focused!.title}:` });
    }
    const version = focused ? (rt.state.screens[focused.route]?.version ?? 0) + 1 : 0;
    if (focused) rt.emit({ type: "screen_status", route: focused.route, status: "building", version, attempt: 1 });
    this.phase(rt, { phase: "builder", route: focused?.route, detail: focused?.title ?? "whole app" });

    const layouts = plan.screens.map((s) => s.file).filter((f) => f.endsWith("_layout.tsx"));
    const files = await this.readFiles(sb, [
      ...(focused ? [focused.file] : ["app/_layout.tsx", "app/(tabs)/_layout.tsx", ...layouts]),
      ...SHARED_FILES,
      ...picks.map((p) => p.file).filter((f): f is string => !!f),
    ]);
    const rules = await sb.readFile("AGENT_RULES.md").catch(() => "");
    const system = builderSystem(rules, plan);
    const ctx = await this.toolCtx(rt);
    // Page files there before the agent works: one missing afterwards was deleted by it (even if never committed).
    const pageFiles = plan.screens.filter((sc) => !sc.file.endsWith("_layout.tsx")).map((sc) => sc.file);
    const existedBefore = await this.existing(sb, pageFiles);
    const summary = await runBuilderTask(this.deps(rt), ctx, {
      system,
      task: userPromptTask({ text, voice: !!req.audio, plan, focused, picks, files }),
      images,
      audio: req.audio,
      maxTurns: this.cfg.maxBuilderTurns,
      route: focused?.route,
    });

    const diff = (await sb.exec(`git diff --name-only ${head} && git ls-files --others --exclude-standard`)).stdout.split("\n").filter(Boolean);
    const changed = [...new Set(diff)];

    // New screen files join the plan.
    const known = new Set(plan.screens.map((s) => s.file));
    const added: ScreenPlan[] = [];
    for (const f of changed) {
      if (known.has(f) || !isScreenFile(f) || f.endsWith("_layout.tsx")) continue;
      if (!(await sb.readFile(f).then(() => true, () => false))) continue;
      const route = fileToRoute(f);
      const name = path.basename(f).replace(/\.\w+$/, "").replace(/[[\]]/g, "");
      added.push({
        route,
        file: f,
        title: name === "index" ? "Home" : name.replace(/[-_]/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
        purpose: `Added by request: ${req.text.trim().slice(0, 120) || "voice request"}`,
        components: [],
        navigatesTo: [],
        acceptance: ["The screen renders meaningful content without errors"],
        previewPath: previewPathFor(route),
      });
    }
    // Pages the agent deleted leave the plan, with the links to them: the file is missing now, and it was
    // there when this run started or git saw it deleted (an earlier run). A page never written yet (a
    // stopped first build) is neither, and stays; a failed check removes nothing.
    const candidates = plan.screens.filter((sc) => !sc.file.endsWith("_layout.tsx"));
    const deleted = await this.deletedFiles(sb, candidates.map((sc) => sc.file), existedBefore, head);
    const goneFiles = new Set(candidates.filter((sc) => deleted.has(sc.file)).map((sc) => sc.file));
    const gone = new Set(plan.screens.filter((sc) => goneFiles.has(sc.file)).map((sc) => sc.route));
    if (added.length || gone.size) {
      plan = {
        ...plan,
        screens: [...plan.screens.filter((sc) => !gone.has(sc.route)).map((sc) => (gone.size ? { ...sc, navigatesTo: sc.navigatesTo.filter((r) => !gone.has(r)) } : sc)), ...added],
      };
      rt.emit({ type: "plan", plan, ...(gone.size ? { removed: [...gone] } : {}) });
    }
    const request = req.text.trim() || summary || "the voice request";
    const extra = [`The user's request is visibly satisfied: "${request.slice(0, 200)}"`];
    const fsys = builderSystem(rules, plan);
    const kept = focused && !gone.has(focused.route) ? focused : undefined;
    if (kept) await this.verifyLoop(rt, fsys, kept, version, extra);
    for (const s of added) {
      rt.emit({ type: "screen_status", route: s.route, status: "building", version: 1, attempt: 1 });
      await this.verifyLoop(rt, fsys, s, 1);
    }
    // A deleted page's file isn't a change to the pages that remain (it would make every page "impacted").
    const others = this.impactedRoutes(
      rt,
      changed.filter((f) => !goneFiles.has(f)),
    ).filter((r) => r !== focused?.route && !added.some((a) => a.route === r));
    if (others.length) {
      this.phase(rt, { phase: "verifier", detail: "re-capturing impacted pages" });
      await this.refreshShots(rt, others, true);
    }
    const msg = `${focused?.title ?? "App"}: ${req.text.trim().slice(0, 60) || "voice request"}`;
    const sha = await gitCommit(sb, msg);
    if (sha) rt.emit({ type: "commit", sha, message: msg, routes: [...(kept ? [kept.route] : []), ...added.map((a) => a.route), ...others] });
    await this.updateNav(rt);
    await this.emitTree(rt);
    rt.emit({ type: "agent_message", text: summary || "Done.", route: focused?.route });
  }

  private async snippet(sb: Sandbox, file: string, line: number | undefined, around: number) {
    const text = await sb.readFile(file).catch(() => "");
    if (!text || !line) return undefined;
    const lines = text.split("\n");
    return lines
      .slice(Math.max(0, line - 1 - around), line + around)
      .map((l, i) => `${Math.max(1, line - around) + i}: ${l}`)
      .join("\n");
  }

  /** testId → file:line (+ snippet). Dynamic ids like "home-habit-2" fall back to template-literal prefixes. */
  async resolveIn(sb: Sandbox, testId: string): Promise<Omit<ResolvedElement, "testId">> {
    const id = testId.replace(/[^a-zA-Z0-9_-]/g, "");
    if (!id) return {};
    const parts = id.split("-");
    const prefixes = parts.slice(1).map((_, i) => parts.slice(0, parts.length - 1 - i).join("-") + "-").filter((p) => p.length > 1);
    const patterns = [`testID=\\{?["'\`]${id}["'\`]`, ...prefixes.map((p) => `testID=\\{\`${p}`)];
    for (const pat of patterns) {
      const r = await sb.exec(`grep -rnE ${shq(pat)} app components --include=*.tsx --include=*.ts 2>/dev/null | head -1`);
      const m = r.stdout.match(/^([^:]+):(\d+):/);
      if (m) {
        const line = Number(m[2]);
        return { file: m[1], line, snippet: await this.snippet(sb, m[1], line, 6) };
      }
    }
    return {};
  }

  async resolve(id: string, testId: string): Promise<ResolvedElement> {
    const rt = await this.runtime(id);
    const sb = await this.sandbox(rt);
    if (rt.meta.native) return { testId, ...(await resolveNative(rt.meta.native.dir, testId)) };
    return { testId, ...(await this.resolveIn(sb, testId)) };
  }

  // ---------- versions ----------

  async undo(id: string, route: string) {
    const rt = await this.runtime(id);
    if (rt.meta.native) throw new Error("Undo is not available for native projects");
    const s = this.screenPlan(rt, route);
    if (!s) throw new Error("Page not found");
    const sb = await this.sandbox(rt);
    const log = (await sb.exec(`git log -n 2 --format=%H -- ${shq(s.file)}`)).stdout.split("\n").filter(Boolean);
    if (log.length < 2) throw new Error("Nothing to undo");
    this.runExclusive(rt, async () => {
      await sb.exec(`git checkout ${log[1]} -- ${shq(s.file)}`);
      await this.refreshShots(rt, [route], true);
      const msg = `Undo ${s.title}`;
      const sha = await gitCommit(sb, msg);
      if (sha) rt.emit({ type: "commit", sha, message: msg, routes: [route] });
      await this.updateNav(rt);
      rt.emit({ type: "agent_message", text: `Undid the last change on ${s.title}.`, route });
    });
  }

  async restoreVersion(id: string, route: string, version: number) {
    const rt = await this.runtime(id);
    if (rt.meta.native) throw new Error("Restore is not available for native projects");
    const s = this.screenPlan(rt, route);
    const screen = rt.state.screens[route];
    if (!s || !screen) throw new Error("Page not found");
    const next = screen.history.find((h) => h.version > version);
    const target = [...rt.state.commits].reverse().find((c) => c.routes.includes(route) && (!next || c.ts < next.ts));
    if (!target) throw new Error(`No saved state for v${version}`);
    const sb = await this.sandbox(rt);
    this.runExclusive(rt, async () => {
      await sb.exec(`git checkout ${target.sha} -- ${shq(s.file)}`);
      const themeChanged = (await sb.exec(`git diff --quiet ${target.sha} HEAD -- theme.json`)).code !== 0;
      if (themeChanged) await sb.exec(`git checkout ${target.sha} -- theme.json`);
      await this.refreshShots(rt, themeChanged ? rt.state.order : [route], true);
      const msg = `Restore ${s.title} to v${version}`;
      const sha = await gitCommit(sb, msg);
      if (sha) rt.emit({ type: "commit", sha, message: msg, routes: themeChanged ? rt.state.order : [route] });
      await this.updateNav(rt);
      rt.emit({ type: "agent_message", text: `${s.title} restored to v${version}, saved as a new version.`, route });
    });
  }

  async commitDiff(id: string, sha: string) {
    const rt = await this.runtime(id);
    if (rt.meta.native) throw new Error("Diffs are not available for native projects");
    if (!/^[0-9a-f]{4,40}$/.test(sha)) throw new Error("Invalid commit");
    const sb = await this.sandbox(rt);
    const head = (await sb.exec(`git show -s --format='%H%n%s%n%cI' ${sha}`)).stdout.split("\n");
    if (!head[0]) throw new Error("Commit not found");
    const stat = (await sb.exec(`git show --stat=80 --format= ${sha}`)).stdout;
    const patch = (await sb.exec(`git show --format= ${sha} -- . ':(exclude)*.png' ':(exclude)*.jpg' ':(exclude)package-lock.json'`)).stdout.slice(0, 200_000);
    return { sha: head[0], message: head[1], date: head[2], stat, patch };
  }

  async exportProject(id: string) {
    const rt = await this.runtime(id);
    if (rt.meta.native) throw new Error("Export is not available for native projects");
    const sb = await this.sandbox(rt);
    const r = await sb.exec("mkdir -p .expo && git archive --format=zip -o .expo/sparkflow-export.zip HEAD");
    if (r.code) throw new Error(r.stderr || "Export failed");
    const bytes = await sb.readFileBytes(".expo/sparkflow-export.zip");
    await sb.exec("rm -f .expo/sparkflow-export.zip");
    return { name: `${slug(rt.state.name)}.zip`, bytes };
  }

  // ---------- one source between the cloud and a Mac ----------

  /**
   * The project as another Sparkflow takes it over: its meta, its history and its whole git repository (a
   * bundle). Screenshots go one by one after (`shots` names them), a request each.
   */
  async exportSync(id: string): Promise<SyncPackage> {
    const rt = await this.runtime(id);
    if (rt.meta.native) throw new Error("Native projects stay on their Mac");
    if (rt.running) throw new BusyError();
    // The copy kept after the last run, when nothing came since: no sandbox to wake (minutes on Modal).
    const cached = await this.store.readBundle(id, true);
    const bundle = (cached ?? (await this.cacheBundle(rt))).toString("base64");
    const events = (await this.store.readEvents(id)).map((e) => JSON.stringify(e) + "\n").join("");
    return { meta: rt.meta, events, bundle, shots: await this.store.listShots(id) };
  }

  /** The project's git repository as a bundle, kept beside its history for the next export. */
  private async cacheBundle(rt: ProjectRuntime): Promise<Buffer> {
    const sb = await this.sandbox(rt);
    const r = await sb.exec("mkdir -p .expo && git bundle create .expo/sparkflow-sync.bundle --all", { timeoutSec: 120 });
    if (r.code) throw new Error(r.stderr || "Could not bundle the project");
    const bytes = await sb.readFileBytes(".expo/sparkflow-sync.bundle");
    await sb.exec("rm -f .expo/sparkflow-sync.bundle");
    await this.store.saveBundle(rt.meta.id, bytes);
    return bytes;
  }

  /**
   * Takes over a project from another Sparkflow: the same id, its code checked out at the same commit, its
   * history; the last one opened wins. Returns the screenshots still to send.
   */
  async importSync(pkg: SyncPackage): Promise<{ id: string; slug: string; missing: string[] }> {
    const { meta } = pkg;
    this.store.dir(meta.id);
    const current = await this.runtimes.get(meta.id)?.catch(() => null);
    if (current?.running) throw new BusyError();
    const sb = await (await this.driverP).open(meta.id);
    await sb.writeFile(".expo/sparkflow-sync.bundle", Buffer.from(pkg.bundle, "base64"));
    const r = await sb.exec(
      [
        "before=$(git rev-parse HEAD 2>/dev/null || true)",
        // Its checked-out commit (branches are named master on a Mac, main in the cloud).
        "git fetch -q -f .expo/sparkflow-sync.bundle HEAD",
        "git reset -q --hard FETCH_HEAD",
        "rm -f .expo/sparkflow-sync.bundle",
        // New dependencies (a package added on the other side): installed here too.
        `if [ -z "$before" ] || ! git diff --quiet "$before" HEAD -- package.json; then npm install --no-audit --no-fund >/tmp/sparkflow-sync-npm.log 2>&1 || true; fi`,
      ].join(" && "),
      { timeoutSec: 600 },
    );
    if (r.code) throw new Error(r.stderr || "Could not check out the project");
    await sb.persist?.().catch(() => {});
    await this.store.replace({ ...meta, native: undefined }, pkg.events);
    await this.store.saveBundle(meta.id, Buffer.from(pkg.bundle, "base64"));
    // Read again from disk on next use, with the history just written.
    this.runtimes.delete(meta.id);
    const have = new Set(await this.store.listShots(meta.id));
    const found = (await this.listProjects()).find((p) => p.id === meta.id);
    return { id: meta.id, slug: found?.slug ?? meta.id, missing: pkg.shots.filter((n) => !have.has(n)) };
  }

  // ---------- dark mode ----------

  async captureDark(id: string) {
    const rt = await this.runtime(id);
    if (rt.meta.native) throw new Error("Use the simulator capture for native projects");
    if (rt.running) throw new BusyError();
    const stale = rt.state.order.filter((r) => {
      const s = rt.state.screens[r];
      return s?.screenshotUrl && s.dark?.version !== s.version;
    });
    if (!stale.length) return 0;
    const sb = await this.sandbox(rt);
    const screens = stale.map((r) => this.screenPlan(rt, r)).filter((s): s is ScreenPlan => !!s);
    const results = await sb.inspect({ colorScheme: "dark", targets: screens.map((s) => ({ name: s.route, path: s.previewPath ?? previewPathFor(s.route) })) });
    let n = 0;
    for (const [i, s] of screens.entries()) {
      const r = results[i];
      // A page a run deleted meanwhile is skipped (an event for it would bring it back).
      if (!r?.screenshot || !this.live(rt, s.route)) continue;
      const v = rt.state.screens[s.route].version;
      const url = await this.store.saveShot(rt.meta.id, await this.shotName(rt, s.route, v, "-dark"), r.screenshot);
      rt.emit({ type: "dark_shot", route: s.route, url, version: v, report: r.audit ?? undefined });
      n++;
    }
    return n;
  }

  /** Web pages captured at a preview device's screen size (between its safe areas), in one appearance. */
  async captureDevice(id: string, deviceId: string, dark: boolean) {
    const rt = await this.runtime(id);
    if (rt.meta.native) throw new Error("Use the simulator capture for native projects");
    if (rt.running) throw new BusyError();
    const device = PREVIEW_DEVICES.find((d) => d.id === deviceId);
    if (!device) throw new Error(`Unknown device ${deviceId}`);
    const scheme = dark ? "dark" : "light";
    const stale = rt.state.order.filter((r) => {
      const s = rt.state.screens[r];
      return s?.screenshotUrl && s.devices?.[deviceId]?.[scheme]?.version !== s.version;
    });
    if (!stale.length) return 0;
    const sb = await this.sandbox(rt);
    const screens = stale.map((r) => this.screenPlan(rt, r)).filter((s): s is ScreenPlan => !!s);
    const viewport = { width: device.areas.width, height: device.h - device.areas.top - device.areas.bottom };
    const results = await sb.inspect({ viewport, colorScheme: scheme, targets: screens.map((s) => ({ name: s.route, path: s.previewPath ?? previewPathFor(s.route) })) });
    let n = 0;
    for (const [i, s] of screens.entries()) {
      const r = results[i];
      // A page a run deleted meanwhile is skipped (an event for it would bring it back).
      if (!r?.screenshot || !this.live(rt, s.route)) continue;
      const v = rt.state.screens[s.route].version;
      const url = await this.store.saveShot(rt.meta.id, await this.shotName(rt, s.route, v, `-${deviceId}${dark ? "-dark" : ""}`), r.screenshot);
      rt.emit({ type: "device_shot", route: s.route, device: deviceId, dark, url, version: v });
      n++;
    }
    return n;
  }

  // ---------- files and assets ----------

  async listProjectFiles(id: string) {
    const rt = await this.runtime(id);
    if (rt.meta.native) return listSourceFiles(rt.meta.native.dir);
    return (await this.sandbox(rt)).listFiles();
  }

  private checkRel(rel: string) {
    if (!rel || rel.startsWith("/") || rel.split("/").includes("..")) throw new Error("Invalid path");
    return rel;
  }

  /** The project's folder on this Mac, or null when its sandbox is remote (shared-project path checks). */
  async projectDir(id: string): Promise<string | null> {
    const rt = await this.runtime(id);
    if (rt.meta.native) return rt.meta.native.dir;
    return ((await this.sandbox(rt)) as { dir?: string }).dir ?? null;
  }

  async readProjectFile(id: string, rel: string) {
    const rt = await this.runtime(id);
    return (await this.sandbox(rt)).readFile(this.checkRel(rel));
  }

  /**
   * Errors in one file of the project, for the code view's inline messages: Babel's first syntax error
   * (the one Metro shows, at the line that caused it), else TypeScript's errors.
   */
  async fileDiagnostics(id: string, rel: string) {
    const rt = await this.runtime(id);
    const sb = await this.sandbox(rt);
    const file = this.checkRel(rel);
    const babel = `const fs=require("fs"),p=require("@babel/parser");try{const r=p.parse(fs.readFileSync(${JSON.stringify(file)},"utf8"),{sourceType:"module",plugins:["jsx","typescript"]});console.log(JSON.stringify((r.errors||[]).map(e=>({line:e.loc.line,message:e.message.replace(/ \\(\\d+:\\d+\\)$/,"")}))))}catch(e){console.log(JSON.stringify(e.loc?[{line:e.loc.line,message:e.message.replace(/ \\(\\d+:\\d+\\)$/,"")}]:[]))}`;
    const [syntax, { errors }] = await Promise.all([
      sb
        .exec(`node -e ${shq(babel)}`, { timeoutSec: 20 })
        .then((r) => JSON.parse(r.stdout.trim().split("\n").pop() || "[]") as { line: number; message: string }[])
        .catch(() => []),
      typecheck(sb),
    ]);
    const types = errors.flatMap((e) => {
      const m = e.match(/^(.+?):(\d+):(\d+) (TS\d+) (.+)$/);
      return m && m[1] === file ? [{ line: Number(m[2]), message: m[5] }] : [];
    });
    // With a syntax error, TypeScript's messages are mostly its consequences: keep Babel's alone.
    return syntax.length ? syntax : types;
  }

  /** Hover, completions and definitions for the code view, from the app's own TypeScript. */
  async lang(id: string, req: LangRequest) {
    const rt = await this.runtime(id);
    const dir = ((await this.sandbox(rt)) as { dir?: string }).dir;
    if (!dir) return null;
    this.checkRel(req.path);
    return lang(dir, req);
  }

  /** Saves a file edited by hand in the IDE's code view, as its own commit. */
  async writeProjectFile(id: string, rel: string, content: string) {
    const rt = await this.runtime(id);
    const sb = await this.sandbox(rt);
    if (!rt.meta.native && rt.running) throw new BusyError();
    await sb.writeFile(this.checkRel(rel), content);
    if (!rt.meta.native) {
      const message = `Edit ${rel}`;
      const sha = await gitCommit(sb, message);
      if (sha) rt.emit({ type: "commit", sha, message, routes: [] });
      await this.emitTree(rt);
    }
  }

  async readProjectFileBytes(id: string, rel: string) {
    const rt = await this.runtime(id);
    return (await this.sandbox(rt)).readFileBytes(this.checkRel(rel));
  }

  /** What a native Release build of the app needs: its folder and identity (name, bundle ID, version). */
  async releaseTarget(id: string): Promise<ReleaseTarget> {
    const rt = await this.runtime(id);
    if (rt.meta.native) throw new Error("Native builds are for apps made with Sparkflow: build an imported project from Xcode or Android Studio");
    if (rt.running) throw new BusyError();
    const dir = ((await this.sandbox(rt)) as { dir?: string }).dir;
    if (!dir) throw new Error("Native builds need the app on this computer");
    const s = await this.appSettings(id);
    return { id, dir, name: s.name, bundleId: s.bundleIdentifier, androidPackage: s.androidPackage, version: s.version };
  }

  /** The project's folder on this computer (for opening it in an editor); null for a remote sandbox. */
  async projectFolder(id: string) {
    const rt = await this.runtime(id);
    const dir = ((await this.sandbox(rt)) as { dir?: string }).dir ?? null;
    // Its readable name in the apps folder (~/Documents/apps/wander) when there is one.
    return (!rt.meta.native && (await this.linkFolder(id, rt.state.name ?? rt.meta.name).catch(() => null))) || dir;
  }

  /** Shows the project's folder in Finder (or the Linux file manager), or opens it in VS Code. */
  async revealProject(id: string, app: "finder" | "vscode" = "finder", file?: string) {
    const dir = await this.projectFolder(id);
    if (!dir) throw new Error("This project has no folder on this computer");
    // A file of the project (never outside its folder): selected in Finder, opened in VS Code.
    const target = file ? path.resolve(dir, file) : null;
    const inside = target && target.startsWith(path.resolve(dir) + path.sep) && existsSync(target) ? target : null;
    // isMac(), read at run time: the build inlines process.platform (releases are built on Linux).
    const [cmd, args] =
      app === "vscode"
        ? isMac()
          ? ["open", ["-a", "Visual Studio Code", dir, ...(inside ? [inside] : [])]]
          : ["code", [dir, ...(inside ? ["-g", inside] : [])]]
        : isMac()
          ? ["open", inside ? ["-R", inside] : [dir]]
          : ["xdg-open", [inside ? path.dirname(inside) : dir]];
    const child = spawn(cmd as string, args as string[], { detached: true, stdio: "ignore" });
    child.on("error", () => {});
    child.unref();
  }

  /**
   * GitHub for the project's git history (every change Sparkflow makes is a commit): its remote, and
   * whether the GitHub CLI can create a repository for it.
   */
  async githubStatus(id: string) {
    const sb = await this.sandbox(await this.runtime(id));
    const remote = (await sb.exec("git remote get-url origin", { timeoutSec: 10 })).stdout.trim() || null;
    const user = (await sb.exec("gh api user -q .login", { timeoutSec: 15 })).stdout.trim() || null;
    const ahead = remote ? Number((await sb.exec("git rev-list --count @{u}..HEAD", { timeoutSec: 10 })).stdout.trim()) : NaN;
    return { remote, url: remote ? webUrlOf(remote) : null, ghUser: user, unpushed: Number.isFinite(ahead) ? ahead : null };
  }

  /** Creates a GitHub repository for the project (GitHub CLI), or connects one by URL, then pushes. */
  async githubConnect(id: string, how: { create: { name: string; private: boolean } } | { url: string }) {
    const rt = await this.runtime(id);
    if (rt.running) throw new BusyError();
    const sb = await this.sandbox(rt);
    const run = async (cmd: string, timeoutSec = 120) => {
      const r = await sb.exec(cmd, { timeoutSec });
      if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim().split("\n").pop() || `Failed: ${cmd}`);
      return r.stdout.trim();
    };
    if ("create" in how) {
      if (!/^[\w.-]{1,100}$/.test(how.create.name)) throw new Error("Repository names use letters, digits, - _ and .");
      await run(`gh repo create ${q(how.create.name)} ${how.create.private ? "--private" : "--public"} --source=. --remote=origin --push`, 180);
    } else {
      if (!/^(https:\/\/github\.com\/|git@github\.com:)[\w.-]+\/[\w.-]+?(\.git)?$/.test(how.url)) throw new Error("A GitHub repository URL, like https://github.com/you/app");
      const has = (await sb.exec("git remote get-url origin")).code === 0;
      await run(`git remote ${has ? "set-url" : "add"} origin ${q(how.url)}`);
      await run("git push -u origin HEAD:main", 180);
    }
    return this.githubStatus(id);
  }

  /** Sends the project's new commits to GitHub. */
  async githubPush(id: string) {
    const sb = await this.sandbox(await this.runtime(id));
    const r = await sb.exec("git push -u origin HEAD:main", { timeoutSec: 180 });
    if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim().split("\n").pop() || "Push failed");
    return this.githubStatus(id);
  }

  private linked = new Map<string, string>();
  /**
   * The apps folder shows each app under its own name. Its code is in <id> (~/Documents/apps/wander);
   * an app whose name isn't its id (renamed, or named after it was created) also gets a link under
   * its name, as moving the folder would break a running Metro. The link follows renames; a name
   * already taken gets a number (habitly-2).
   */
  private async linkFolder(id: string, name: string): Promise<string | null> {
    const root = dataDir();
    const target = path.join(root, id);
    if (!existsSync(target)) return null;
    const base = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "app";
    const known = this.linked.get(id);
    if (known && path.basename(known).replace(/-\d+$/, "") === base && existsSync(known)) return known;
    const reserved = new Set([".sparkflow", "cache", "logs"]);
    let mine: string | null = base === id ? target : null;
    for (const entry of await readdir(root)) {
      const p = path.join(root, entry);
      if (!(await lstat(p)).isSymbolicLink() || (await readlink(p)) !== target) continue;
      // Its link under the old name goes when the app is renamed.
      if (!mine && entry.replace(/-\d+$/, "") === base) mine = p;
      else await unlink(p).catch(() => {});
    }
    if (!mine) {
      for (let n = 1; ; n++) {
        const entry = n === 1 ? base : `${base}-${n}`;
        // lstat, not existsSync: a dangling link still takes the name.
        if (reserved.has(entry) || (await lstat(path.join(root, entry)).catch(() => null))) continue;
        mine = path.join(root, entry);
        await symlink(target, mine);
        break;
      }
    }
    this.linked.set(id, mine);
    return mine;
  }

  /** The app's iOS bundle ID (what its cover is stored under in the account). */
  private async bundleIdOf(id: string, name: string): Promise<string> {
    const own = await readFile(path.join(dataDir(), id, "app.json"), "utf8")
      .then((t) => JSON.parse(t).expo?.ios?.bundleIdentifier as string | undefined)
      .catch(() => undefined);
    return own && own !== "dev.sparkflow.app" ? own : defaultBundleId(name);
  }

  /** The app's own settings, from app.json: what the Settings dialog shows. */
  async appSettings(id: string): Promise<AppSettings> {
    const rt = await this.runtime(id);
    if (rt.meta.native) throw new Error("Settings are for apps made with Sparkflow");
    const expo = JSON.parse(await (await this.sandbox(rt)).readFile("app.json")).expo ?? {};
    const splash = expo.splash ?? (expo.plugins ?? []).find((p: unknown) => Array.isArray(p) && p[0] === "expo-splash-screen")?.[1] ?? {};
    // The template's placeholders give way to the project's own name.
    const id_ = defaultBundleId(rt.meta.name);
    return {
      name: expo.name && expo.name !== "Sparkflow App" ? expo.name : rt.meta.name,
      version: expo.version ?? "1.0.0",
      // dev.sparkflow.app is the template's (Sparkflow Dev's): an app of its own gets com.sparkflow.<name>.
      bundleIdentifier: expo.ios?.bundleIdentifier && expo.ios.bundleIdentifier !== "dev.sparkflow.app" ? expo.ios.bundleIdentifier : id_,
      androidPackage: expo.android?.package && expo.android.package !== "dev.sparkflow.app" ? expo.android.package : id_,
      orientation: expo.orientation ?? "portrait",
      appearance: expo.userInterfaceStyle ?? "automatic",
      splashBackground: splash.backgroundColor ?? "#ffffff",
      iconBackground: expo.android?.adaptiveIcon?.backgroundColor ?? "#ffffff",
    };
  }

  /**
   * Writes the app's settings into app.json, and a new icon or splash image (made square PNGs at
   * 1024 px, the icon also as the web favicon), then commits them like any other change.
   */
  async updateAppSettings(id: string, patch: AppSettings, images: { icon?: Buffer; splash?: Buffer }) {
    const rt = await this.runtime(id);
    if (rt.meta.native) throw new Error("Settings are for apps made with Sparkflow");
    if (rt.running) throw new BusyError();
    const sb = await this.sandbox(rt);
    const json = JSON.parse(await sb.readFile("app.json"));
    const expo = (json.expo ??= {});
    expo.name = patch.name;
    expo.version = patch.version;
    expo.orientation = patch.orientation;
    expo.userInterfaceStyle = patch.appearance;
    expo.ios = { ...expo.ios, bundleIdentifier: patch.bundleIdentifier };
    expo.android = { ...expo.android, package: patch.androidPackage, adaptiveIcon: { ...expo.android?.adaptiveIcon, backgroundColor: patch.iconBackground } };
    // app.json's own splash: the expo-splash-screen plugin needs a package the template doesn't install
    // (Metro then won't start), so an entry written by an earlier version goes.
    expo.splash = { ...expo.splash, image: "./assets/splash-icon.png", resizeMode: "contain", backgroundColor: patch.splashBackground };
    if (expo.plugins) expo.plugins = expo.plugins.filter((p: unknown) => (Array.isArray(p) ? p[0] : p) !== "expo-splash-screen");
    await sb.writeFile("app.json", JSON.stringify(json, null, 2) + "\n");
    const square = (img: Buffer, size: number, fit: "cover" | "contain") =>
      sharp(img).resize(size, size, { fit, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    if (images.icon) {
      await sb.writeFile("assets/icon.png", await square(images.icon, 1024, "cover"));
      await sb.writeFile("assets/android-icon-foreground.png", await square(images.icon, 1024, "contain"));
      await sb.writeFile("assets/favicon.png", await square(images.icon, 48, "cover"));
    }
    if (images.splash) await sb.writeFile("assets/splash-icon.png", await square(images.splash, 1024, "contain"));
    if (patch.name !== rt.meta.name) await this.renameProject(id, patch.name);
    const sha = await gitCommit(sb, "Update app settings");
    if (sha) rt.emit({ type: "commit", sha, message: "Update app settings", routes: [] });
    await this.emitTree(rt);
  }

  async addAsset(id: string, name: string, bytes: Buffer, dir?: string) {
    const rt = await this.runtime(id);
    if (bytes.length > MAX_ASSET) throw new Error("Files are limited to 15 MB");
    const ext = (name.match(ASSET_EXT)?.[0] ?? "").toLowerCase();
    if (!ext) throw new Error("Unsupported file type");
    const base = slug(name.slice(0, -ext.length));
    const folder = dir
      ? this.assetPath(dir)
      : /\.(ttf|otf)$/.test(ext)
        ? "assets/fonts"
        : /\.(mp3|wav|m4a|aac)$/.test(ext)
          ? "assets/sounds"
          : "assets/images";
    const rel = `${folder}/${base}${ext}`;
    const sb = await this.sandbox(rt);
    if (!rt.meta.native && rt.running) throw new BusyError();
    await sb.writeFile(rel, bytes);
    if (!rt.meta.native) {
      const sha = await gitCommit(sb, `Add asset ${base}${ext}`);
      if (sha) rt.emit({ type: "commit", sha, message: `Add asset ${base}${ext}`, routes: [] });
      await this.emitTree(rt);
    }
    return rel;
  }

  private assetPath(p: string) {
    const clean = p.replace(/^\/+|\/+$/g, "");
    if (!(clean === "assets" || clean.startsWith("assets/")) || clean.split("/").includes("..") || /['"$\\`]/.test(clean)) {
      throw new Error("Assets live under assets/");
    }
    return clean;
  }

  async assetOp(id: string, op: { type: "mkdir"; path: string } | { type: "move"; from: string; to: string } | { type: "delete"; path: string }) {
    const rt = await this.runtime(id);
    const sb = await this.sandbox(rt);
    if (!rt.meta.native && rt.running) throw new BusyError();
    let message = "";
    if (op.type === "mkdir") {
      const p = this.assetPath(op.path);
      await sb.exec(`mkdir -p ${shq(p)} && touch ${shq(p + "/.keep")}`);
      message = `New folder ${p}`;
    } else if (op.type === "move") {
      const from = this.assetPath(op.from);
      const to = this.assetPath(op.to);
      await sb.exec(`mkdir -p "$(dirname -- ${shq(to)})" && mv -- ${shq(from)} ${shq(to)}`);
      message = `Move ${from} to ${to}`;
    } else {
      const p = this.assetPath(op.path);
      if (rt.meta.native) {
        // Native projects are the user's own folder: delete to the macOS Trash.
        const trash = path.join(os.homedir(), ".Trash", `${path.basename(p)} ${Date.now()}`);
        await sb.exec(`mv -- ${shq(p)} ${shq(trash)}`);
      } else await sb.exec(`rm -rf -- ${shq(p)}`);
      message = `Delete ${p}`;
    }
    if (!rt.meta.native) {
      const sha = await gitCommit(sb, message);
      if (sha) rt.emit({ type: "commit", sha, message, routes: [] });
      await this.emitTree(rt);
    }
  }

  /**
   * File actions on the app's source, as in VS Code: rename or move (every import of a moved file follows
   * it, and a page whose file moves keeps its place in the plan), delete, new file, new folder. One commit.
   */
  async sourceOp(
    id: string,
    op: { type: "move"; from: string; to: string } | { type: "delete"; path: string } | { type: "newfile"; path: string } | { type: "mkdir"; path: string },
  ) {
    const rt = await this.runtime(id);
    const sb = await this.sandbox(rt);
    if (!rt.meta.native && rt.running) throw new BusyError();
    const clean = (x: string) => {
      const r = this.checkRel(x.replace(/^\/+|\/+$/g, ""));
      if (/^(\.git|node_modules)(\/|$)/.test(r)) throw new Error("Not a source path");
      return r;
    };
    const all = await sb.listFiles();
    let message = "";
    if (op.type === "move") {
      const from = clean(op.from);
      const to = clean(op.to);
      if (from === to) return;
      if (all.includes(to) || all.some((f) => f.startsWith(to + "/"))) throw new Error(`${to} already exists`);
      const moved = new Map(all.includes(from) ? [[from, to]] : all.filter((f) => f.startsWith(from + "/")).map((f) => [f, to + f.slice(from.length)] as [string, string]));
      if (!moved.size) throw new Error(`${from} not found`);
      const code = new Map<string, string>();
      for (const f of all.filter(isCode)) code.set(f, await sb.readFile(f).catch(() => ""));
      const rewrites = rewriteImports(code, moved);
      await sb.exec(`mkdir -p "$(dirname -- ${shq(to)})" && mv -- ${shq(from)} ${shq(to)}`);
      for (const [f, text] of rewrites) await sb.writeFile(f, text);
      // Pages whose file moved: same page, at its new file (and route, for a file under app/).
      const plan = rt.state.plan;
      if (plan && plan.screens.some((sc) => moved.has(sc.file))) {
        const route = new Map(plan.screens.filter((sc) => moved.has(sc.file)).map((sc) => [sc.route, rt.meta.native || !moved.get(sc.file)!.startsWith("app/") ? sc.route : fileToRoute(moved.get(sc.file)!)]));
        const next = {
          ...plan,
          screens: plan.screens.map((sc) => ({
            ...sc,
            ...(moved.has(sc.file) ? { file: moved.get(sc.file)!, route: route.get(sc.route)!, previewPath: previewPathFor(route.get(sc.route)!) } : {}),
            navigatesTo: sc.navigatesTo.map((r) => route.get(r) ?? r),
          })),
        };
        const removed = [...route].filter(([a, b]) => a !== b).map(([a]) => a);
        rt.emit({ type: "plan", plan: next, ...(removed.length ? { removed } : {}) });
      }
      message = `Rename ${from} to ${to}${rewrites.size ? ` (imports updated in ${rewrites.size} file${rewrites.size > 1 ? "s" : ""})` : ""}`;
    } else if (op.type === "delete") {
      const target = clean(op.path);
      if (rt.meta.native) {
        // Native projects are the user's own folder: delete to the macOS Trash.
        await sb.exec(`mv -- ${shq(target)} ${shq(path.join(os.homedir(), ".Trash", `${path.basename(target)} ${Date.now()}`))}`);
      } else await sb.exec(`rm -rf -- ${shq(target)}`);
      const plan = rt.state.plan;
      const gone = new Set(plan?.screens.filter((sc) => sc.file === target || sc.file.startsWith(target + "/")).map((sc) => sc.route) ?? []);
      if (plan && gone.size) {
        const next = { ...plan, screens: plan.screens.filter((sc) => !gone.has(sc.route)).map((sc) => ({ ...sc, navigatesTo: sc.navigatesTo.filter((r) => !gone.has(r)) })) };
        rt.emit({ type: "plan", plan: next, removed: [...gone] });
      }
      message = `Delete ${target}`;
    } else if (op.type === "newfile") {
      const target = clean(op.path);
      if (all.includes(target)) throw new Error(`${target} already exists`);
      await sb.exec(`mkdir -p "$(dirname -- ${shq(target)})"`);
      await sb.writeFile(target, "");
      message = `New file ${target}`;
    } else {
      const target = clean(op.path);
      // Git keeps no empty folder: a .gitkeep holds it (hidden in the explorer).
      await sb.exec(`mkdir -p -- ${shq(target)} && touch -- ${shq(target + "/.gitkeep")}`);
      message = `New folder ${target}`;
    }
    if (!rt.meta.native) {
      const sha = await gitCommit(sb, message);
      if (sha) rt.emit({ type: "commit", sha, message, routes: [] });
      await this.updateNav(rt).catch(() => {});
    }
    await this.emitTree(rt);
  }

  // ---------- native projects ----------

  async importNative(dirInput: string): Promise<ProjectMeta> {
    const dir = path.resolve(expandHome(dirInput.trim()));
    if (!dir.startsWith(os.homedir() + path.sep)) throw new Error("The project must be inside your home folder");
    const app = await readFile(path.join(dir, "app.json"), "utf8").then(JSON.parse).catch(() => null);
    const pkg = await readFile(path.join(dir, "package.json"), "utf8").catch(() => null);
    if (!app && !pkg) throw new Error("No app.json or package.json in that folder");
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const meta: ProjectMeta = {
      id,
      name: app?.expo?.name ?? path.basename(dir),
      prompt: "",
      createdAt: Date.now(),
      inputs: { image: false, audio: false },
      native: { dir, ...(app?.expo?.ios?.bundleIdentifier ? { bundleId: app.expo.ios.bundleIdentifier } : {}) },
    };
    await this.store.create(meta);
    const rt = await this.runtime(id);
    rt.emit({ type: "agent_message", text: "Native iOS project imported. Press Play → iOS to open it in the Simulator (build it once with `npx expo run:ios`)." });
    rt.emit({ type: "run_status", status: "done" });
    await rt.flush();
    return meta;
  }

  /** Pages captured from the simulator become the plan; screenshots identical below the status bar keep their version. */
  /** Pages of a generated app captured elsewhere (the live Simulator), kept as that device's shots. */
  async recordDeviceShots(id: string, device: string, dark: boolean, shots: { route: string; png: Buffer }[]) {
    const rt = await this.runtime(id);
    for (const { route, png } of shots) {
      const s = rt.state.screens[route];
      if (!s) continue;
      const url = await this.store.saveShot(id, await this.shotName(rt, route, s.version, `-${device}${dark ? "-dark" : ""}`), png);
      if (!this.live(rt, route)) continue;
      rt.emit({ type: "device_shot", route, device, dark, url, version: s.version });
    }
    await rt.flush();
  }

  async recordNativePages(id: string, pages: NativePage[], opts: { dark?: boolean; refresh?: boolean; device?: string }) {
    const rt = await this.runtime(id);
    const routeOf = (p: { title: string; parent?: string }) => "/" + (p.parent ? `${slug(p.parent)}/` : "") + slug(p.title);

    if (opts.device) {
      for (const p of pages) {
        const route = routeOf(p);
        const s = rt.state.screens[route];
        if (!s) continue;
        const name = `${routeSlug(route)}-v${s.version}-${slug(opts.device)}${opts.dark ? "-dark" : ""}-${Date.now()}.png`;
        const url = await this.store.saveShot(id, name, p.png);
        if (this.live(rt, route)) rt.emit({ type: "device_shot", route, device: opts.device, dark: !!opts.dark, url, version: s.version });
      }
      return;
    }
    if (opts.dark) {
      for (const p of pages) {
        const route = routeOf(p);
        const s = rt.state.screens[route];
        if (!s) continue;
        rt.emit({ type: "dark_shot", route, url: await this.store.saveShot(id, `${routeSlug(route)}-v${s.version}-dark-${Date.now()}.png`, p.png), version: s.version });
      }
      return;
    }
    const plan: AppPlan = {
      name: rt.state.name,
      theme: { primary: "#007AFF", background: "#000000" },
      dataModel: [],
      screens: pages.map((p) => ({
        route: routeOf(p),
        file: p.file ?? (p.parent ? `tabs/${p.parent}/${p.title}` : `tabs/${p.title}`),
        title: p.title,
        purpose: p.parent ? `Opened from ${p.parent}${p.file ? ` (${p.file})` : ""}` : "Captured from the iOS Simulator",
        components: [],
        navigatesTo: pages.filter((c) => c.parent === p.title).map(routeOf),
        acceptance: [],
        previewPath: routeOf(p),
      })),
    };
    rt.emit({ type: "plan", plan });
    for (const p of pages) {
      const route = routeOf(p);
      const prev = rt.state.screens[route];
      const prevPng = prev?.screenshotUrl ? await this.store.readShot(id, path.basename(prev.screenshotUrl)).catch(() => null) : null;
      if (prevPng && prev.version > 0 && (await sameBelowStatusBar(prevPng, p.png))) continue;
      const version = opts.refresh && prev?.version ? prev.version : (prev?.version ?? 0) + 1;
      const url = await this.store.saveShot(id, `${routeSlug(route)}-v${version}-${Date.now()}.png`, p.png);
      rt.emit({ type: "screenshot", route, url, version });
      rt.emit({ type: "screen_status", route, status: "done", version });
    }
    const files = [...new Set(pages.map((p) => p.file).filter((f): f is string => !!f))];
    if (files.length) rt.emit({ type: "tree", files: await listSourceFiles(rt.meta.native!.dir) });
    rt.emit({
      type: "nav",
      edges: pages.filter((p) => p.parent).map((p) => ({ from: routeOf({ title: p.parent! }), to: routeOf(p), source: "code" as const })),
    });
    await rt.flush();
  }

  private async iterateNative(rt: ProjectRuntime, req: PromptRequest) {
    const plan = rt.state.plan;
    if (!plan) throw new Error("Capture the app's pages from the simulator first.");
    const dir = rt.meta.native!.dir;
    const sb = await this.sandbox(rt);
    const notes = await sb.readFile("AGENTS.md").catch(() => "");
    const focused = req.route ? plan.screens.find((s) => s.route === req.route) : undefined;
    const screen = focused ? rt.state.screens[focused.route] : undefined;
    const shot = screen?.screenshotUrl ? await this.store.readShot(rt.meta.id, path.basename(screen.screenshotUrl)).catch(() => null) : null;

    const picks: PickInfo[] = [];
    const crops: { mediaType: string; data: string; caption: string }[] = [];
    const raw = req.picks?.length ? req.picks : req.testId ? [{ testId: req.testId, area: req.area }] : [];
    for (const [i, pk] of raw.entries()) {
      if (pk.file) picks.push({ testId: pk.testId, file: pk.file, line: pk.line, snippet: await this.snippet(sb, pk.file, pk.line, 3) });
      else picks.push({ testId: pk.testId, ...(await resolveNative(dir, pk.testId)) });
      if (shot && "area" in pk && pk.area) {
        const crop = await cropArea(shot, pk.area).catch(() => null);
        if (crop) crops.push({ mediaType: "image/png", data: crop.toString("base64"), caption: `Element ${i + 1} (${pk.testId}):` });
      }
    }
    const images: { mediaType: string; data: string; caption: string }[] = [];
    if (req.image) images.push({ mediaType: req.image.mediaType, data: req.image.data, caption: "Image attached by the user:" });
    // Files dropped on the prompt: their pictures for the model to look at, their text to read.
    const attached = await prepareAttachments(req.attachments);
    images.push(...attached.images);
    const text = [req.text, attached.text].filter(Boolean).join("\n\n");
    if (shot) images.push({ mediaType: "image/png", data: shot.toString("base64"), caption: `Current screenshot of ${focused?.title ?? "the app"}:` });
    images.push(...crops);

    const all = (await listSourceFiles(dir)).filter((f) => /\.(tsx?|jsx?)$/.test(f));
    const chosen = all.length <= 14 ? all : ["App.tsx", "index.ts", ...picks.map((p) => p.file).filter((f): f is string => !!f)];
    const files = await this.readFiles(sb, chosen);
    if (focused) rt.emit({ type: "screen_status", route: focused.route, status: "building", version: screen?.version ?? 1 });
    this.phase(rt, { phase: "builder", route: focused?.route, detail: focused?.title });
    const ctx = await this.toolCtx(rt, { unrestricted: true, local: true, nativeApp: true });
    const tools: ToolName[] = ["list_files", "read_file", "write_file", "apply_patch", "delete_file", "typecheck", "skill", "finish"];
    const pkg = await sb.readFile("package.json").catch(() => "");
    // Page files there before the agent works (a captured page's file can be a label, never a path on disk).
    const pageFiles = plan.screens.map((sc) => sc.file);
    const existedBefore = await this.existing(sb, pageFiles);
    const summary = await runBuilderTask(this.deps(rt), ctx, {
      system: nativeBuilderSystem(notes, plan, dependencies(pkg)),
      task: nativePromptTask({ text, voice: !!req.audio, page: focused?.title, picks, crops: crops.length, files }),
      images,
      audio: req.audio,
      maxTurns: this.cfg.maxBuilderTurns,
      tools,
      route: focused?.route,
    });
    // Pages whose file the agent deleted leave the plan now, not at the next capture.
    const deleted = await this.deletedFiles(sb, [...existedBefore], existedBefore, "HEAD");
    const gone = new Set(plan.screens.filter((sc) => deleted.has(sc.file)).map((sc) => sc.route));
    if (gone.size) {
      const next = { ...plan, screens: plan.screens.filter((sc) => !gone.has(sc.route)).map((sc) => ({ ...sc, navigatesTo: sc.navigatesTo.filter((r) => !gone.has(r)) })) };
      rt.emit({ type: "plan", plan: next, removed: [...gone] });
    }
    // The IDE re-captures the simulator afterwards.
    if (focused && !gone.has(focused.route)) rt.emit({ type: "screen_status", route: focused.route, status: "done", version: screen?.version ?? 1 });
    rt.emit({ type: "agent_message", text: summary || "Done.", route: focused?.route });
  }
}

/** The package names a package.json depends on. */
export function dependencies(pkg: string): string[] {
  try {
    const j = JSON.parse(pkg);
    return Object.keys({ ...j.dependencies, ...j.devDependencies });
  } catch {
    return [];
  }
}

/** Finds the code for a native element: testID-like props, then its text, then its first word. */
export async function resolveNative(dir: string, key: string): Promise<Omit<ResolvedElement, "testId">> {
  const files = (await listSourceFiles(dir)).filter((f) => /\.(tsx|jsx|ts|js)$/.test(f));
  const sources = await Promise.all(files.map(async (f) => ({ f, text: await readFile(path.join(dir, f), "utf8").catch(() => "") })));
  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tries = [
    new RegExp(`(testID|nativeID|accessibilityIdentifier)=\\{?["'\`]${esc}["'\`]`),
    new RegExp(`>\\s*${esc}\\s*<|["'\`]${esc}["'\`]`),
    ...(key.includes(" ") ? [new RegExp(`\\b${key.split(/\s+/)[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`)] : []),
  ];
  for (const re of tries) {
    for (const { f, text } of sources) {
      const lines = text.split("\n");
      const idx = lines.findIndex((l) => re.test(l));
      if (idx >= 0) {
        const line = idx + 1;
        const snippet = lines
          .slice(Math.max(0, idx - 2), idx + 3)
          .map((l, i) => `${Math.max(1, line - 2) + i}: ${l}`)
          .join("\n");
        return { file: f, line, snippet };
      }
    }
  }
  return {};
}

/** Crop of a fractional area of a screenshot, with 2% padding. */
export async function cropArea(png: Buffer, area: { x: number; y: number; width: number; height: number }) {
  const img = sharp(png);
  const { width = 0, height = 0 } = await img.metadata();
  const pad = 0.02;
  const left = Math.max(0, Math.floor((area.x - pad) * width));
  const top = Math.max(0, Math.floor((area.y - pad) * height));
  const w = Math.min(width - left, Math.ceil((area.width + 2 * pad) * width));
  const h = Math.min(height - top, Math.ceil((area.height + 2 * pad) * height));
  return img.extract({ left, top, width: Math.max(1, w), height: Math.max(1, h) }).png().toBuffer();
}

/**
 * Same screen, ignoring the status bar (top 7%): 128×256 greyscale, pixels differing by more than 18
 * levels, "same" under 0.2%. A recolored element counts as a change; JPEG noise does not.
 */
export async function sameBelowStatusBar(a: Buffer, b: Buffer) {
  const norm = async (buf: Buffer) => {
    const img = sharp(buf);
    const { width = 1, height = 1 } = await img.metadata();
    const top = Math.round(height * 0.07);
    return img.extract({ left: 0, top, width, height: height - top }).resize(128, 256, { fit: "fill" }).greyscale().raw().toBuffer();
  };
  const [x, y] = await Promise.all([norm(a), norm(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) if (Math.abs(x[i] - y[i]) > 18) diff++;
  return diff / x.length < 0.002;
}

// Bump when the orchestrator changes in a way a running dev server must pick up without a restart.
const INSTANCE_KEY = "__sparkflowOrchestrator_v11";
const g = globalThis as unknown as Record<string, Orchestrator | undefined>;

/**
 * One orchestrator per server process, kept across HMR. Next.js bundles each API route separately, so the
 * class is not a stable identity: the instance lives on globalThis and is never replaced while running.
 */
export function getOrchestrator() {
  return (g[INSTANCE_KEY] ??= new Orchestrator());
}

export type { MediaInput, Verdict, InspectTargetResult };

/** A shell argument, quoted. */
const q = (s: string) => `'${s.replace(/'/g, "'\\''")}'`;

/** A git remote as its GitHub page. */
function webUrlOf(remote: string) {
  const m = /github\.com[:/]([\w.-]+)\/([\w.-]+?)(\.git)?$/.exec(remote);
  return m ? `https://github.com/${m[1]}/${m[2]}` : null;
}

/** com.sparkflow.<name>: the bundle ID of an app that hasn't chosen its own. */
const defaultBundleId = (name: string) => `com.sparkflow.${name.toLowerCase().replace(/[^a-z0-9]/g, "") || "app"}`;

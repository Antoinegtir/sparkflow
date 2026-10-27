import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import { isMac } from "@/lib/web/platform";
import path from "node:path";
import type { ExecResult, InspectJob, InspectTargetResult, Preview, Sandbox, SandboxDriver } from "./types";
import { childEnv, dataDir, findFreePort, IGNORED_DIRS, lanIp, LineBuffer, repoRoot, templateDir } from "./util";

const MAX_OUTPUT = 256 * 1024;

/** bash -c in its own process group, killed as a group on timeout. */
export function execIn(cwd: string, command: string, timeoutSec = 120, extraEnv: Record<string, string> = {}): Promise<ExecResult> {
  return new Promise((resolve) => {
    const child = spawn("bash", ["-c", command], {
      cwd,
      detached: true,
      env: childEnv({
        PATH: `${path.join(cwd, "node_modules", ".bin")}:${process.env.PATH}`,
        EXPO_NO_TELEMETRY: "1",
        // Git must never walk up out of a sandbox into the repository that contains it.
        GIT_CEILING_DIRECTORIES: path.dirname(cwd),
        ...extraEnv,
      }),
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    child.stdout.on("data", (d) => stdout.length < MAX_OUTPUT && (stdout += d));
    child.stderr.on("data", (d) => stderr.length < MAX_OUTPUT && (stderr += d));
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        process.kill(-child.pid!, "SIGKILL");
      } catch {}
    }, timeoutSec * 1000);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? (timedOut ? 124 : 1), stdout, stderr, timedOut });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ code: 1, stdout, stderr: stderr + String(err), timedOut });
    });
  });
}

export async function walk(root: string, sub = "", ignored = IGNORED_DIRS, max = 5000): Promise<string[]> {
  const out: string[] = [];
  const go = async (rel: string) => {
    if (out.length >= max) return;
    const entries = await readdir(path.join(root, rel), { withFileTypes: true }).catch(() => []);
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (ignored.has(e.name)) continue;
      const p = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) await go(p);
      else out.push(p);
    }
  };
  await go(sub);
  return out;
}

type Metro = { proc: ChildProcess; port: number; logs: LineBuffer; ready: Promise<void> };
const g = globalThis as unknown as { __sparkflowMetro?: Map<string, Metro>; __sparkflowExitHook?: boolean };
const metros = (g.__sparkflowMetro ??= new Map());
if (!g.__sparkflowExitHook) {
  g.__sparkflowExitHook = true;
  process.on("exit", () => {
    for (const m of metros.values()) {
      try {
        process.kill(-m.proc.pid!, "SIGKILL");
      } catch {}
    }
  });
}

/** Runs the Playwright inspector as a child process (keeps Playwright out of the Next.js bundle). */
export async function runInspector(job: InspectJob & { baseUrl: string }): Promise<InspectTargetResult[]> {
  const dir = path.join(dataDir(), "inspect", `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  await mkdir(dir, { recursive: true });
  try {
    await writeFile(path.join(dir, "job.json"), JSON.stringify(job));
    const script = path.join(repoRoot(), "lib", "sandbox", "runtime", "inspect.mjs");
    const timeout = Math.round((job.navigationTimeoutMs ?? 120000) / 1000) + 45 * job.targets.length + 30;
    const r = await execIn(repoRoot(), `node ${JSON.stringify(script)} ${JSON.stringify(dir)}`, timeout);
    if (!r.stdout.includes("SPARKFLOW_INSPECT_DONE")) throw new Error(`Inspector failed: ${(r.stderr || r.stdout).slice(-1500)}`);
    const raw = JSON.parse(await readFile(path.join(dir, "result.json"), "utf8"));
    const load = (name: string | null) => (name ? readFile(path.join(dir, name)) : Promise.resolve(null));
    return Promise.all(
      raw.map(async (t: any) => ({
        ...t,
        screenshot: await load(t.screenshot),
        stepShots: (await Promise.all((t.stepShots as string[]).map(load))).filter(Boolean),
        video: await load(t.video),
      })),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Time Metro needs to notice a file change before a page reflects it. */
const METRO_SETTLE_MS = 2000;
const lastWrite = new Map<string, number>();

class LocalSandbox implements Sandbox {
  constructor(
    public id: string,
    public dir: string,
  ) {}

  async exec(command: string, opts?: { timeoutSec?: number }) {
    const r = await execIn(this.dir, command, opts?.timeoutSec ?? 120);
    // git checkout, rm and friends change files too.
    if (/\b(git (checkout|reset|restore)|rm|mv|cp)\b/.test(command)) lastWrite.set(this.id, Date.now());
    return r;
  }
  private abs(rel: string) {
    const p = path.resolve(this.dir, rel);
    if (!p.startsWith(this.dir + path.sep) && p !== this.dir) throw new Error(`Path outside the project: ${rel}`);
    return p;
  }
  readFile(rel: string) {
    return readFile(this.abs(rel), "utf8");
  }
  readFileBytes(rel: string) {
    return readFile(this.abs(rel));
  }
  async writeFile(rel: string, content: string | Buffer) {
    const p = this.abs(rel);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, content);
    lastWrite.set(this.id, Date.now());
  }
  listFiles(dir?: string) {
    return walk(this.dir, dir ?? "");
  }

  async startDevServer(): Promise<Preview> {
    let m = metros.get(this.id);
    if (!m || m.proc.exitCode !== null) {
      await this.killStale();
      const port = await findFreePort(8100);
      const logs = new LineBuffer();
      const proc = spawn("bash", ["-c", `npx expo start --port ${port}`], {
        cwd: this.dir,
        detached: true,
        env: childEnv({
          PATH: `${path.join(this.dir, "node_modules", ".bin")}:${process.env.PATH}`,
          BROWSER: "none",
          // No CI=1: Expo turns file watching off in CI mode, and edits would never reach the page.
          EXPO_NO_TELEMETRY: "1",
          EXPO_NO_REDIRECT_PAGE: "1",
        }),
      });
      proc.stdout!.on("data", (d) => logs.push(String(d)));
      proc.stderr!.on("data", (d) => logs.push(String(d)));
      await mkdir(path.join(this.dir, ".expo"), { recursive: true });
      await writeFile(path.join(this.dir, ".expo", "sparkflow-metro.pid"), String(proc.pid));
      const ready = new Promise<void>((resolve, reject) => {
        const deadline = Date.now() + 180000;
        const poll = async () => {
          if (proc.exitCode !== null) return reject(new Error(`Metro exited early:\n${logs.tail(30)}`));
          const ok = await fetch(`http://127.0.0.1:${port}/status`).then((r) => r.text()).catch(() => "");
          if (ok.includes("running")) return resolve();
          if (Date.now() > deadline) return reject(new Error(`Metro did not start in 180 s:\n${logs.tail(30)}`));
          setTimeout(poll, 500);
        };
        poll();
      });
      m = { proc, port, logs, ready };
      metros.set(this.id, m);
      proc.on("exit", () => metros.get(this.id) === m && metros.delete(this.id));
    }
    await m.ready;
    return { webUrl: `http://localhost:${m.port}`, internalUrl: `http://127.0.0.1:${m.port}`, expoGoUrl: `exp://${lanIp()}:${m.port}` };
  }

  /** A Metro left over by a previous server process (pid file) is killed before starting a new one. */
  private async killStale() {
    const pidFile = path.join(this.dir, ".expo", "sparkflow-metro.pid");
    const pid = Number(await readFile(pidFile, "utf8").catch(() => ""));
    if (pid) {
      try {
        process.kill(-pid, "SIGKILL");
      } catch {}
    }
  }

  devServerRunning() {
    const m = metros.get(this.id);
    return !!m && m.proc.exitCode === null;
  }
  devServerLogs(lines: number) {
    return metros.get(this.id)?.logs.tail(lines) ?? "";
  }
  async inspect(job: InspectJob) {
    const p = await this.startDevServer();
    const wait = (lastWrite.get(this.id) ?? 0) + METRO_SETTLE_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    return runInspector({ ...job, baseUrl: p.internalUrl });
  }
  async terminate() {
    const m = metros.get(this.id);
    if (m) {
      try {
        process.kill(-m.proc.pid!, "SIGKILL");
      } catch {}
      metros.delete(this.id);
    }
  }
}

let depsReady: Promise<void> | undefined;
/** Installs the template's node_modules once. */
function ensureTemplateDeps() {
  return (depsReady ??= (async () => {
    if (existsSync(path.join(templateDir(), "node_modules", "expo"))) return;
    const r = await execIn(templateDir(), "npm install --no-audit --no-fund", 900);
    if (r.code !== 0) throw new Error(`Template install failed:\n${r.stderr.slice(-2000)}`);
  })());
}

export class LocalDriver implements SandboxDriver {
  name = "local" as const;
  root = path.join(dataDir(), "sandboxes");

  private opening = new Map<string, Promise<Sandbox>>();

  /** One open per project at a time: a second caller must never wipe a copy in progress. */
  open(projectId: string): Promise<Sandbox> {
    let p = this.opening.get(projectId);
    if (!p) {
      p = this.create(projectId);
      this.opening.set(projectId, p);
      p.catch(() => this.opening.delete(projectId));
    }
    return p;
  }

  private async create(projectId: string): Promise<Sandbox> {
    const dir = path.join(this.root, projectId);
    if (!existsSync(path.join(dir, ".git"))) {
      await ensureTemplateDeps();
      await mkdir(this.root, { recursive: true });
      await rm(dir, { recursive: true, force: true });
      // Copy-on-write clone on APFS / reflink on Linux: the template's node_modules costs nothing.
      const cp = isMac() ? `cp -cR ${q(templateDir())} ${q(dir)} || cp -R ${q(templateDir())} ${q(dir)}` : `cp -R --reflink=auto ${q(templateDir())} ${q(dir)}`;
      const r = await execIn(this.root, cp, 600);
      if (r.code !== 0) throw new Error(`Could not copy the template: ${r.stderr.slice(-500)}`);
      await rm(path.join(dir, ".expo"), { recursive: true, force: true });
      await execIn(dir, "printf 'node_modules\\n.expo\\ndist\\n' >> .gitignore && git init -q && git add -A && git -c user.name=Sparkflow -c user.email=agent@sparkflow.dev commit -q -m Template");
    }
    return new LocalSandbox(projectId, dir);
  }

  async remove(projectId: string) {
    this.opening.delete(projectId);
    const sb = new LocalSandbox(projectId, path.join(this.root, projectId));
    await sb.terminate();
    await rm(sb.dir, { recursive: true, force: true });
  }
}

const q = (s: string) => `'${s.replace(/'/g, "'\\''")}'`;

/** A local folder that is not a Sparkflow sandbox (the user's own native project). No dev server, no inspector. */
export class FolderSandbox implements Sandbox {
  constructor(
    public id: string,
    public dir: string,
  ) {}
  exec(command: string, opts?: { timeoutSec?: number }) {
    return execIn(this.dir, command, opts?.timeoutSec ?? 120);
  }
  private abs(rel: string) {
    const p = path.resolve(this.dir, rel);
    if (!p.startsWith(this.dir + path.sep)) throw new Error(`Path outside the project: ${rel}`);
    return p;
  }
  readFile(rel: string) {
    return readFile(this.abs(rel), "utf8");
  }
  readFileBytes(rel: string) {
    return readFile(this.abs(rel));
  }
  async writeFile(rel: string, content: string | Buffer) {
    const p = this.abs(rel);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, content);
  }
  listFiles(dir?: string) {
    return listSourceFiles(this.dir, dir);
  }
  startDevServer(): Promise<Preview> {
    throw new Error("Native projects run in the iOS Simulator, not in Sparkflow's web preview.");
  }
  devServerRunning() {
    return false;
  }
  devServerLogs() {
    return "";
  }
  inspect(): Promise<InspectTargetResult[]> {
    throw new Error("Native projects are captured from the iOS Simulator.");
  }
  async terminate() {}
}

const NATIVE_IGNORED = new Set(["node_modules", "dist", "build", "Pods", "xcuserdata", ".gradle", "DerivedData", ".git", ".expo"]);

/** Source walk of a user project: dotfiles skipped (except .keep), heavy folders skipped, at most 500 files. */
export async function listSourceFiles(root: string, sub?: string) {
  const files = await walk(root, sub ?? "", NATIVE_IGNORED, 2000);
  return files.filter((f) => f.split("/").every((p) => !p.startsWith(".") || p === ".keep")).slice(0, 500);
}

export const isDirectory = (p: string) => stat(p).then((s) => s.isDirectory()).catch(() => false);

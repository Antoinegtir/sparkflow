import { existsSync, lstatSync, mkdirSync, readdirSync, readlinkSync, renameSync, rmdirSync, rmSync, unlinkSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

let root: string | undefined;
/** Repo root: SPARKFLOW_ROOT, else the nearest folder up with a package.json named "sparkflow". */
export function repoRoot() {
  if (root) return root;
  if (process.env.SPARKFLOW_ROOT) return (root = process.env.SPARKFLOW_ROOT);
  let dir = process.cwd();
  for (;;) {
    if (existsSync(path.join(dir, "templates", "expo-base"))) return (root = dir);
    const up = path.dirname(dir);
    if (up === dir) return (root = process.cwd());
    dir = up;
  }
}

/** The apps folder: each app's code in its own folder (~/Documents/apps/wander). */
export const dataDir = () => process.env.SPARKFLOW_DATA_DIR ?? path.join(repoRoot(), ".sparkflow");
/** What Sparkflow keeps about the apps (history, screenshots), hidden in the apps folder. */
export const stateDir = () => path.join(dataDir(), ".sparkflow");

/**
 * Apps folders from before 0.3.28 kept the code in sandboxes/<id>, behind links named after the
 * apps, and Sparkflow's files next to it: the code moves up to <id>, the rest into .sparkflow/.
 * Run before anything opens a project.
 */
export function migrateDataDir() {
  const root = dataDir();
  const old = path.join(root, "sandboxes");
  if (!existsSync(old)) return;
  const state = stateDir();
  mkdirSync(state, { recursive: true });
  for (const name of ["projects", "inspect", ".seeded-wander", "modal-image.json", "template.tgz"]) {
    const from = path.join(root, name);
    if (existsSync(from) && !existsSync(path.join(state, name))) renameSync(from, path.join(state, name));
  }
  const links = readdirSync(root).filter((e) => lstatSync(path.join(root, e)).isSymbolicLink() && readlinkSync(path.join(root, e)).startsWith(old + path.sep));
  for (const e of links) unlinkSync(path.join(root, e));
  for (const id of readdirSync(old).filter((e) => lstatSync(path.join(old, e)).isDirectory())) {
    if (!existsSync(path.join(root, id))) renameSync(path.join(old, id), path.join(root, id));
  }
  rmSync(path.join(old, ".DS_Store"), { force: true });
  try {
    rmdirSync(old);
  } catch {
    // An app whose name was taken stays there.
  }
}
export const templateDir = () => path.join(repoRoot(), "templates", "expo-base");

/** Env for child processes, without the Next.js / npm variables that would confuse Expo. */
export function childEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v == null) continue;
    if (/^(NODE_ENV|PORT|NODE_OPTIONS|INIT_CWD|TURBOPACK)$/.test(k)) continue;
    if (/^(NEXT_|__NEXT|npm_|PNPM_)/.test(k)) continue;
    env[k] = v;
  }
  return { ...env, ...extra } as NodeJS.ProcessEnv;
}

/** Ring of the last N lines, ANSI codes stripped. */
export class LineBuffer {
  private lines: string[] = [];
  private partial = "";
  constructor(private max = 2000) {}
  push(chunk: string) {
    const text = (this.partial + chunk).replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");
    const parts = text.split(/\r?\n/);
    this.partial = parts.pop() ?? "";
    this.lines.push(...parts);
    if (this.lines.length > this.max) this.lines.splice(0, this.lines.length - this.max);
  }
  tail(n: number) {
    return [...this.lines, ...(this.partial ? [this.partial] : [])].slice(-n).join("\n");
  }
}

export function lanIp() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list ?? []) if (i.family === "IPv4" && !i.internal) return i.address;
  }
  return "127.0.0.1";
}

export function findFreePort(from: number): Promise<number> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(findFreePort(from + 1)));
    // All interfaces, like Metro: a port taken on [::] can still look free on 127.0.0.1 alone.
    srv.listen(from, () => srv.close(() => resolve(from)));
  });
}

export const IGNORED_DIRS = new Set(["node_modules", ".git", ".expo", "dist", "web-build", ".sparkflow"]);

export const expandHome = (p: string) => (p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p);

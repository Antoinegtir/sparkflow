import { existsSync } from "node:fs";
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

export const dataDir = () => process.env.SPARKFLOW_DATA_DIR ?? path.join(repoRoot(), ".sparkflow");
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
    srv.listen(from, "127.0.0.1", () => srv.close(() => resolve(from)));
  });
}

export const IGNORED_DIRS = new Set(["node_modules", ".git", ".expo", "dist", "web-build", ".sparkflow"]);

export const expandHome = (p: string) => (p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p);

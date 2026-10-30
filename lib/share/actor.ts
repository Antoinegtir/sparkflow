import { realpath } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import type { Role } from "../shared/share";
import { RANK } from "./policy";

/** Who is calling, as decided by proxy.ts (it strips any client copy of these headers). Fails closed. */
export type Actor = { kind: "owner"; me: "owner" } | { kind: "guest"; me: string; uid: string; projectId: string; role: Role } | { kind: "public" };

const deny = (status: number, code?: string) => Response.json({ error: status === 401 ? "Sparkflow: not signed in" : "Sparkflow: not allowed", ...(code ? { code } : {}) }, { status });

export function actorOf(req: Request): Actor {
  const h = req.headers;
  const kind = h.get("x-sparkflow-actor");
  if (kind === "owner") return { kind: "owner", me: "owner" };
  if (kind === "public") return { kind: "public" };
  if (kind === "guest") {
    const uid = h.get("x-sparkflow-uid");
    const projectId = h.get("x-sparkflow-project");
    const role = h.get("x-sparkflow-role") as Role | null;
    if (uid && projectId && role && role in RANK) return { kind: "guest", me: uid, uid, projectId, role };
  }
  throw deny(401);
}

export function requireOwner(req: Request): void {
  if (actorOf(req).kind !== "owner") throw deny(403, "role");
}

export function requireRole(req: Request, min: Role): Actor {
  const a = actorOf(req);
  if (a.kind === "owner") return a;
  if (a.kind === "guest" && RANK[a.role] >= RANK[min]) return a;
  throw deny(403, "role");
}

const norm = (rel: string) => rel.replace(/\\/g, "/").replace(/^\.?\/+/, "");

/** Secrets a guest never reads, even with view access to the code. */
export function guestReadable(rel: string): boolean {
  const p = norm(rel);
  const parts = p.split("/");
  const base = parts[parts.length - 1] ?? "";
  if (parts.includes(".git") || parts.includes("..")) return false;
  return !(
    /^\.env/.test(base) ||
    /\.(pem|p8|p12|key|keystore|jks|mobileprovision)$/i.test(base) ||
    /^AuthKey_/.test(base) ||
    /^credentials.*\.json$/i.test(base) ||
    base === "google-services.json" ||
    base === "GoogleService-Info.plist" ||
    base === ".npmrc"
  );
}

/** Files whose content runs on the owner's Mac (configs, scripts, server routes): editors can't write them. true = allowed. */
export function guardGuestPath(rel: string): boolean {
  const p = norm(rel);
  const parts = p.split("/");
  const base = parts[parts.length - 1] ?? "";
  if (!p || parts.includes("..")) return false;
  if (["node_modules", ".git"].includes(parts[0]) || parts.includes(".git") || parts.includes("node_modules")) return false;
  if (["plugins", "scripts"].includes(parts[0])) return false;
  // Editor, hook and CI folders run their contents on the owner's Mac (tasks, git hooks, workflows).
  if (parts.some((s) => [".vscode", ".husky", ".github", ".githooks", ".idea", ".devcontainer", ".cursor", ".claude", ".circleci", ".gitlab"].includes(s))) return false;
  if (/^\.(gitattributes|gitmodules|npmrc|yarnrc(\.yml)?|nvmrc|envrc|tool-versions)$/.test(base)) return false;
  if (parts.length === 1 && /^(package\.json|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|app\.json|eas\.json)$/.test(base)) return false;
  if (/^app\.config\./.test(base) || /\.config\.(js|cjs|mjs|ts)$/.test(base) || /^\.env/.test(base)) return false;
  if (/\+api\.tsx?$/.test(base) || base === "+html.tsx" || base === "+middleware.ts") return false;
  return true;
}

/** rel resolves (symlinks followed) inside root. A file not yet created is judged by its nearest existing folder. */
export async function insideProject(root: string, rel: string): Promise<boolean> {
  try {
    const base = await realpath(root);
    let target = path.resolve(base, rel);
    let rest = "";
    for (;;) {
      try {
        target = path.join(await realpath(target), rest);
        break;
      } catch {
        const up = path.dirname(target);
        if (up === target) return false;
        rest = path.join(path.basename(target), rest);
        target = up;
      }
    }
    return target === base || target.startsWith(base + path.sep);
  } catch {
    return false;
  }
}

/** A project's state as a guest sees it: no local folder, no preview URLs, home folder shown as ~. */
export function redactForGuest<T>(state: T): T {
  const home = homedir();
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return home && v.includes(home) ? v.split(home).join("~") : v;
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  const out = walk(state) as Record<string, unknown>;
  if (out && typeof out === "object") {
    delete out.preview;
    if (out.native && typeof out.native === "object") delete (out.native as Record<string, unknown>).dir;
  }
  return out as T;
}

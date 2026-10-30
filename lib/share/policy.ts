/**
 * What a guest may call, by role. Pure (no imports) so the proxy and the tests share it.
 * Anything not listed here is denied: owner-only routes simply have no rule.
 */
import type { Role } from "../shared/share";

export const RANK: Record<Role, number> = { view: 0, comment: 1, edit: 2 };

const P = "^/api/projects/([A-Za-z0-9_-]{1,64})";

type Rule = { methods: string[]; re: RegExp; min: Role | ((q: URLSearchParams) => Role) };

const GUEST_RULES: Rule[] = [
  { methods: ["GET"], re: /^\/api\/projects$/, min: "view" },
  { methods: ["GET"], re: /^\/api\/file-icon$/, min: "view" },
  { methods: ["GET"], re: new RegExp(`${P}$`), min: "view" },
  // The route itself accepts previewDevice only from guests; renaming stays with the owner.
  { methods: ["PATCH"], re: new RegExp(`${P}$`), min: "edit" },
  { methods: ["GET", "DELETE"], re: new RegExp(`${P}/access$`), min: "view" },
  { methods: ["GET"], re: new RegExp(`${P}/events$`), min: "view" },
  { methods: ["GET"], re: new RegExp(`${P}/board$`), min: "view" },
  { methods: ["POST"], re: new RegExp(`${P}/board$`), min: "comment" },
  { methods: ["GET"], re: new RegExp(`${P}/shots/[^/]+$`), min: "view" },
  { methods: ["GET"], re: new RegExp(`${P}/(layout|resolve)$`), min: "view" },
  { methods: ["GET"], re: new RegExp(`${P}/commits/[0-9a-f]{7,40}$`), min: "view" },
  { methods: ["GET"], re: new RegExp(`${P}/files$`), min: (q) => (q.has("diagnostics") ? "edit" : "view") },
  { methods: ["POST", "PATCH"], re: new RegExp(`${P}/files$`), min: "edit" },
  { methods: ["POST"], re: new RegExp(`${P}/ticket$`), min: "view" },
  { methods: ["POST"], re: new RegExp(`${P}/(prompt|stop|undo|restore|dark|preview|device-shots|lang)$`), min: "edit" },
];

/** Encoded, dotted, doubled or trailing slashes could reach another route than the one matched. */
export function cleanPath(p: string): boolean {
  return p.startsWith("/") && !/%|\.\.|\/\/|\\/.test(p) && (p === "/" || !p.endsWith("/"));
}

/** The rule a guest request falls under, or null (denied). projectId is set on /api/projects/{id}/… */
export function matchRule(method: string, pathname: string, search: string): { min: Role; projectId?: string } | null {
  if (!cleanPath(pathname) || !pathname.startsWith("/api/")) return null;
  const q = new URLSearchParams(search);
  for (const r of GUEST_RULES) {
    if (!r.methods.includes(method)) continue;
    const m = r.re.exec(pathname);
    if (!m) continue;
    return { min: typeof r.min === "function" ? r.min(q) : r.min, ...(m[1] ? { projectId: m[1] } : {}) };
  }
  return null;
}

/** A ticket (?t=) is for <img src> and the like, which can't send headers: only these GETs. */
export function ticketOk(method: string, pathname: string, search: string): boolean {
  if (method !== "GET" || !cleanPath(pathname)) return false;
  if (pathname === "/api/file-icon") return true;
  if (new RegExp(`${P}/shots/[^/]+$`).test(pathname)) return true;
  return new RegExp(`${P}/files$`).test(pathname) && new URLSearchParams(search).has("raw");
}

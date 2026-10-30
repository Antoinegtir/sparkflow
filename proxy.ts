import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { CLOUD, ownerOf, sessionOf, takeRun } from "./lib/cloud/mode";
import { guestAccess, sharingActive } from "./lib/share/gate";

/**
 * Decides who is calling, and nothing else does. The owner: whoever holds the token `npm run remote`
 * prints, or a request straight from this machine. A guest: a project member's key ("sfg_…", header
 * only) or a short-lived ticket (?t=, for images), held to that project and role by lib/share/policy.ts.
 * Routes read the verdict from x-sparkflow-* headers set here; client copies are dropped.
 */
const TOKEN = process.env.SPARKFLOW_TOKEN;
const ORIGINS = (process.env.SPARKFLOW_ORIGINS ?? "https://sparkflow-ai.web.app,https://sparkflow-ai.firebaseapp.com,http://localhost:3000,http://localhost:3001")
  .split(",")
  .map((o) => o.trim());
const COOKIE = "sparkflow_token";
const ACTOR_HEADERS = ["x-sparkflow-actor", "x-sparkflow-uid", "x-sparkflow-project", "x-sparkflow-role", "x-sparkflow-cloud"];
const PUBLIC = /^\/api\/share\/(join|session|preview)$/;

function cors(req: NextRequest, res: NextResponse) {
  const origin = req.headers.get("origin");
  if (origin && ORIGINS.includes(origin)) {
    res.headers.set("access-control-allow-origin", origin);
    res.headers.set("access-control-allow-methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
    res.headers.set("access-control-allow-headers", "content-type,x-sparkflow-token");
    res.headers.set("access-control-max-age", "600");
    // Chrome's Private/Local Network Access: the hosted site may call this computer's localhost.
    res.headers.set("access-control-allow-private-network", "true");
    res.headers.append("vary", "origin");
  }
  return res;
}

/**
 * Straight from this machine: localhost host, and no Cloudflare header (the tunnel adds
 * cf-connecting-ip to everything it forwards; x-forwarded-for can't tell, Next sets it itself).
 */
function local(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host) && !req.headers.has("cf-connecting-ip");
}

/** Digests first, so a length difference can't throw or leak through timing. */
const digest = (s: string) => createHash("sha256").update(s).digest();
const isToken = (given: string | undefined | null) => !!TOKEN && !!given && timingSafeEqual(digest(given), digest(TOKEN));

const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/**
 * Owner by locality alone: any web page in the browser can reach localhost, so a request must come from
 * Sparkflow's own pages. Normally: a write's Origin is a configured Sparkflow origin, or there is no Origin
 * and the request isn't marked cross-site. Once a project is shared (or a token is set), an edit guest's
 * code can run on this Mac (Expo web preview on another localhost port, the simulator), so localhost
 * origins count only when they are this server itself, and a request with no fetch metadata at all
 * (a native runtime, a script) is refused, reads of the API included.
 */
function sameSiteRequest(req: NextRequest) {
  const strict = !!TOKEN || sharingActive();
  const self = `http://${req.headers.get("host") ?? ""}`;
  const allowed = (o: string) => o === self || (ORIGINS.includes(o) && !(strict && LOCAL_ORIGIN.test(o)));
  const origin = req.headers.get("origin");
  const site = req.headers.get("sec-fetch-site");
  const read = ["GET", "HEAD"].includes(req.method);
  if (!strict) {
    if (read) return true;
    if (origin) return allowed(origin) || LOCAL_ORIGIN.test(origin);
    return site !== "cross-site";
  }
  if (origin) return allowed(origin);
  // No Origin: a browser's same-origin GET or a typed-in address. A write always carries an Origin.
  if (!read) return false;
  if (!req.nextUrl.pathname.startsWith("/api/")) return site !== "cross-site";
  return site === "same-origin" || site === "none";
}

function pass(req: NextRequest, headers: Headers, set: Record<string, string>) {
  for (const [k, v] of Object.entries(set)) headers.set(k, v);
  return NextResponse.next({ request: { headers } });
}

const fail = (req: NextRequest, status: number, code?: string, guest = false) => {
  const res = NextResponse.json({ error: status === 401 ? "Sparkflow: missing or wrong token" : status === 404 ? "Not found" : "Sparkflow: not allowed", ...(code ? { code } : {}) }, { status });
  if (guest) res.headers.set("referrer-policy", "no-referrer");
  return cors(req, res);
};

/** Project routes that need the owner's Mac (Simulator, stores, GitHub CLI, Finder) or sharing: off in the cloud. */
const MAC_ONLY = /^(reveal|release|sim-capture|capture|github|share|ticket|access)(\/|$)/;

/**
 * Sparkflow in the cloud (lib/cloud/mode.ts): a session key (from a Firebase sign-in) opens only the
 * projects its person made, a daily number of runs, and nothing that needs a Mac.
 */
function cloudGate(req: NextRequest, headers: Headers, given: string | undefined) {
  const { pathname } = req.nextUrl;
  if (pathname === "/api/cloud/session" && req.method === "POST") return cors(req, pass(req, headers, { "x-sparkflow-actor": "public" }));
  if (pathname === "/api/health") return cors(req, pass(req, headers, { "x-sparkflow-actor": "public" }));
  if (!pathname.startsWith("/api/")) return fail(req, 404);
  const s = sessionOf(given);
  if (!s) return fail(req, 401, given?.startsWith("sfc_") ? "expired" : "signin");
  const as = { "x-sparkflow-actor": "owner", "x-sparkflow-uid": s.uid, "x-sparkflow-cloud": "1" };
  const runOut = () => cors(req, NextResponse.json({ error: "You've used today's agent runs in the cloud. Come back tomorrow, or install Sparkflow on your Mac.", code: "quota" }, { status: 429 }));
  if (pathname === "/api/file-icon") return cors(req, pass(req, headers, as));
  if (pathname === "/api/projects") {
    if (req.method === "POST" && !takeRun(s.uid)) return runOut();
    return cors(req, pass(req, headers, as));
  }
  const m = /^\/api\/projects\/([^/]+)(?:\/(.*))?$/.exec(pathname);
  if (!m || ownerOf(decodeURIComponent(m[1])) !== s.uid) return fail(req, 404);
  const rest = m[2] ?? "";
  if (MAC_ONLY.test(rest)) return fail(req, 404, "mac-only");
  if (rest === "prompt" && req.method === "POST" && !takeRun(s.uid)) return runOut();
  return cors(req, pass(req, headers, as));
}

export function proxy(req: NextRequest) {
  if (req.method === "OPTIONS") return cors(req, new NextResponse(null, { status: 204 }));

  const headers = new Headers(req.headers);
  for (const h of ACTOR_HEADERS) headers.delete(h);

  const header = req.headers.get("x-sparkflow-token");
  const query = req.nextUrl.searchParams.get("token");
  const given = header ?? query ?? req.cookies.get(COOKIE)?.value;
  const ticket = req.nextUrl.searchParams.get("t");
  const { pathname, search } = req.nextUrl;
  // In the cloud, nobody is the owner by being local or by a token: only sessions, each to its own projects.
  if (CLOUD) return cloudGate(req, headers, given);

  // Guests first, even from localhost, so guest mode can be tried on `next dev`.
  if (given?.startsWith("sfg_") || (!given && ticket?.startsWith("t1."))) {
    // A key in a URL or cookie would leak through logs and referrers: header only.
    if (given && given !== header) return fail(req, 401, "key", true);
    const g = guestAccess({ key: given ?? undefined, ticket: given ? undefined : (ticket ?? undefined), method: req.method, pathname, search });
    if (!g.ok) return fail(req, g.status, g.code, true);
    const res = pass(req, headers, { "x-sparkflow-actor": "guest", "x-sparkflow-uid": g.uid, "x-sparkflow-project": g.projectId, "x-sparkflow-role": g.role });
    res.headers.set("referrer-policy", "no-referrer");
    return cors(req, res);
  }

  // Joining and signing back in: the routes check the invite or the identity proof themselves.
  if (!given && req.method === "POST" && PUBLIC.test(pathname)) return cors(req, pass(req, headers, { "x-sparkflow-actor": "public" }));

  if (isToken(given)) {
    // A page opened from the static site with ?token=: keep it in a cookie for the IDE's own requests
    // (event stream, screenshots), and drop it from the address bar.
    if (query && req.method === "GET" && !pathname.startsWith("/api/")) {
      const clean = req.nextUrl.clone();
      clean.searchParams.delete("token");
      const res = NextResponse.redirect(clean);
      res.cookies.set(COOKIE, TOKEN!, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
      return res;
    }
    return cors(req, pass(req, headers, { "x-sparkflow-actor": "owner" }));
  }

  // Plain `npm run dev` (no token) keeps working as before, but with the same cross-site write check.
  if (!TOKEN || local(req)) {
    if (!sameSiteRequest(req)) return fail(req, 403, "origin");
    return cors(req, pass(req, headers, { "x-sparkflow-actor": "owner" }));
  }
  return fail(req, 401);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

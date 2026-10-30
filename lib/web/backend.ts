"use client";

/**
 * Where the landing finds the Sparkflow server. Served by `next start` on your computer, the API
 * is on the same origin and nothing is stored. Served statically (Firebase Hosting), the landing
 * talks to the server on your computer through a tunnel: `npm run remote` opens the site with
 * `?backend=<tunnel>&token=<secret>`, saved here so the next visits stay connected.
 */
import { activeShare, activeShareBackend, guestSrc } from "./share";

export type Backend = { url: string; token: string };

const KEY = "sparkflow.backend";
export const BACKEND_EVENT = "sparkflow:backend";
/** Set when building the static site: there is no API on its own origin. */
export const STATIC_SITE = process.env.NEXT_PUBLIC_STATIC === "1";

function read(): Backend | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Backend) : null;
  } catch {
    return null;
  }
}

/** Takes `?backend=&token=` from the address bar once, then removes them from it. */
function fromUrl(): Backend | null {
  if (typeof location === "undefined") return null;
  const q = new URLSearchParams(location.search);
  const url = q.get("backend");
  const token = q.get("token");
  if (!url || !token) return null;
  q.delete("backend");
  q.delete("token");
  history.replaceState(null, "", location.pathname + (q.size ? `?${q}` : "") + location.hash);
  return { url: url.replace(/\/+$/, ""), token };
}

export function getBackend(): Backend | null {
  const linked = fromUrl();
  if (linked) setBackend(linked);
  // A shared project (/s/...) talks to its owner's server only, never saved as your own computer.
  if (!linked && activeShare()) return activeShareBackend();
  const b = linked ?? read();
  // Same computer: straight to `sparkflow` instead of a round trip through Cloudflare.
  return b && direct ? { ...b, url: LOCAL_URL } : b;
}

/** Where `sparkflow` serves on this computer (see remote.mjs). */
export const LOCAL_URL = "http://localhost:3002";
let direct = false;

/** True when the server calls go straight to `sparkflow` on this computer, not through the tunnel. */
export const isDirect = () => direct && !activeShare();

/**
 * On the hosted site, opened in a browser on the computer that runs `sparkflow`: reach it at
 * localhost (no bandwidth limit, less latency) rather than through the tunnel, which stays the
 * way in from any other device. /api/connect only answers on that computer and hands out the
 * tunnel link, so the saved link also follows a restarted `sparkflow`. The address bar doesn't change.
 */
export const backendReady: Promise<void> =
  STATIC_SITE && typeof window !== "undefined"
    ? fetch(`${LOCAL_URL}/api/connect`, { cache: "no-store", signal: AbortSignal.timeout(1500) })
        .then((r) => (r.ok ? (r.json() as Promise<Partial<Backend>>) : null))
        .then((link) => {
          if (!link?.url || !link.token) return;
          if (read()?.url !== link.url || read()?.token !== link.token) setBackend({ url: link.url.replace(/\/+$/, ""), token: link.token });
          direct = true;
          dispatchEvent(new CustomEvent(BACKEND_EVENT));
        })
        .catch(() => {})
    : Promise.resolve();

export function setBackend(b: Backend | null) {
  try {
    if (b) localStorage.setItem(KEY, JSON.stringify(b));
    else localStorage.removeItem(KEY);
  } catch {}
  dispatchEvent(new CustomEvent(BACKEND_EVENT));
}

/** URL the browser loads directly (links, images, downloads): the token rides in the query. */
export function backendUrl(path: string) {
  // A guest key never goes in a URL: shared pages load with a short-lived ticket instead.
  if (activeShare()) return guestSrc(path);
  const b = getBackend();
  if (!b) return path;
  return `${b.url}${path}${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(b.token)}`;
}

/** fetch() against the server: same origin, or the tunnel with the token in a header. */
export function apiFetch(path: string, init: RequestInit = {}) {
  const b = getBackend();
  if (!b) {
    if (STATIC_SITE) return Promise.reject(new Error("Connect your computer first."));
    return fetch(path, init);
  }
  const headers = new Headers(init.headers);
  headers.set("x-sparkflow-token", b.token);
  return fetch(b.url + path, { ...init, headers, ...(activeShare() ? { credentials: "omit" as const } : {}) });
}

/**
 * Link to an app's IDE. The static site has its own IDE page (talking to your computer), so the
 * address stays on the hosted site; a page served elsewhere links to the server that has it.
 */
export function appHref(path: string) {
  return STATIC_SITE ? path : backendUrl(path);
}

/** Opens an app's IDE right after creating or importing it. */
export function openOnBackend(path: string, push: (href: string) => void) {
  if (STATIC_SITE) location.href = path;
  else if (getBackend()) location.href = backendUrl(path);
  else push(path);
}

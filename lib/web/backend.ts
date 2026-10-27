"use client";

/**
 * Where the landing finds the Sparkflow server. Served by `next start` on your computer, the API
 * is on the same origin and nothing is stored. Served statically (Firebase Hosting), the landing
 * talks to the server on your computer through a tunnel: `npm run remote` opens the site with
 * `?backend=<tunnel>&token=<secret>`, saved here so the next visits stay connected.
 */
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
  return linked ?? read();
}

export function setBackend(b: Backend | null) {
  try {
    if (b) localStorage.setItem(KEY, JSON.stringify(b));
    else localStorage.removeItem(KEY);
  } catch {}
  dispatchEvent(new CustomEvent(BACKEND_EVENT));
}

/** URL the browser loads directly (links, images, downloads): the token rides in the query. */
export function backendUrl(path: string) {
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
  return fetch(b.url + path, { ...init, headers });
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

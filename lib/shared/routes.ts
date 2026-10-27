const CODE_EXT = /\.(tsx|ts|jsx|js)$/;

/** "app/(tabs)/index.tsx" or "(tabs)/index" → "/(tabs)/index". */
export function normalizeRoute(r: string) {
  let s = r.trim().replace(/^\.?\//, "").replace(/^app\//, "").replace(CODE_EXT, "");
  s = "/" + s.replace(/^\/+/, "");
  return s.length > 1 ? s.replace(/\/+$/, "") : s;
}

export const fileToRoute = (file: string) => normalizeRoute(file);

/** Real URL path: groups dropped, trailing index dropped. */
export function routeToPath(route: string) {
  const parts = normalizeRoute(route)
    .split("/")
    .filter((p) => p && !/^\(.*\)$/.test(p));
  if (parts.at(-1) === "index") parts.pop();
  return "/" + parts.join("/");
}

export const isDynamicRoute = (route: string) => /\[[^\]]+\]/.test(route);

export const previewPathFor = (route: string) => routeToPath(route).replace(/\[\.\.\.[^\]]+\]|\[[^\]]+\]/g, "1");

function escape(s: string) {
  return s.replace(/[.*+?^${}()|\\]/g, "\\$&");
}

export function routePattern(route: string) {
  const segs = routeToPath(route)
    .split("/")
    .filter(Boolean)
    .map((p) => (/^\[\.\.\./.test(p) ? "(?:.+)" : /^\[.+\]$/.test(p) ? "[^/]+" : escape(p)));
  return new RegExp("^/" + segs.join("/") + "/?$");
}

/** Planned route for a URL path. Static routes beat dynamic ones. */
export function matchRoute(path: string, routes: string[]) {
  const clean = path.split(/[?#]/)[0] || "/";
  const sorted = [...routes].sort((a, b) => Number(isDynamicRoute(a)) - Number(isDynamicRoute(b)));
  return sorted.find((r) => routePattern(r).test(clean));
}

export function isScreenFile(file: string) {
  if (!file.startsWith("app/") || !CODE_EXT.test(file)) return false;
  const base = file.split("/").pop()!;
  return !base.startsWith("_") && !base.startsWith("+");
}

/** "/(tabs)/home" → "tabs-home", "/" → "index". */
export function routeSlug(route: string) {
  const s = normalizeRoute(route)
    .replace(/[()[\]]/g, "")
    .split("/")
    .filter(Boolean)
    .join("-")
    .replace(/[^a-zA-Z0-9-]/g, "-");
  return s || "index";
}

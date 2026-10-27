import { matchRoute, normalizeRoute, routeToPath, type NavEdge } from "../shared";

const PATTERNS = [
  /href=\{?\s*["'`]([^"'`]+)["'`]/g,
  /router\.(?:push|replace|navigate|dismissTo)\(\s*["'`]([^"'`]+)["'`]/g,
  /pathname:\s*["'`]([^"'`]+)["'`]/g,
  /<Redirect[^>]*href=\{?\s*["'`]([^"'`]+)["'`]/g,
];

export function extractTargets(source: string) {
  const out = new Set<string>();
  for (const re of PATTERNS) {
    for (const m of source.matchAll(re)) {
      const t = m[1].replace(/\$\{[^}]*\}/g, "x");
      if (t.startsWith("/") || t.startsWith(".")) out.add(t);
    }
  }
  return [...out];
}

/** Code edges between planned routes, from the screens' sources. */
export function edgesFromSources(sources: { route: string; source: string }[], routes: string[]): NavEdge[] {
  const edges: NavEdge[] = [];
  for (const { route, source } of sources) {
    for (const t of extractTargets(source)) {
      const literal = normalizeRoute(t);
      const to =
        routes.find((r) => r === literal) ??
        routes.find((r) => routeToPath(r) === routeToPath(literal)) ??
        matchRoute(t.replace(/\[[^\]]+\]/g, "x"), routes);
      if (to && to !== route) edges.push({ from: route, to, source: "code" });
    }
  }
  return edges;
}

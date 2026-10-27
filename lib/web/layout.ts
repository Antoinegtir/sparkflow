import type { NavEdge } from "../shared";

export const PHONE_W = 200;
export const PHONE_H = Math.round((200 * 844) / 390);
export const NODE_W = PHONE_W + 40;
export const NODE_H = PHONE_H + 80;
const GAP_X = 70;
const GAP_Y = 120;

/**
 * Rows by link depth: row 0 holds the first page, (group) pages and pages nothing links to;
 * then BFS over the edges. Children sit under the average x of their parents.
 */
export function layoutScreens(order: string[], edges: NavEdge[]) {
  const rank = new Map<string, number>();
  const incoming = new Map<string, string[]>();
  for (const e of edges) if (order.includes(e.from) && order.includes(e.to)) incoming.set(e.to, [...(incoming.get(e.to) ?? []), e.from]);
  for (const [i, r] of order.entries()) if (i === 0 || r.includes("/(") || !incoming.has(r)) rank.set(r, 0);
  for (let changed = true, guard = 0; changed && guard < 50; guard++) {
    changed = false;
    for (const e of edges) {
      if (!rank.has(e.from) || !order.includes(e.to)) continue;
      const next = rank.get(e.from)! + 1;
      if (!rank.has(e.to) && next < 8) {
        rank.set(e.to, next);
        changed = true;
      }
    }
  }
  const maxRank = Math.max(0, ...rank.values());
  for (const r of order) if (!rank.has(r)) rank.set(r, edges.length ? maxRank + 1 : 0);

  const rows = new Map<number, string[]>();
  for (const r of order) rows.set(rank.get(r)!, [...(rows.get(rank.get(r)!) ?? []), r]);
  const pos = new Map<string, { x: number; y: number }>();
  for (const k of [...rows.keys()].sort((a, b) => a - b)) {
    const row = rows.get(k)!;
    const want = row.map((r, i) => {
      const parents = (incoming.get(r) ?? []).map((p) => pos.get(p)).filter(Boolean) as { x: number }[];
      const centered = (i - (row.length - 1) / 2) * (NODE_W + GAP_X);
      return { r, x: parents.length ? parents.reduce((a, p) => a + p.x, 0) / parents.length : centered };
    });
    want.sort((a, b) => a.x - b.x);
    let minX = -Infinity;
    for (const w of want) {
      const x = Math.max(w.x, minX);
      pos.set(w.r, { x, y: k * (NODE_H + GAP_Y) });
      minX = x + NODE_W + GAP_X;
    }
  }
  return pos;
}

/** Handle sides for an edge: vertical when rows differ, else horizontal. */
export function edgeSides(a: { x: number; y: number }, b: { x: number; y: number }) {
  if (Math.abs(b.y - a.y) > NODE_H / 2) return b.y > a.y ? (["bottom", "top"] as const) : (["top", "bottom"] as const);
  return b.x > a.x ? (["right", "left"] as const) : (["left", "right"] as const);
}

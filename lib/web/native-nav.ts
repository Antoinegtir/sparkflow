import { readFile } from "node:fs/promises";
import path from "node:path";
import { walk } from "../sandbox/local";

export type SubPage = { title: string; parent: string; file: string };

const SKIP = new Set(["node_modules", "ios", "android", ".expo", ".git", "dist", "build"]);
const SCREEN = /<(\w+)\.Screen\b[^>]*?\bname=["'{]+([^"'}]+)["'}]+[^>]*?\bcomponent=\{(\w+)\}/g;

/** Top-level function/const blocks of a file, by name. */
function blocks(source: string) {
  const out: { name: string; body: string }[] = [];
  const re = /^(?:export\s+)?(?:default\s+)?(?:function\s+(\w+)|const\s+(\w+)\s*=)/gm;
  const starts = [...source.matchAll(re)].map((m) => ({ name: m[1] ?? m[2], at: m.index! }));
  starts.forEach((s, i) => out.push({ name: s.name, body: source.slice(s.at, starts[i + 1]?.at ?? source.length) }));
  return out;
}

/**
 * Pages pushed inside each tab: a stack component used as a tab lists its screens; the first one is the tab's
 * root, the others are sub-pages of that tab.
 */
export async function findSubPages(projectDir: string, tabs: string[]): Promise<SubPage[]> {
  const files = (await walk(projectDir, "", SKIP, 2000)).filter((f) => /\.(tsx|jsx|ts|js)$/.test(f)).slice(0, 400);
  const decls: { file: string; block: string; screens: { name: string; component: string }[] }[] = [];
  for (const f of files) {
    const src = await readFile(path.join(projectDir, f), "utf8").catch(() => "");
    if (!src.includes(".Screen")) continue;
    for (const b of blocks(src)) {
      const screens = [...b.body.matchAll(SCREEN)].map((m) => ({ name: m[2], component: m[3] }));
      if (screens.length) decls.push({ file: f, block: b.name, screens });
    }
  }
  const lower = tabs.map((t) => t.toLowerCase());
  const tabOf = new Map<string, string>();
  for (const d of decls) {
    for (const s of d.screens) {
      const i = lower.indexOf(s.name.toLowerCase());
      if (i >= 0) tabOf.set(s.component, tabs[i]);
    }
  }
  const out: SubPage[] = [];
  for (const d of decls) {
    const tab = tabOf.get(d.block);
    if (!tab) continue;
    for (const s of d.screens.slice(1)) out.push({ title: s.name, parent: tab, file: d.file });
  }
  return out;
}

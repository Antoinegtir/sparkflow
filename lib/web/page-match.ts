import { accessibilityInfo } from "./idb";
import { flatten } from "./native-tabs";

/**
 * The page the device shows, told by its content rather than its tab bar: the testIDs on screen against
 * the testIDs each page's file declares. A tab's label can be in another language than the page's name
 * ("Dossiers" for Folders) and iOS 26's tab bar marks every visited tab as selected; the content can't lie.
 */

const ID = /\b(?:testID|nativeID)=\{?\s*(["'`])((?:(?!\1).)*)\1/g;

/** A file's testIDs. A template (`note-${id}`) keeps its literal start, matched as a prefix. */
export function idsIn(src: string): { exact: Set<string>; prefixes: string[] } {
  const exact = new Set<string>();
  const prefixes: string[] = [];
  for (const m of src.matchAll(ID)) {
    const v = m[2];
    const cut = v.indexOf("${");
    if (cut < 0) exact.add(v);
    else if (cut >= 3) prefixes.push(v.slice(0, cut));
  }
  return { exact, prefixes };
}

/** testIDs of the elements on screen (iOS accessibilityIdentifier, Android resource-id). */
export async function visibleIds(udid: string): Promise<string[]> {
  const all = flatten(await accessibilityInfo(udid));
  return [...new Set(all.filter((e) => e.AXUniqueId && e.frame && e.frame.width > 0 && e.frame.height > 0).map((e) => e.AXUniqueId!))];
}

/**
 * The route whose file matches the most visible testIDs, each weighed by how few pages declare it (an id
 * shared by several pages says little). Null when nothing matches or two pages tie.
 */
export function bestRoute(visible: string[], pages: { route: string; ids: ReturnType<typeof idsIn> }[]): string | null {
  const has = (p: (typeof pages)[number], id: string) => p.ids.exact.has(id) || p.ids.prefixes.some((x) => id.startsWith(x));
  const score = new Map<string, number>();
  for (const id of visible) {
    const owners = pages.filter((p) => has(p, id));
    for (const p of owners) score.set(p.route, (score.get(p.route) ?? 0) + 1 / owners.length);
  }
  const ranked = [...score].sort((a, b) => b[1] - a[1]);
  if (!ranked.length || (ranked[1] && ranked[1][1] === ranked[0][1])) return null;
  return ranked[0][0];
}

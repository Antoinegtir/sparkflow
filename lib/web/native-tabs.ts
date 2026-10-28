import { accessibilityInfo, sendHid, touch, delay, type AxElement } from "./idb";
import { screenPoints } from "./idb";
import * as android from "./android";

export type Tab = { label: string; x: number; y: number; selected: boolean; index?: number };

const flatten = (els: AxElement[]): AxElement[] => els.flatMap((e) => [e, ...flatten(e.children ?? [])]);
const traits = (e: AxElement) => (e.traits ?? []).concat(e.role_description ? [e.role_description] : []);
const isSelected = (e: AxElement) => traits(e).some((t) => /selected/i.test(t)) || e.AXValue === 1 || e.AXValue === "1";
const center = (e: AxElement) => ({ x: (e.frame?.x ?? 0) + (e.frame?.width ?? 0) / 2, y: (e.frame?.y ?? 0) + (e.frame?.height ?? 0) / 2 });

/**
 * The tab last tapped on each device (by Sparkflow or by the user through the live view). iOS 26's tab bar
 * reports every tab visited so far as "Selected", so the accessibility tree alone can't say which one shows.
 */
const g = globalThis as unknown as { __sparkflowLastTab?: Map<string, string>; __sparkflowTabs?: Map<string, Tab[]> };
const lastTab = (g.__sparkflowLastTab ??= new Map());
const knownTabs = (g.__sparkflowTabs ??= new Map());

/** A tap at (x, y) in points: if it lands on a tab of the last read bar, that tab now shows. */
export function noteTap(udid: string, x: number, y: number) {
  const tabs = knownTabs.get(udid);
  if (!tabs?.length || Math.abs(y - tabs[0].y) > 30) return;
  const near = [...tabs].sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0];
  lastTab.set(udid, near.label);
}

/** The tab that shows: the only one marked selected, else the last one tapped among those marked. */
function shownTab(udid: string, tabs: Tab[]) {
  const sel = tabs.filter((t) => t.selected);
  if (sel.length === 1) return sel[0];
  const last = lastTab.get(udid);
  return sel.find((t) => t.label === last) ?? tabs.find((t) => t.label === last) ?? sel[0];
}

/** Tabs of the app on screen. UITabBar items are not in the full tree on iPhone, so probe points along the bar. */
export async function readTabs(udid: string): Promise<Tab[]> {
  const tabs = await readTabsRaw(udid);
  if (tabs.length) knownTabs.set(udid, tabs);
  return tabs;
}

async function readTabsRaw(udid: string): Promise<Tab[]> {
  if (android.isAndroidId(udid)) return android.bottomTabs(await accessibilityInfo(udid), (await screenPoints(udid))?.height ?? 800);
  const all = flatten(await accessibilityInfo(udid));
  // iPad: the top tab bar exposes TabButton elements directly.
  const buttons = all.filter((e) => traits(e).some((t) => /TabButton/i.test(t)) && e.AXLabel);
  if (buttons.length) return buttons.map((e) => ({ label: e.AXLabel!, ...center(e), selected: isSelected(e) }));
  // JS tab bars (expo-router, React Navigation): buttons labelled "Title, tab, 2 of 4".
  const js = all.flatMap((e) => {
    const m = /^(.+), tab, (\d+) of (\d+)$/.exec(e.AXLabel?.trim() ?? "");
    return m && e.frame ? [{ label: m[1], index: Number(m[2]), ...center(e), selected: isSelected(e) }] : [];
  });
  if (js.length) return js;
  const bar = all.find((e) => /tab bar/i.test(e.AXLabel ?? "") || /TabBar/i.test(e.type ?? ""));
  if (!bar?.frame) return [];
  const pts = await screenPoints(udid);
  const width = pts?.width ?? bar.frame.x + bar.frame.width;
  const y = bar.frame.y + Math.min(bar.frame.height / 2, 30);
  const tabs: Tab[] = [];
  const seen = new Set<string>();
  for (let x = bar.frame.x + 12; x < width - 6; x += 24) {
    const [el] = await accessibilityInfo(udid, { x, y }).catch(() => []);
    const label = el?.AXLabel?.trim();
    // Probes that land between items return the bar itself.
    if (!label || seen.has(label) || el.type === "Application" || /tab bar/i.test(label)) continue;
    seen.add(label);
    tabs.push({ label, ...center(el), selected: isSelected(el) });
  }
  return tabs;
}

export async function tapAt(udid: string, x: number, y: number) {
  if (android.isAndroidId(udid)) return android.tap(udid, x, y);
  await sendHid(udid, [touch(x, y, "DOWN"), delay(0.08), touch(x, y, "UP")]);
}

/** Title of a pushed screen: the first heading near the top when a back button is visible. */
export async function pushedTitle(udid: string) {
  const all = flatten(await accessibilityInfo(udid));
  if (!all.some((e) => traits(e).some((t) => /BackButton/i.test(t)))) return null;
  const h = all.find((e) => traits(e).some((t) => /Heading|Header/i.test(t)) && (e.frame?.y ?? 999) < 160 && e.AXLabel);
  return h?.AXLabel ?? null;
}

export async function currentPage(udid: string): Promise<{ title: string; parent?: string; tab?: number } | null> {
  const pushed = await pushedTitle(udid);
  const tabs = await readTabs(udid);
  const sel = shownTab(udid, tabs);
  const tab = sel?.label;
  if (pushed && pushed !== tab) return { title: pushed, ...(tab ? { parent: tab } : {}) };
  // The tab's position too: its label can differ from the page name ("Profil" for Profile).
  return tab ? { title: tab, ...(sel?.index ? { tab: sel.index } : {}) } : null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const wordMatch = (label: string, title: string) => new RegExp(`\\b${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(label);

/**
 * Selects a tab. Re-tapping the selected tab pops a pushed screen. The minimized iOS 26 tab bar shows a single
 * tab: tap it to expand, then retry once (never tap another tab to expand it).
 */
export async function goToTab(udid: string, title: string) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const tabs = await readTabs(udid);
    const t = tabs.find((x) => x.label.toLowerCase() === title.toLowerCase()) ?? tabs.find((x) => wordMatch(x.label, title));
    if (t) {
      // Tap unless it surely shows already (several tabs marked selected means it can't be told).
      const sure = shownTab(udid, tabs) === t && tabs.filter((x) => x.selected).length === 1;
      if (!sure || (await pushedTitle(udid))) await tapAt(udid, t.x, t.y);
      lastTab.set(udid, t.label);
      return true;
    }
    if (tabs.length === 1 && attempt === 0) {
      await tapAt(udid, tabs[0].x, tabs[0].y);
      await sleep(450);
      continue;
    }
    return false;
  }
  return false;
}

export async function openSubPage(udid: string, parent: string, title: string) {
  const cur = await currentPage(udid);
  if (cur?.title === title && cur.parent === parent) return true;
  if (!(await goToTab(udid, parent))) return false;
  await sleep(600);
  const all = flatten(await accessibilityInfo(udid));
  const target = all.find((e) => e.AXLabel && wordMatch(e.AXLabel, title) && !traits(e).some((t) => /Heading|Header/i.test(t)) && e.frame);
  if (!target) return false;
  const c = center(target);
  await tapAt(udid, c.x, c.y);
  return true;
}

export { flatten, center, wordMatch };

import { accessibilityInfo } from "./idb";
import { flatten, center, readTabs, tapAt, pushedTitle, wordMatch } from "./native-tabs";
import type { SubPage } from "./native-nav";
import { frame, liveCapable } from "./simulator";

export type CapturedPage = { title: string; parent?: string; file?: string; png: Buffer };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Taps through every tab (and the sub-pages found in the code) and screenshots each page. */
export async function captureTabPages(udid: string, subPages: SubPage[]): Promise<CapturedPage[]> {
  if (!liveCapable(udid)) throw new Error("Capturing pages needs idb (idb_companion).");
  const tabs = await readTabs(udid);
  if (!tabs.length) return [{ title: "Home", png: await frame(udid, "png") }];
  const pages: CapturedPage[] = [];
  for (const tab of tabs) {
    await tapAt(udid, tab.x, tab.y);
    await sleep(900);
    if (await pushedTitle(udid)) {
      await tapAt(udid, tab.x, tab.y);
      await sleep(700);
    }
    // Tab animation and remote images.
    await sleep(1600);
    pages.push({ title: tab.label, png: await frame(udid, "png") });
    for (const sub of subPages.filter((s) => s.parent.toLowerCase() === tab.label.toLowerCase())) {
      const all = flatten(await accessibilityInfo(udid));
      const el = all.find((e) => e.AXLabel && e.frame && wordMatch(e.AXLabel, sub.title) && e.AXLabel !== tab.label);
      if (!el) continue;
      const c = center(el);
      await tapAt(udid, c.x, c.y);
      await sleep(1500);
      pages.push({ title: sub.title, parent: tab.label, file: sub.file, png: await frame(udid, "png") });
      await tapAt(udid, tab.x, tab.y);
      await sleep(900);
    }
  }
  await tapAt(udid, tabs[0].x, tabs[0].y);
  return pages;
}

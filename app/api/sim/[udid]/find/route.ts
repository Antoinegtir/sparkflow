import { accessibilityInfo, type AxElement } from "@/lib/web/idb";
import { assertUdid } from "@/lib/web/simulator";
import { handle, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

const flatten = (els: AxElement[]): AxElement[] => els.flatMap((e) => [e, ...flatten(e.children ?? [])]);

/**
 * Boxes of the elements that make up a piece of the app: those whose testID (`id`) or label (`text`)
 * matches, and their union. Short texts match exactly so "Pro" does not hit "Profile". `whole=1`:
 * the whole screen (a page's root element).
 */
export const GET = handle(async (req: Request, { params }: RouteCtx<{ udid: string }>) => {
  const q = new URL(req.url).searchParams;
  const ids = new Set(q.getAll("id").filter(Boolean));
  const texts = q.getAll("text").map((t) => t.trim().toLowerCase()).filter(Boolean);
  const all = flatten(await accessibilityInfo(assertUdid((await params).udid)));
  if (q.get("whole") === "1") {
    // The largest element on screen is the app's window.
    const screen = all.filter((e) => e.frame && e.frame.width < 1000).sort((a, b) => b.frame!.width * b.frame!.height - a.frame!.width * a.frame!.height)[0]?.frame;
    return Response.json(screen ? { union: screen, frames: [screen], count: 1 } : null);
  }
  const frames = all
    .filter((e) => {
      if (!e.frame || e.frame.width >= 1000) return false;
      // A kit component's parts carry ids derived from its own (profile-scheme → profile-scheme-light);
      // "trips-card-*" stands for every id built from that start (trips-card-t1, trips-card-t2…).
      const uid = e.AXUniqueId;
      if (uid && [...ids].some((id) => (id.endsWith("*") ? uid.startsWith(id.slice(0, -1)) : uid === id || uid.startsWith(`${id}-`)))) return true;
      const l = (e.AXLabel ?? "").toLowerCase().trim();
      return !!l && texts.some((t) => l === t || (t.length >= 5 && l.includes(t)));
    })
    .map((e) => e.frame!);
  if (!frames.length) return Response.json(null);
  const x = Math.min(...frames.map((f) => f.x));
  const y = Math.min(...frames.map((f) => f.y));
  const union = { x, y, width: Math.max(...frames.map((f) => f.x + f.width)) - x, height: Math.max(...frames.map((f) => f.y + f.height)) - y };
  return Response.json({ union, frames, count: frames.length });
});

import { accessibilityInfo } from "@/lib/web/idb";
import { flatten } from "@/lib/web/native-tabs";
import { assertUdid } from "@/lib/web/simulator";
import { handle, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

/** Boxes of elements whose label matches. Short texts match exactly so "Pro" does not hit "Profile". */
export const GET = handle(async (req: Request, { params }: RouteCtx<{ udid: string }>) => {
  const texts = new URL(req.url).searchParams.getAll("text").map((t) => t.trim().toLowerCase()).filter(Boolean);
  const all = flatten(await accessibilityInfo(assertUdid((await params).udid)));
  const frames = all
    .filter((e) => {
      const l = (e.AXLabel ?? "").toLowerCase().trim();
      if (!l || !e.frame || e.frame.width >= 1000) return false;
      return texts.some((t) => l === t || (t.length >= 5 && l.includes(t)));
    })
    .map((e) => e.frame!);
  if (!frames.length) return Response.json(null);
  const x = Math.min(...frames.map((f) => f.x));
  const y = Math.min(...frames.map((f) => f.y));
  const union = { x, y, width: Math.max(...frames.map((f) => f.x + f.width)) - x, height: Math.max(...frames.map((f) => f.y + f.height)) - y };
  return Response.json({ union, frames, count: frames.length });
});

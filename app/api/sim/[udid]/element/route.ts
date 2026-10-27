import { accessibilityInfo } from "@/lib/web/idb";
import { assertUdid } from "@/lib/web/simulator";
import { handle, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request, { params }: RouteCtx<{ udid: string }>) => {
  const u = new URL(req.url);
  const x = Number(u.searchParams.get("x"));
  const y = Number(u.searchParams.get("y"));
  const [el] = await accessibilityInfo(assertUdid((await params).udid), { x, y }).catch(() => []);
  if (!el?.frame) return Response.json(null);
  return Response.json({ type: el.type ?? "Element", label: el.AXLabel ?? null, id: el.AXUniqueId ?? null, value: el.AXValue ?? null, frame: el.frame });
});

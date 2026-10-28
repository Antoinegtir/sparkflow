import { z } from "zod";
import { gesture } from "@/lib/web/gestures";
import { noteTap } from "@/lib/web/native-tabs";
import { assertUdid, liveCapable } from "@/lib/web/simulator";
import { handle, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request, { params }: RouteCtx<{ udid: string }>) => {
  const udid = assertUdid((await params).udid);
  if (!liveCapable(udid)) return Response.json({ error: "Live gestures need idb" }, { status: 501 });
  const b = z.object({ id: z.string().max(64), phase: z.enum(["down", "move", "up"]), x: z.number(), y: z.number() }).parse(await req.json());
  await gesture(udid, b.phase, b.x, b.y, b.id);
  if (b.phase === "up") noteTap(udid, b.x, b.y);
  return Response.json({ ok: true });
});

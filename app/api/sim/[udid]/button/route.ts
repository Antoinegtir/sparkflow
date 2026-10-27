import { z } from "zod";
import { button, delay, idbAvailable, sendHid } from "@/lib/web/idb";
import { assertUdid } from "@/lib/web/simulator";
import { handle, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

/** Hardware keys: volume up/down and the side button (lock/wake; held = Siri). */
export const POST = handle(async (req: Request, { params }: RouteCtx<{ udid: string }>) => {
  if (!idbAvailable()) return Response.json({ error: "Hardware buttons need idb" }, { status: 501 });
  const b = z.object({ button: z.enum(["VOLUME_UP", "VOLUME_DOWN", "SIDE_BUTTON"]), hold: z.number().min(0).max(5).optional() }).parse(await req.json());
  await sendHid(assertUdid((await params).udid), [button(b.button, "DOWN"), delay(Math.max(0.05, b.hold ?? 0.1)), button(b.button, "UP")]);
  return Response.json({ ok: true });
});

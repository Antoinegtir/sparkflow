import { assertUdid, frame } from "@/lib/web/simulator";
import { handle, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, { params }: RouteCtx<{ udid: string }>) => {
  const jpg = await frame(assertUdid((await params).udid), "jpeg");
  return new Response(new Uint8Array(jpg), { headers: { "content-type": "image/jpeg", "cache-control": "no-store" } });
});

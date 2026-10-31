import sharp from "sharp";
import { requireOwner } from "@/lib/share/actor";
import { handle, orchestrator, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

/**
 * A page captured on the Simulator of the owner's Mac while the app runs in the cloud (?route=&scheme=,
 * the image as the body): kept as the "simulator" device's shot, like the Mac's own captures.
 */
export const POST = handle(async (req: Request, { params }: RouteCtx) => {
  requireOwner(req);
  const { id } = await params;
  const url = new URL(req.url);
  const route = url.searchParams.get("route") ?? "";
  const dark = url.searchParams.get("scheme") === "dark";
  const png = await sharp(Buffer.from(await req.arrayBuffer())).png().toBuffer();
  await orchestrator().recordDeviceShots(id, "simulator", dark, [{ route, png }]);
  return Response.json({ ok: true });
});

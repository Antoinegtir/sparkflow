import { handle, orchestrator, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, { params }: RouteCtx<{ id: string; file: string }>) => {
  const { id, file } = await params;
  const png = await orchestrator().store.readShot(id, file).catch(() => {
    throw new Error("Screenshot not found");
  });
  return new Response(new Uint8Array(png), { headers: { "content-type": "image/png", "cache-control": "public, max-age=31536000, immutable" } });
});

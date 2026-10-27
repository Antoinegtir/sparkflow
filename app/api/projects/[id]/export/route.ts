import { handle, orchestrator, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, { params }: RouteCtx) => {
  const { name, bytes } = await orchestrator().exportProject((await params).id);
  return new Response(new Uint8Array(bytes), {
    headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="${name}"` },
  });
});

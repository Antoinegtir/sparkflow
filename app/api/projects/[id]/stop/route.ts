import { handle, orchestrator, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

export const POST = handle(async (_req: Request, { params }: RouteCtx) => {
  await orchestrator().stop((await params).id);
  return Response.json({ ok: true });
});

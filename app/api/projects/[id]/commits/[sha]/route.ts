import { handle, orchestrator, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, { params }: RouteCtx<{ id: string; sha: string }>) => {
  const { id, sha } = await params;
  return Response.json(await orchestrator().commitDiff(id, sha));
});

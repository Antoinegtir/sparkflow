import { handle, orchestrator, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

/** Opens the project's folder in Finder. */
export const POST = handle(async (_req: Request, { params }: RouteCtx) => {
  await orchestrator().revealProject((await params).id);
  return Response.json({ ok: true });
});

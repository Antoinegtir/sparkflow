import { handle, orchestrator, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request, { params }: RouteCtx) => {
  const testId = new URL(req.url).searchParams.get("testId") ?? "";
  return Response.json(await orchestrator().resolve((await params).id, testId));
});

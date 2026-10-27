import { z } from "zod";
import { handle, orchestrator, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request, { params }: RouteCtx) => {
  const { route, version } = z.object({ route: z.string(), version: z.number().int().positive() }).parse(await req.json());
  await orchestrator().restoreVersion((await params).id, route, version);
  return Response.json({ ok: true });
});

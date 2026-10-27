import { z } from "zod";
import { handle, orchestrator, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request, { params }: RouteCtx) => {
  const { route } = z.object({ route: z.string() }).parse(await req.json());
  await orchestrator().undo((await params).id, route);
  return Response.json({ ok: true });
});

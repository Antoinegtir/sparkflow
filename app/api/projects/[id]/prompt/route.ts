import { PromptRequest } from "@/lib/shared";
import { handle, orchestrator, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request, { params }: RouteCtx) => {
  const body = PromptRequest.parse(await req.json());
  await orchestrator().prompt((await params).id, body);
  return Response.json({ ok: true }, { status: 202 });
});

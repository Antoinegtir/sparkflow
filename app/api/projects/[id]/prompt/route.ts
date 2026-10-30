import { PromptRequest } from "@/lib/shared";
import { requireRole } from "@/lib/share/actor";
import { handle, orchestrator, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request, { params }: RouteCtx) => {
  const actor = requireRole(req, "edit");
  const body = PromptRequest.parse(await req.json());
  const guest = actor.kind === "guest";
  // The prompt is attributed in the timeline, and a guest's run gets the restricted toolset.
  await orchestrator().prompt((await params).id, body, { by: guest ? actor.uid : "owner", guest });
  return Response.json({ ok: true }, { status: 202 });
});

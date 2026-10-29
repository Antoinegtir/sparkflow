import { z } from "zod";
import { handle, orchestrator, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, { params }: RouteCtx) => Response.json(await orchestrator().githubStatus((await params).id)));

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), name: z.string(), private: z.boolean() }),
  z.object({ action: z.literal("connect"), url: z.string() }),
  z.object({ action: z.literal("push") }),
]);

/** Create a repository (GitHub CLI) or connect one by URL, then push; or push new commits. */
export const POST = handle(async (req: Request, { params }: RouteCtx) => {
  const { id } = await params;
  const a = Action.parse(await req.json());
  const o = orchestrator();
  return Response.json(
    a.action === "push" ? await o.githubPush(id) : await o.githubConnect(id, a.action === "create" ? { create: { name: a.name, private: a.private } } : { url: a.url }),
  );
});

import { z } from "zod";
import { handle, orchestrator, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

const Req = z.object({
  op: z.enum(["hover", "complete", "definition", "details"]),
  path: z.string(),
  content: z.string().max(2_000_000),
  offset: z.number().int().min(0),
  name: z.string().optional(),
  source: z.string().optional(),
  data: z.unknown().optional(),
});

/** The code view's language features: hover, completions, completion details, go to definition. */
export const POST = handle(async (req: Request, { params }: RouteCtx) => {
  const body = Req.parse(await req.json());
  const result = await orchestrator().lang((await params).id, body.op === "details" ? { ...body, op: "details", name: body.name ?? "" } : { ...body, op: body.op });
  return Response.json({ result });
});

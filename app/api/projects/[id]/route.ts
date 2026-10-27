import { z } from "zod";
import { handle, orchestrator, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, { params }: RouteCtx) => Response.json(await orchestrator().getState((await params).id)));

export const PATCH = handle(async (req: Request, { params }: RouteCtx) => {
  const { id } = await params;
  const body = z.object({ name: z.string().trim().min(1).max(60).optional(), previewDevice: z.string().optional() }).parse(await req.json());
  if (body.name) await orchestrator().renameProject(id, body.name);
  if (body.previewDevice) await orchestrator().setPreviewDevice(id, body.previewDevice);
  return Response.json({ ok: true });
});

export const DELETE = handle(async (_req: Request, { params }: RouteCtx) => {
  await orchestrator().deleteProject((await params).id);
  return Response.json({ ok: true });
});

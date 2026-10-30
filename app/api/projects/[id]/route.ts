import { z } from "zod";
import { actorOf, redactForGuest, requireOwner, requireRole } from "@/lib/share/actor";
import { forgetProject } from "@/lib/share/store";
import { handle, orchestrator, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request, { params }: RouteCtx) => {
  const state = await orchestrator().getState((await params).id);
  // Guests never see local folders or the live preview address.
  return Response.json(actorOf(req).kind === "guest" ? redactForGuest(state) : state);
});

export const PATCH = handle(async (req: Request, { params }: RouteCtx) => {
  const { id } = await params;
  const body = z.object({ name: z.string().trim().min(1).max(60).optional(), previewDevice: z.string().optional() }).parse(await req.json());
  // Editors may switch the preview device; renaming stays with the owner.
  if (body.name) requireOwner(req);
  else requireRole(req, "edit");
  if (body.name) await orchestrator().renameProject(id, body.name);
  if (body.previewDevice) await orchestrator().setPreviewDevice(id, body.previewDevice);
  return Response.json({ ok: true });
});

export const DELETE = handle(async (req: Request, { params }: RouteCtx) => {
  requireOwner(req);
  const { id } = await params;
  await orchestrator().deleteProject(id);
  await forgetProject(id);
  return Response.json({ ok: true });
});

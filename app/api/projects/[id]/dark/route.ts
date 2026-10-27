import { handle, orchestrator, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

export const POST = handle(async (_req: Request, { params }: RouteCtx) => Response.json({ captured: await orchestrator().captureDark((await params).id) }));

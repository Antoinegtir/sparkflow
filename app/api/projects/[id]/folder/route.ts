import { handle, orchestrator, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

/** Where the project's code is on this computer, for the editor buttons. */
export const GET = handle(async (_req: Request, { params }: RouteCtx) => Response.json({ path: await orchestrator().projectFolder((await params).id) }));

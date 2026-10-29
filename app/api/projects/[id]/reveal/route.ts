import { handle, orchestrator, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

/** Opens the project's folder in Finder, or in VS Code with `?app=vscode`. */
export const POST = handle(async (req: Request, { params }: RouteCtx) => {
  await orchestrator().revealProject((await params).id, new URL(req.url).searchParams.get("app") === "vscode" ? "vscode" : "finder");
  return Response.json({ ok: true });
});

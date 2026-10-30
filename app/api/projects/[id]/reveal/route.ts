import { handle, orchestrator, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

/** Opens the project's folder in Finder, or in VS Code with `?app=vscode`; `?path=` selects (or opens) that file in it. */
export const POST = handle(async (req: Request, { params }: RouteCtx) => {
  const q = new URL(req.url).searchParams;
  await orchestrator().revealProject((await params).id, q.get("app") === "vscode" ? "vscode" : "finder", q.get("path") ?? undefined);
  return Response.json({ ok: true });
});

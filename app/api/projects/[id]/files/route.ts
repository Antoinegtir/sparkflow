import { z } from "zod";
import { handle, orchestrator, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml" };

export const GET = handle(async (req: Request, { params }: RouteCtx) => {
  const { id } = await params;
  const url = new URL(req.url);
  const p = url.searchParams.get("path");
  if (!p) return Response.json({ files: await orchestrator().listProjectFiles(id) });
  if (url.searchParams.has("raw")) {
    const bytes = await orchestrator().readProjectFileBytes(id, p);
    const ext = p.split(".").pop()?.toLowerCase() ?? "";
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": TYPES[ext] ?? "application/octet-stream",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
      },
    });
  }
  return Response.json({ path: p, content: await orchestrator().readProjectFile(id, p) });
});

export const POST = handle(async (req: Request, { params }: RouteCtx) => {
  const { id } = await params;
  const form = await req.formData();
  const dir = (form.get("dir") as string | null) || undefined;
  const added: string[] = [];
  for (const f of form.getAll("files")) {
    if (typeof f === "string") continue;
    added.push(await orchestrator().addAsset(id, f.name, Buffer.from(await f.arrayBuffer()), dir));
  }
  return Response.json({ added });
});

const Op = z.discriminatedUnion("type", [
  z.object({ type: z.literal("mkdir"), path: z.string() }),
  z.object({ type: z.literal("move"), from: z.string(), to: z.string() }),
  z.object({ type: z.literal("delete"), path: z.string() }),
]);

export const PATCH = handle(async (req: Request, { params }: RouteCtx) => {
  await orchestrator().assetOp((await params).id, Op.parse(await req.json()));
  return Response.json({ ok: true });
});

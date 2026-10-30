import { existsSync } from "node:fs";
import { z } from "zod";
import { actorOf, guardGuestPath, guestReadable, insideProject, requireRole, type Actor } from "@/lib/share/actor";
import { handle, orchestrator, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml" };

const notFound = () => Response.json({ error: "File not found" }, { status: 404 });

/** Guests read no secrets, and nothing a symlink leads out of the project. */
async function guestMayRead(id: string, rel: string) {
  if (!guestReadable(rel)) return false;
  const root = await orchestrator().projectDir(id);
  return !root || (await insideProject(root, rel));
}

export const GET = handle(async (req: Request, { params }: RouteCtx) => {
  const { id } = await params;
  const actor = actorOf(req);
  const guest = actor.kind === "guest";
  const url = new URL(req.url);
  const p = url.searchParams.get("path");
  if (!p) {
    const files = await orchestrator().listProjectFiles(id);
    return Response.json({ files: guest ? files.filter((f) => guestReadable(f)) : files });
  }
  if (guest && !(await guestMayRead(id, p))) return notFound();
  if (url.searchParams.has("diagnostics")) {
    requireRole(req, "edit");
    return Response.json({ diagnostics: await orchestrator().fileDiagnostics(id, p) });
  }
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

const forbidden = (p: string) => Response.json({ error: `${p} cannot be changed from a shared project`, code: "role" }, { status: 403 });
/** A guest write must pass the denylist and stay inside the project once symlinks are followed. */
async function guestBlocks(id: string, actor: Actor, paths: string[]) {
  if (actor.kind !== "guest") return undefined;
  const denied = paths.find((p) => !guardGuestPath(p));
  if (denied) return denied;
  // A remote sandbox has no folder on this Mac, so no symlink there can reach the owner's files.
  const root = await orchestrator().projectDir(id);
  if (!root || !existsSync(root)) return undefined;
  for (const p of paths) if (!(await insideProject(root, p))) return p;
  return undefined;
}

export const POST = handle(async (req: Request, { params }: RouteCtx) => {
  const { id } = await params;
  const actor = requireRole(req, "edit");
  const form = await req.formData();
  const dir = (form.get("dir") as string | null) || undefined;
  const uploads = form.getAll("files").filter((f): f is File => typeof f !== "string");
  const blocked = await guestBlocks(id, actor, [...(dir ? [dir] : []), ...uploads.map((f) => (dir ? `${dir.replace(/\/+$/, "")}/${f.name}` : f.name))]);
  if (blocked) return forbidden(blocked);
  const added: string[] = [];
  for (const f of uploads) added.push(await orchestrator().addAsset(id, f.name, Buffer.from(await f.arrayBuffer()), dir));
  return Response.json({ added });
});

const Op = z.discriminatedUnion("type", [
  z.object({ type: z.literal("mkdir"), path: z.string() }),
  z.object({ type: z.literal("move"), from: z.string(), to: z.string() }),
  z.object({ type: z.literal("delete"), path: z.string() }),
  z.object({ type: z.literal("write"), path: z.string(), content: z.string().max(2_000_000) }),
]);

export const PATCH = handle(async (req: Request, { params }: RouteCtx) => {
  const { id } = await params;
  const actor = requireRole(req, "edit");
  const op = Op.parse(await req.json());
  const blocked = await guestBlocks(id, actor, op.type === "move" ? [op.from, op.to] : [op.path]);
  if (blocked) return forbidden(blocked);
  if (op.type === "write") await orchestrator().writeProjectFile(id, op.path, op.content);
  else await orchestrator().assetOp(id, op);
  return Response.json({ ok: true });
});

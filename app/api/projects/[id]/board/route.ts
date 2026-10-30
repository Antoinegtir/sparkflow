import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { handle, orchestrator, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

const Point = { id: z.string().max(64), x: z.number(), y: z.number() };
const Board = z.object({
  texts: z.array(z.object({ ...Point, text: z.string().max(4000) })).max(500),
  comments: z.array(z.object({ ...Point, text: z.string().max(4000), route: z.string().max(200).optional(), ts: z.number(), sent: z.boolean().optional() })).max(500),
  groups: z.array(z.object({ ...Point, kind: z.enum(["frame", "section"]), w: z.number().positive(), h: z.number().positive(), name: z.string().max(120) })).max(200).default([]),
});

/** Frames, sections, text and comments placed on a project's canvas, in board.json beside its meta.json. */
const file = async (id: string) => {
  const store = orchestrator().store;
  await store.readMeta(id);
  return path.join(store.dir(id), "board.json");
};

export const GET = handle(async (_req: Request, { params }: RouteCtx) => {
  const text = await readFile(await file((await params).id), "utf8").catch(() => null);
  return Response.json(text ? JSON.parse(text) : { texts: [], comments: [], groups: [] });
});

export const PUT = handle(async (req: Request, { params }: RouteCtx) => {
  const board = Board.parse(await req.json());
  await writeFile(await file((await params).id), JSON.stringify(board, null, 2));
  return Response.json({ ok: true });
});

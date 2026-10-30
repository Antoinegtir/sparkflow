import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { BoardOpSchema } from "@/lib/shared/share";
import { actorOf, requireOwner, requireRole } from "@/lib/share/actor";
import { applyOps, mergePut } from "@/lib/share/board";
import { people } from "@/lib/share/store";
import { handle, orchestrator, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

const Point = { id: z.string().max(64), x: z.number(), y: z.number() };
const Board = z.object({
  texts: z.array(z.object({ ...Point, text: z.string().max(4000) })).max(500),
  comments: z
    .array(
      z.object({
        ...Point,
        text: z.string().max(4000),
        route: z.string().max(200).optional(),
        ts: z.number(),
        sent: z.boolean().optional(),
        // "owner" or a guest uid; stamped by the server, legacy comments without it are the owner's.
        by: z.string().max(128).optional(),
        editedAt: z.number().optional(),
      }),
    )
    .max(500),
  groups: z.array(z.object({ ...Point, kind: z.enum(["frame", "section"]), w: z.number().positive(), h: z.number().positive(), name: z.string().max(120) })).max(200).default([]),
  rev: z.number().int().nonnegative().optional(),
});
type BoardData = z.infer<typeof Board> & { rev: number };

/** Frames, sections, text and comments placed on a project's canvas, in board.json beside its meta.json. */
const file = async (id: string) => {
  const store = orchestrator().store;
  await store.readMeta(id);
  return path.join(store.dir(id), "board.json");
};

const read = async (f: string): Promise<BoardData> => {
  const text = await readFile(f, "utf8").catch(() => null);
  const b = text ? (JSON.parse(text) as Partial<BoardData>) : {};
  return { texts: b.texts ?? [], comments: b.comments ?? [], groups: b.groups ?? [], rev: b.rev ?? 0 };
};

// Tmp file then rename: a reader never sees half a board.
const write = async (f: string, board: BoardData) => {
  const tmp = `${f}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(board, null, 2));
  await rename(tmp, f);
};

// One writer at a time per project, so concurrent posts from several people don't lose ops.
const locks = new Map<string, Promise<unknown>>();
function exclusive<T>(id: string, job: () => Promise<T>): Promise<T> {
  const next = (locks.get(id) ?? Promise.resolve()).then(job, job);
  locks.set(id, next.catch(() => {}));
  return next;
}

export const GET = handle(async (req: Request, { params }: RouteCtx) => {
  const { id } = await params;
  const actor = actorOf(req);
  const board = await read(await file(id));
  // Polling guests ask with the rev they have: nothing to send when it hasn't moved.
  const since = new URL(req.url).searchParams.get("rev");
  if (since !== null && Number(since) === board.rev) return Response.json({ rev: board.rev, unchanged: true });
  const me = actor.kind === "guest" ? actor.uid : "owner";
  const role = actor.kind === "guest" ? actor.role : "owner";
  return Response.json({ ...board, people: await people(id), me, role });
});

/** Ops from any role allowed to comment; lib/share/board decides what each actor may change. */
export const POST = handle(async (req: Request, { params }: RouteCtx) => {
  const { id } = await params;
  const actor = requireRole(req, "comment");
  const { ops } = z.object({ ops: z.array(BoardOpSchema).max(50) }).parse(await req.json());
  const f = await file(id);
  return exclusive(id, async () => {
    const stored = await read(f);
    const r = applyOps(stored, ops, actor);
    if ("error" in r) return Response.json({ error: r.message, code: "role", board: stored }, { status: 403 });
    const board = { ...(r.board as BoardData), rev: stored.rev + 1 };
    await write(f, board);
    return Response.json({ rev: board.rev, board });
  });
});

/** Whole-board save from older sites; the owner only, merged so guests' comments survive. */
export const PUT = handle(async (req: Request, { params }: RouteCtx) => {
  requireOwner(req);
  const { id } = await params;
  const actor = actorOf(req);
  const incoming = Board.parse(await req.json());
  const f = await file(id);
  return exclusive(id, async () => {
    const stored = await read(f);
    const merged = mergePut(stored, incoming, actor);
    const board = { ...(merged as BoardData), rev: stored.rev + 1 };
    await write(f, board);
    return Response.json({ ok: true, rev: board.rev });
  });
});

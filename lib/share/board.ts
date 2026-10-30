import type { BoardOp } from "../shared/share";
import type { Actor } from "./actor";
import { RANK } from "./policy";

/**
 * Canvas board changes as small ops checked one by one against the caller's role: guests only
 * touch what their role allows, and comments carry an author the server stamps (never the client).
 */
export type BoardComment = { id: string; x: number; y: number; text: string; route?: string; ts: number; sent?: boolean; by?: string; editedAt?: number };
export type Board = { texts: { id: string }[]; comments: BoardComment[]; groups: { id: string }[]; rev?: number; [k: string]: unknown };

const PER_MEMBER = 100;
const TOTAL = 500;

const atLeast = (a: Actor, min: "comment" | "edit") => a.kind === "owner" || (a.kind === "guest" && RANK[a.role] >= RANK[min]);
const me = (a: Actor) => (a.kind === "public" ? null : a.me);
// Comments from before sharing have no author: they are the owner's.
const author = (c: BoardComment) => c.by ?? "owner";

const upsert = <T extends { id: string }>(list: T[], item: T) => {
  const i = list.findIndex((x) => x.id === item.id);
  if (i < 0) list.push(item);
  else list[i] = item;
};

export function applyOps(board: Board, ops: BoardOp[], actor: Actor): { board: Board } | { error: 403; message: string } {
  const b: Board = { ...board, texts: [...(board.texts ?? [])], comments: (board.comments ?? []).map((c) => ({ ...c })), groups: [...(board.groups ?? [])] };
  const no = (message: string) => ({ error: 403 as const, message });
  const who = me(actor);
  if (!who) return no("Not allowed");
  const isOwner = actor.kind === "owner";
  const canEdit = atLeast(actor, "edit");
  for (const op of ops) {
    if (op.op === "text" || op.op === "group") {
      if (!canEdit) return no("Only editors change texts and frames");
      if (!op.item || typeof op.item !== "object" || typeof op.item.id !== "string") return no("Bad item");
      upsert(op.op === "text" ? b.texts : b.groups, op.item);
    } else if (op.op === "comment") {
      const item = op.item;
      const cur = b.comments.find((c) => c.id === item.id);
      if (!cur) {
        if (!atLeast(actor, "comment")) return no("Your role can't comment");
        if (b.comments.length >= TOTAL) return no("Too many comments");
        if (!isOwner && b.comments.filter((c) => author(c) === who).length >= PER_MEMBER) return no("Too many comments");
        // sent marks a comment handed to the agent: only roles that can run it.
        b.comments.push({ id: item.id, x: item.x, y: item.y, text: item.text, ...(item.route !== undefined ? { route: item.route } : {}), ...(item.sent && canEdit ? { sent: true } : {}), ts: Date.now(), by: who });
        continue;
      }
      const mine = author(cur) === who;
      const textChanged = item.text !== cur.text || item.route !== cur.route;
      const sentChanged = (item.sent ?? false) !== (cur.sent ?? false);
      const moved = item.x !== cur.x || item.y !== cur.y;
      if (mine || isOwner) {
        if (sentChanged && !(isOwner || (mine && canEdit))) return no("Your role can't send to the agent");
      } else if (!(canEdit && !textChanged && !sentChanged)) return no("Only the author changes this comment");
      if (moved) Object.assign(cur, { x: item.x, y: item.y });
      if (textChanged) {
        cur.text = item.text;
        if (item.route === undefined) delete cur.route;
        else cur.route = item.route;
        cur.editedAt = Date.now();
      }
      if (sentChanged) cur.sent = !!item.sent;
    } else if (op.op === "remove") {
      const c = b.comments.find((x) => x.id === op.id);
      if (c) {
        if (!(isOwner || author(c) === who)) return no("Only the author removes this comment");
        b.comments = b.comments.filter((x) => x !== c);
      } else if (b.texts.some((x) => x.id === op.id) || b.groups.some((x) => x.id === op.id)) {
        if (!canEdit) return no("Only editors remove texts and frames");
        b.texts = b.texts.filter((x) => x.id !== op.id);
        b.groups = b.groups.filter((x) => x.id !== op.id);
      }
    }
  }
  b.rev = (board.rev ?? 0) + 1;
  return { board: b };
}

/** The old whole-board PUT (sites from before sharing), owner only: authors and times stay the server's. */
export function mergePut(stored: Board, incoming: Board, actor: Actor): Board {
  if (actor.kind !== "owner") throw Response.json({ error: "Sparkflow: not allowed", code: "role" }, { status: 403 });
  const old = new Map((stored.comments ?? []).map((c) => [c.id, c]));
  const comments = (incoming.comments ?? []).map((c) => {
    const prev = old.get(c.id);
    const { by: _by, ...rest } = c;
    return prev ? { ...rest, ts: prev.ts, ...(prev.by ? { by: prev.by } : {}), ...(prev.editedAt ? { editedAt: prev.editedAt } : {}) } : { ...rest, ts: c.ts ?? Date.now(), by: "owner" };
  });
  return { ...incoming, comments, rev: (stored.rev ?? 0) + 1 };
}

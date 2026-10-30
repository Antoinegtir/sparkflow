"use client";

import { NodeResizer, useStore, type Node, type NodeProps } from "@xyflow/react";
import clsx from "clsx";
import { Check, ChevronDown, Frame, Hand, MessageCircle, MousePointer2, PanelTop, Pencil, Send, Smartphone, Trash2, Type, X } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { BoardOp, Person } from "@/lib/shared/share";
import { useAccess } from "@/lib/web/access";
import { PHONE_H, PHONE_W } from "@/lib/web/layout";
import { Avatar } from "./Avatar";

export type Tool = "move" | "hand" | "frame" | "section" | "page" | "text" | "comment";

type ToolDef = { id: Tool; icon: typeof Frame; label: string; key: string; shift?: boolean };
const MOVE: ToolDef[] = [
  { id: "move", icon: MousePointer2, label: "Move", key: "V" },
  { id: "hand", icon: Hand, label: "Hand", key: "H" },
];
/** Frame and Section share a button with a menu, as in Figma: both draw a box that groups pages. */
const GROUPS: ToolDef[] = [
  { id: "frame", icon: Frame, label: "Frame", key: "F" },
  { id: "section", icon: PanelTop, label: "Section", key: "S", shift: true },
];
const ADD: ToolDef[] = [
  { id: "page", icon: Smartphone, label: "New page", key: "P" },
  { id: "text", icon: Type, label: "Text", key: "T" },
  { id: "comment", icon: MessageCircle, label: "Comment", key: "C" },
];
const ALL = [...MOVE, ...GROUPS, ...ADD];

/** A tool's shortcut as keycaps: a real Shift key beside the letter, not a ⇧ glyph. */
function Keys({ t, small }: { t: ToolDef; small?: boolean }) {
  const cap = clsx(
    "inline-flex items-center justify-center gap-1 rounded-[5px] border border-b-2 border-ink-600 bg-ink-800 font-sans leading-none text-ink-200",
    small ? "h-[18px] min-w-[18px] px-1 text-[10px]" : "h-5 min-w-5 px-1.5 text-[11px]",
  );
  return (
    <span className="inline-flex items-center gap-1">
      {t.shift && (
        <kbd className={cap} aria-label="Shift">
          <span aria-hidden>⇧</span> shift
        </kbd>
      )}
      <kbd className={cap}>{t.key}</kbd>
    </span>
  );
}

/**
 * The tools, in a floating bar on the canvas's left edge, like Figma's bottom bar. V H F ⇧S P T C pick
 * them, Escape goes back to Move.
 */
/** The tools a role may use: viewers look around, commenters add comments, editors get them all. */
export function allowedTools(role: string): Set<Tool> {
  if (role === "view") return new Set(["move", "hand"]);
  if (role === "comment") return new Set(["move", "hand", "comment"]);
  return new Set(ALL.map((t) => t.id));
}

export function ToolBar({ tool, onTool, allowed }: { tool: Tool; onTool: (t: Tool) => void; allowed?: Set<Tool> }) {
  const ok = (t: ToolDef) => !allowed || allowed.has(t.id);
  const [menu, setMenu] = useState(false);
  // The group button shows the last one picked of Frame and Section.
  const [groupTool, setGroupTool] = useState<ToolDef>(GROUPS[0]);
  const pick = useCallback(
    (t: ToolDef) => {
      if (GROUPS.includes(t)) setGroupTool(t);
      setMenu(false);
      onTool(t.id);
    },
    [onTool],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || el?.closest("input, textarea, select, [contenteditable=true]")) return;
      if (e.key === "Escape") {
        setMenu(false);
        return onTool("move");
      }
      const t = ALL.find((x) => x.key === e.key.toUpperCase() && !!x.shift === e.shiftKey);
      if (t && (!allowed || allowed.has(t.id))) pick(t);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onTool, pick, allowed]);

  const button = (t: ToolDef, extra?: string) => (
    <button
      type="button"
      onClick={() => pick(t)}
      aria-label={t.label}
      aria-pressed={tool === t.id}
      className={clsx(
        "group relative grid size-9 cursor-pointer place-items-center rounded-xl transition",
        tool === t.id ? "bg-spark-500 text-white" : "text-ink-300 hover:bg-ink-800 hover:text-ink-100",
        extra,
      )}>
      <t.icon size={17} strokeWidth={1.9} />
      {!menu && (
        <span className="pointer-events-none absolute left-full z-20 ml-2 whitespace-nowrap rounded-md bg-ink-950 px-2 py-1 text-[11px] text-ink-200 opacity-0 shadow-lg transition group-hover:opacity-100">
          <span className="flex items-center gap-2">
            {t.label} <Keys t={t} small />
          </span>
        </span>
      )}
    </button>
  );
  const rule = <div className="mx-1.5 my-0.5 h-px bg-[var(--line)]" />;
  return (
    <div className="absolute top-1/2 left-4 z-10 flex -translate-y-1/2 flex-col gap-1 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-1.5 shadow-xl" role="toolbar" aria-label="Canvas tools">
      {MOVE.map((t) => (
        <div key={t.id}>{button(t)}</div>
      ))}
      {GROUPS.some(ok) && rule}
      {GROUPS.some(ok) && (
      <div className="relative">
        {button(groupTool)}
        {/* A small corner mark inside the button (as in tool groups): it opens Frame or Section. */}
        <button
          type="button"
          onClick={() => setMenu((m) => !m)}
          aria-label="Frame or section"
          aria-expanded={menu}
          className="absolute right-0 bottom-0 grid size-4 cursor-pointer place-items-end p-[3px]">
          <span className={clsx("block size-0 border-t-[5px] border-l-[5px] border-t-transparent", tool === groupTool.id ? "border-l-white/80" : "border-l-ink-400")} style={{ transform: "rotate(90deg)" }} />
        </button>
        {menu && (
          <div role="menu" className="absolute top-0 left-full z-30 ml-3 w-56 rounded-xl border border-[var(--line)] bg-ink-950 p-1.5 shadow-2xl">
            {GROUPS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="menuitemradio"
                aria-checked={groupTool.id === t.id}
                onClick={() => pick(t)}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] text-ink-100 hover:bg-spark-500">
                <Check size={14} className={groupTool.id === t.id ? "opacity-100" : "opacity-0"} />
                <t.icon size={16} strokeWidth={1.9} />
                <span className="flex-1 text-left">{t.label}</span>
                <Keys t={t} />
              </button>
            ))}
          </div>
        )}
      </div>
      )}
      {ADD.some(ok) && rule}
      {ADD.filter(ok).map((t) => (
        <div key={t.id}>{button(t)}</div>
      ))}
    </div>
  );
}

// ---- what the tools place on the canvas ----

export type CanvasText = { id: string; x: number; y: number; text: string };
/** `by`: "owner" or a guest's uid, stamped by the server (none on comments from before sharing: the owner's). */
export type CanvasComment = { id: string; x: number; y: number; text: string; route?: string; ts: number; sent?: boolean; by?: string; editedAt?: number };
/** A frame or a section: a named box drawn around pages to group them (Onboarding, Settings…). */
export type CanvasGroup = { id: string; kind: "frame" | "section"; x: number; y: number; w: number; h: number; name: string };
export type Board = { texts: CanvasText[]; comments: CanvasComment[]; groups: CanvasGroup[] };

const boardKey = (id: string) => `sparkflow.board.${id}`;
const uid = () => Math.random().toString(36).slice(2, 10);
const EMPTY: Board = { texts: [], comments: [], groups: [] };
const POLL_MS = 2500;
type ServerBoard = Partial<Board> & { rev?: number; unchanged?: boolean; people?: Record<string, Person>; me?: string };

/** The change to send for one id, read from the board as it is now (gone from it: a removal). */
function opFor(b: Board, id: string): BoardOp {
  const t = b.texts.find((x) => x.id === id);
  if (t) return { op: "text", item: t };
  const g = b.groups.find((x) => x.id === id);
  if (g) return { op: "group", item: g };
  const c = b.comments.find((x) => x.id === id);
  // Only what the author may set: the server stamps by and ts itself.
  if (c) return { op: "comment", item: { id: c.id, x: c.x, y: c.y, text: c.text, ...(c.route ? { route: c.route } : {}), ...(c.sent !== undefined ? { sent: c.sent } : {}) } };
  return { op: "remove", id };
}

export const PEOPLE_EVENT = "sparkflow:people";

/** The server's board, with this browser's copy of what it hasn't sent yet, so a poll can't undo a change. */
function merge(server: Board, local: Board, pending: Set<string>): Board {
  if (!pending.size) return server;
  const pick = <T extends { id: string }>(s: T[], l: T[]) => [...s.filter((x) => !pending.has(x.id)), ...l.filter((x) => pending.has(x.id))];
  return { texts: pick(server.texts, local.texts), comments: pick(server.comments, local.comments), groups: pick(server.groups, local.groups) };
}

const asBoard = (b: ServerBoard, groups?: CanvasGroup[]): Board => ({ texts: b.texts ?? [], comments: b.comments ?? [], groups: b.groups ?? groups ?? [] });

/**
 * The canvas's groups, text and comments, kept with the project on your computer. Each change is sent
 * as an op (merged per item, a moment after the last one) and the board is polled, so people sharing the
 * app see each other's comments. A sparkflow from before sharing takes the whole board (PUT), and this
 * browser keeps a copy for it.
 */
export function useBoard(projectId: string) {
  const access = useAccess();
  // A shared board is the server's: no copy in this browser that could go stale or leak between people.
  const shared = access.role !== "owner" || access.sharing;
  const [board, setBoard] = useState<Board>(EMPTY);
  const [people, setPeople] = useState<Record<string, Person>>({});
  const [me, setMe] = useState<string>(access.me);
  const boardRef = useRef(board);
  const rev = useRef<number | null>(null);
  // "ops" once the server answers with a rev; "put" for an older one.
  const mode = useRef<"ops" | "put">("ops");
  const pending = useRef(new Map<string, BoardOp>());
  const inFlight = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const receive = useCallback((b: ServerBoard) => {
    if (b.people) setPeople(b.people);
    if (b.me) setMe(b.me);
    if (typeof b.rev === "number") rev.current = b.rev;
    const keep = new Set([...pending.current.keys(), ...inFlight.current]);
    const next = merge(asBoard(b), boardRef.current, keep);
    boardRef.current = next;
    setBoard(next);
  }, []);

  const resync = useCallback(async () => {
    const r = await fetch(`/api/projects/${projectId}/board`, { cache: "no-store" }).catch(() => null);
    if (r?.ok) receive(await r.json());
  }, [projectId, receive]);

  useEffect(() => {
    let local: Board | null = null;
    if (!shared)
      try {
        const saved = JSON.parse(localStorage.getItem(boardKey(projectId)) ?? "null");
        if (saved) local = { ...EMPTY, ...saved };
      } catch {}
    boardRef.current = local ?? EMPTY;
    setBoard(boardRef.current);
    rev.current = null;
    void fetch(`/api/projects/${projectId}/board`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: ServerBoard | null) => {
        if (!b) return;
        if (typeof b.rev !== "number") {
          mode.current = "put";
          // A sparkflow from before groups returns none: this browser's are kept then.
          const server = asBoard(b, local?.groups);
          if (server.texts.length || server.comments.length || server.groups.length || !local) {
            boardRef.current = server;
            setBoard(server);
          }
          return;
        }
        mode.current = "ops";
        receive(b);
      })
      .catch(() => {});
  }, [projectId, shared, receive]);

  // Someone's name or avatar became known (the owner's profile, registered): fetched again in full.
  useEffect(() => {
    const again = () =>
      void fetch(`/api/projects/${projectId}/board`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((b: ServerBoard | null) => b && receive(b))
        .catch(() => {});
    addEventListener(PEOPLE_EVENT, again);
    return () => removeEventListener(PEOPLE_EVENT, again);
  }, [projectId, receive]);

  // Others' changes: polled while the tab is visible, cheap when nothing changed.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.hidden || mode.current !== "ops" || rev.current === null) return;
      void fetch(`/api/projects/${projectId}/board?rev=${rev.current}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((b: ServerBoard | null) => b && !b.unchanged && receive(b))
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(t);
  }, [projectId, receive]);

  const put = useCallback(
    (next: Board) => void fetch(`/api/projects/${projectId}/board`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next) }).catch(() => {}),
    [projectId],
  );

  const flush = useCallback(async () => {
    if (mode.current === "put") return put(boardRef.current);
    const ops = [...pending.current.values()].slice(0, 50);
    if (!ops.length) return;
    const ids = ops.map((o) => (o.op === "remove" ? o.id : (o.item as { id: string }).id));
    ids.forEach((id) => {
      pending.current.delete(id);
      inFlight.current.add(id);
    });
    const r = await fetch(`/api/projects/${projectId}/board`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ops }) }).catch(() => null);
    ids.forEach((id) => inFlight.current.delete(id));
    if (r && (r.status === 404 || r.status === 405)) {
      mode.current = "put";
      return put(boardRef.current);
    }
    const j = r ? await r.json().catch(() => null) : null;
    if (r?.ok && j?.board) receive({ ...j.board, rev: j.rev });
    // Refused (a role that doesn't allow it): the server's board, as it is, replaces ours.
    else if (r?.status === 403) {
      if (j?.board) receive(j.board);
      else void resync();
    }
    if (pending.current.size) timer.current = setTimeout(() => void flush(), 400);
  }, [projectId, put, receive, resync]);

  const update = useCallback(
    (f: (b: Board) => Board, ids: string[]) => {
      const next = f(boardRef.current);
      boardRef.current = next;
      setBoard(next);
      if (mode.current === "put" && !shared)
        try {
          localStorage.setItem(boardKey(projectId), JSON.stringify(next));
        } catch {}
      for (const id of ids) pending.current.set(id, opFor(next, id));
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 400);
    },
    [projectId, shared, flush],
  );
  useEffect(() => () => clearTimeout(timer.current), []);

  return {
    board,
    people,
    me,
    addText: (x: number, y: number) => {
      const id = uid();
      update((b) => ({ ...b, texts: [...b.texts, { id, x, y, text: "" }] }), [id]);
      return id;
    },
    addComment: (x: number, y: number, route?: string) => {
      const id = uid();
      update((b) => ({ ...b, comments: [...b.comments, { id, x, y, text: "", ts: Date.now(), by: me, ...(route ? { route } : {}) }] }), [id]);
      return id;
    },
    addGroup: (kind: CanvasGroup["kind"], r: { x: number; y: number; w: number; h: number }) => {
      const id = uid();
      update((b) => {
        const n = b.groups.filter((g) => g.kind === kind).length + 1;
        // Behind what is already there: drawn later, a section still sits under the frames in it.
        const g = { id, kind, ...r, name: `${kind === "section" ? "Section" : "Frame"} ${n}` };
        return { ...b, groups: kind === "section" ? [g, ...b.groups] : [...b.groups, g] };
      }, [id]);
      return id;
    },
    setGroup: (id: string, patch: Partial<CanvasGroup>) => update((b) => ({ ...b, groups: b.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) }), [id]),
    setText: (id: string, text: string) => update((b) => ({ ...b, texts: b.texts.map((t) => (t.id === id ? { ...t, text } : t)) }), [id]),
    setComment: (id: string, patch: Partial<CanvasComment>) => update((b) => ({ ...b, comments: b.comments.map((c) => (c.id === id ? { ...c, ...patch } : c)) }), [id]),
    /** Moves texts, comments and groups by id to these positions, in one change. */
    moveMany: (to: Record<string, { x: number; y: number }>) =>
      update(
        (b) => ({
          texts: b.texts.map((t) => (to[t.id] ? { ...t, ...to[t.id] } : t)),
          comments: b.comments.map((c) => (to[c.id] ? { ...c, ...to[c.id] } : c)),
          groups: b.groups.map((g) => (to[g.id] ? { ...g, ...to[g.id] } : g)),
        }),
        Object.keys(to),
      ),
    remove: (id: string) => update((b) => ({ texts: b.texts.filter((t) => t.id !== id), comments: b.comments.filter((c) => c.id !== id), groups: b.groups.filter((g) => g.id !== id) }), [id]),
  };
}

// ---- nodes ----

/**
 * Focuses a field once it can be: React Flow keeps a new node hidden until it has measured it, and a
 * hidden field can't take the focus.
 */
function useFocusWhen(on: boolean, selectAll = false) {
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  useEffect(() => {
    if (!on) return;
    let tries = 0;
    let raf = 0;
    const go = () => {
      const el = ref.current;
      if (el && document.activeElement !== el) {
        el.focus();
        // A default name is selected, so typing replaces it; otherwise the caret goes to the end.
        if (selectAll) el.select();
        else el.setSelectionRange?.(el.value.length, el.value.length);
      }
      if ((!el || document.activeElement !== el) && ++tries < 30) raf = requestAnimationFrame(go);
    };
    raf = requestAnimationFrame(go);
    return () => cancelAnimationFrame(raf);
  }, [on, selectAll]);
  return ref;
}

/** Keeps a pin or a pop-up the same size on screen whatever the canvas zoom, as Figma does. */
const useUnzoom = () => {
  const zoom = useStore((s) => s.transform[2]);
  return { transform: `scale(${1 / zoom})`, transformOrigin: "top left" } as const;
};

export type TextData = { text: string; editing: boolean; canEdit: boolean; onChange: (text: string) => void; onDone: () => void; onEdit: () => void; onRemove: () => void };

/** Text on the canvas, as in Figma: typed in place; hovered, it offers Edit and Delete (double-click edits too); an empty one goes away. */
export const TextNode = memo(function TextNode({ data, selected }: NodeProps<Node<TextData>>) {
  const ref = useFocusWhen(data.editing);
  const unzoom = useUnzoom();
  const fit = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "0";
    el.style.height = `${el.scrollHeight}px`;
  };
  useEffect(() => fit(ref.current), [data.text, data.editing]);
  return (
    <div className={clsx("group relative rounded-md px-1.5 py-0.5", data.editing || selected ? "ring-1 ring-spark-400" : "hover:ring-1 hover:ring-ink-500")} onDoubleClick={data.onEdit}>
      {data.editing ? (
        <textarea
          ref={ref}
          value={data.text}
          rows={1}
          placeholder="Type something"
          onChange={(e) => data.onChange(e.target.value)}
          onBlur={data.onDone}
          onKeyDown={(e) => {
            if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) e.currentTarget.blur();
          }}
          className="nodrag nowheel block w-[320px] resize-none overflow-hidden bg-transparent text-[24px] leading-snug font-medium text-ink-100 outline-none placeholder:text-ink-500"
        />
      ) : (
        <p className="max-w-[320px] text-[24px] leading-snug font-medium whitespace-pre-wrap text-ink-100">{data.text}</p>
      )}
      {/* On hover (or selected): edit and delete, the same size whatever the zoom. */}
      {!data.editing && data.canEdit && (
        <div className={clsx("absolute bottom-full left-0 pb-1 transition-opacity", selected ? "opacity-100" : "opacity-0 group-hover:opacity-100")} style={{ ...unzoom, transformOrigin: "bottom left" }}>
          <div className="nodrag flex items-center gap-0.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-0.5 shadow-lg">
            <button type="button" onClick={data.onEdit} aria-label="Edit text" title="Edit" className="grid size-7 cursor-pointer place-items-center rounded-md text-ink-300 hover:bg-ink-800 hover:text-ink-100">
              <Pencil size={13} />
            </button>
            <button type="button" onClick={data.onRemove} aria-label="Delete text" title="Delete" className="grid size-7 cursor-pointer place-items-center rounded-md text-ink-300 hover:bg-ink-800 hover:text-red-400">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export type CommentData = {
  comment: CanvasComment;
  index: number;
  pageTitle?: string;
  open: boolean;
  /** May send it to the agent: your own comment with a role that runs it, or the owner's say on anyone's. */
  canSend: boolean;
  /** The agent is running: Send waits. */
  busy: boolean;
  /** The author (or the owner) may change the text and delete it; others only read it. */
  canModify: boolean;
  author?: Person;
  authorKey: string;
  mine: boolean;
  onOpen: () => void;
  /** Closes it with the text as typed: kept, or the comment goes if it's empty. */
  onClose: (text: string) => void;
  onChange: (text: string) => void;
  onSend: (text: string) => void;
  onRemove: () => void;
};

/**
 * A comment pin, as in Figma: a bubble with its number. Open, it shows the note and, on a page, sends it
 * to the agent as a change for that page.
 */
export const CommentNode = memo(function CommentNode({ data }: NodeProps<Node<CommentData>>) {
  const c = data.comment;
  const [draft, setDraft] = useState(c.text);
  useEffect(() => setDraft(c.text), [c.text]);
  const ref = useFocusWhen(data.open);
  const commit = () => draft.trim() !== c.text && data.onChange(draft.trim());
  return (
    <div className="relative" style={useUnzoom()}>
      <button
        type="button"
        onClick={data.open ? () => data.onClose(draft.trim()) : data.onOpen}
        aria-label={`Comment ${data.index}`}
        className={clsx(
          "grid size-8 cursor-pointer place-items-center rounded-full rounded-bl-none border-2 border-white text-[12px] font-semibold text-white shadow-lg transition hover:scale-110",
          c.sent ? "bg-emerald-500" : "bg-spark-500",
        )}>
        {data.author ? <Avatar person={data.author} seed={data.authorKey} size={24} /> : c.sent ? <Check size={14} strokeWidth={3} /> : data.index}
      </button>
      {data.author && (
        <span className={clsx("pointer-events-none absolute -top-1.5 -right-1.5 grid min-w-4 place-items-center rounded-full px-1 text-[9.5px] leading-4 font-semibold text-white ring-2 ring-white", c.sent ? "bg-emerald-500" : "bg-spark-500")}>
          {c.sent ? <Check size={9} strokeWidth={3.5} className="my-[3.5px]" /> : data.index}
        </span>
      )}
      {data.open && (
        <div className="nodrag nowheel nopan absolute top-0 left-10 z-20 w-72 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 shadow-2xl">
          {data.author && (
            <div className="mb-1.5 flex items-center gap-1.5 text-[12px]">
              <Avatar person={data.author} seed={data.authorKey} size={18} />
              <span className="truncate font-medium text-ink-100">{data.author.name}</span>
              {data.mine ? <span className="text-ink-500">(you)</span> : data.author.role === "owner" && <span className="rounded bg-ink-700 px-1 text-[10px] text-ink-300">Owner</span>}
              <span className="ml-auto shrink-0 text-[10.5px] text-ink-500">{new Date(c.ts).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}</span>
            </div>
          )}
          <div className="mb-2 flex items-center justify-between text-[11px] text-ink-500">
            <span>{data.pageTitle ? `On ${data.pageTitle}` : "On the canvas"}</span>
            <span className="flex items-center gap-1">
              {data.canModify && (
              <button type="button" onClick={data.onRemove} aria-label="Delete comment" className="grid size-6 cursor-pointer place-items-center rounded-md hover:bg-ink-800 hover:text-red-400">
                <Trash2 size={13} />
              </button>
              )}
              <button type="button" onClick={() => data.onClose(draft.trim())} aria-label="Close" className="grid size-6 cursor-pointer place-items-center rounded-md hover:bg-ink-800 hover:text-ink-200">
                <X size={13} />
              </button>
            </span>
          </div>
          <textarea
            ref={ref}
            value={draft}
            readOnly={!data.canModify}
            rows={3}
            placeholder={data.pageTitle ? "Add a comment, e.g. the cards need more space" : "Add a comment"}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commit();
              if (e.key === "Escape") data.onClose(draft.trim());
            }}
            className="w-full resize-none rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-2.5 py-2 text-[13px] text-ink-100 outline-none focus:border-spark-500"
          />
          {data.pageTitle && data.canSend && (
            <button
              type="button"
              disabled={!draft.trim() || data.busy}
              onClick={() => data.onSend(draft.trim())}
              className="mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-spark-500 py-1.5 text-[12px] font-medium text-white disabled:cursor-default disabled:opacity-40">
              <Send size={12} /> {c.sent ? "Send to the agent again" : "Send to the agent"}
            </button>
          )}
          <p className="mt-2 text-[10.5px] text-ink-600">{new Date(c.ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</p>
        </div>
      )}
    </div>
  );
});

export type NewPageData = { pages: { route: string; title: string }[]; from?: string; running: boolean; onSubmit: (a: { name: string; description: string; from?: string }) => void; onCancel: () => void };

/** A new page where it was placed (the Page tool): name it, say what it shows, and the agent makes it there. */
export const NewPageNode = memo(function NewPageNode({ data }: NodeProps<Node<NewPageData>>) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [from, setFrom] = useState(data.from ?? "");
  const input = "w-full rounded-md border border-[var(--line)] bg-[var(--panel-2)] px-2 py-1.5 text-[12px] text-ink-100 outline-none focus:border-spark-500";
  const ref = useFocusWhen(true);
  const unzoom = useUnzoom();
  return (
    <div className="relative">
      <div className="mb-2 text-center text-[13px] font-medium text-spark-400">{name.trim() || "New page"}</div>
      <div className="grid place-items-center rounded-[28px] border-2 border-dashed border-spark-500/70 bg-spark-500/5 text-spark-400/70" style={{ width: PHONE_W, height: PHONE_H }}>
        <Smartphone size={28} strokeWidth={1.5} />
      </div>
      {/* The form beside the frame, the same size whatever the zoom. */}
      <div className="absolute top-7 left-full ml-3" style={unzoom}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) data.onSubmit({ name: name.trim(), description: desc.trim(), from: from || undefined });
          }}
          onKeyDown={(e) => e.key === "Escape" && data.onCancel()}
          className="nodrag nowheel nopan flex w-64 flex-col gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 shadow-2xl">
          <p className="text-[12px] font-medium text-ink-200">New page</p>
          <input ref={ref} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className={input} />
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What it shows" rows={3} className={clsx(input, "resize-none")} />
          <select value={from} onChange={(e) => setFrom(e.target.value)} className={clsx(input, "cursor-pointer")} aria-label="Opened from">
            <option value="">Opened from nowhere</option>
            {data.pages.map((p) => (
              <option key={p.route} value={p.route}>
                Opened from {p.title}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button type="button" onClick={data.onCancel} className="flex-1 cursor-pointer rounded-md border border-[var(--line)] py-1.5 text-[12px] text-ink-300 hover:text-ink-100">
              Cancel
            </button>
            <button disabled={!name.trim() || data.running} className="flex-[2] cursor-pointer rounded-md bg-spark-500 py-1.5 text-[12px] font-medium text-white disabled:cursor-default disabled:opacity-40">
              {data.running ? "The agent is busy" : "Ask the agent"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

export type GroupData = {
  group: CanvasGroup;
  /** Resize, rename and delete: editors and the owner only. */
  canEdit: boolean;
  editing: boolean;
  onEdit: () => void;
  onRename: (name: string) => void;
  onRemove: () => void;
  onResizing: (on: boolean) => void;
};

/**
 * A frame or a section around pages. A section, as in Figma, is a tinted area with its name in a tab; a
 * frame, an outlined box with its name above. Moving one moves what is inside; selected, it resizes
 * from its edges. Double-click the name to rename it.
 */
export const GroupNode = memo(function GroupNode({ data, selected }: NodeProps<Node<GroupData>>) {
  const g = data.group;
  const section = g.kind === "section";
  const [name, setName] = useState(g.name);
  useEffect(() => setName(g.name), [g.name]);
  const ref = useFocusWhen(data.editing, true);
  const unzoom = useUnzoom();
  const done = () => data.onRename(name.trim() || g.name);
  return (
    <div className={clsx("relative h-full w-full", section ? "rounded-[18px] border border-ink-500/50 bg-ink-400/[0.06]" : "border border-ink-400/70")}>
      <NodeResizer
        isVisible={selected && data.canEdit}
        minWidth={160}
        minHeight={120}
        color="var(--color-spark-500)"
        // 9 px on screen (React Flow keeps them that size whatever the zoom): easy to grab.
        handleStyle={{ width: 9, height: 9, borderRadius: 2 }}
        onResizeStart={() => data.onResizing(true)}
        onResizeEnd={() => data.onResizing(false)}
      />
      {/* The name, the same size whatever the zoom: in a tab inside a section, above a frame. */}
      <div className={clsx("absolute left-0", section ? "top-0 p-2" : "bottom-full pb-1")} style={{ ...unzoom, transformOrigin: section ? "top left" : "bottom left" }}>
        {data.editing ? (
          <input
            ref={ref}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={done}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
            }}
            className="nodrag w-48 rounded-md border border-spark-500 bg-[var(--panel)] px-2 py-0.5 text-[13px] font-medium text-ink-100 outline-none"
          />
        ) : (
          <span className="flex items-center gap-1.5">
            <span
              onDoubleClick={data.onEdit}
              className={clsx(
                "block cursor-text whitespace-nowrap text-[13px] font-medium",
                section ? "rounded-md bg-ink-700/80 px-2 py-0.5 text-ink-100" : "text-ink-300",
                selected && (section ? "bg-spark-500 text-white" : "text-spark-400"),
              )}>
              {g.name}
            </span>
            {selected && data.canEdit && (
              <button type="button" onClick={data.onRemove} aria-label={`Delete ${g.name}`} className="nodrag grid size-5 cursor-pointer place-items-center rounded text-ink-400 hover:text-red-400">
                <Trash2 size={12} />
              </button>
            )}
          </span>
        )}
      </div>
    </div>
  );
});

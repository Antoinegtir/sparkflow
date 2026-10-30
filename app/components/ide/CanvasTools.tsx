"use client";

import { NodeResizer, useStore, type Node, type NodeProps } from "@xyflow/react";
import clsx from "clsx";
import { Check, ChevronDown, Frame, Hand, MessageCircle, MousePointer2, PanelTop, Pencil, Send, Smartphone, Trash2, Type, X } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { PHONE_H, PHONE_W } from "@/lib/web/layout";

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
const keyLabel = (t: ToolDef) => (t.shift ? `⇧${t.key}` : t.key);

/**
 * The tools, in a floating bar on the canvas's left edge, like Figma's bottom bar. V H F ⇧S P T C pick
 * them, Escape goes back to Move.
 */
export function ToolBar({ tool, onTool }: { tool: Tool; onTool: (t: Tool) => void }) {
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
      if (t) pick(t);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onTool, pick]);

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
          {t.label} <span className="ml-1 font-mono text-ink-500">{keyLabel(t)}</span>
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
      {rule}
      <div className="relative">
        {button(groupTool, "pr-1")}
        <button
          type="button"
          onClick={() => setMenu((m) => !m)}
          aria-label="Frame or section"
          aria-expanded={menu}
          className={clsx("absolute top-1/2 -right-1 grid h-6 w-3.5 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-ink-400 hover:bg-ink-700 hover:text-ink-100", menu && "bg-ink-700 text-ink-100")}>
          <ChevronDown size={11} strokeWidth={2.4} className="-rotate-90" />
        </button>
        {menu && (
          <div role="menu" className="absolute top-0 left-full z-30 ml-3 w-52 rounded-xl border border-[var(--line)] bg-ink-950 p-1.5 shadow-2xl">
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
                <span className="font-mono text-[11.5px] text-ink-400">{keyLabel(t)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {rule}
      {ADD.map((t) => (
        <div key={t.id}>{button(t)}</div>
      ))}
    </div>
  );
}

// ---- what the tools place on the canvas ----

export type CanvasText = { id: string; x: number; y: number; text: string };
export type CanvasComment = { id: string; x: number; y: number; text: string; route?: string; ts: number; sent?: boolean };
/** A frame or a section: a named box drawn around pages to group them (Onboarding, Settings…). */
export type CanvasGroup = { id: string; kind: "frame" | "section"; x: number; y: number; w: number; h: number; name: string };
export type Board = { texts: CanvasText[]; comments: CanvasComment[]; groups: CanvasGroup[] };

const boardKey = (id: string) => `sparkflow.board.${id}`;
const uid = () => Math.random().toString(36).slice(2, 10);
const EMPTY: Board = { texts: [], comments: [], groups: [] };

/**
 * The canvas's groups, text and comments, kept with the project on your computer (and in this browser,
 * for a sparkflow that doesn't keep them yet). Saved a moment after each change.
 */
export function useBoard(projectId: string) {
  const [board, setBoard] = useState<Board>(EMPTY);
  useEffect(() => {
    let local: Board | null = null;
    try {
      const saved = JSON.parse(localStorage.getItem(boardKey(projectId)) ?? "null");
      if (saved) local = { ...EMPTY, ...saved };
    } catch {}
    setBoard(local ?? EMPTY);
    void fetch(`/api/projects/${projectId}/board`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b: Partial<Board> | null) => {
        if (!b) return;
        // A sparkflow from before groups returns none: this browser's are kept then.
        const server: Board = { texts: b.texts ?? [], comments: b.comments ?? [], groups: b.groups ?? local?.groups ?? [] };
        if (server.texts.length || server.comments.length || server.groups.length || !local) setBoard(server);
      })
      .catch(() => {});
  }, [projectId]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const save = useCallback(
    (next: Board) => {
      try {
        localStorage.setItem(boardKey(projectId), JSON.stringify(next));
      } catch {}
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void fetch(`/api/projects/${projectId}/board`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next) }).catch(() => {});
      }, 400);
    },
    [projectId],
  );
  const update = useCallback(
    (f: (b: Board) => Board) =>
      setBoard((b) => {
        const next = f(b);
        save(next);
        return next;
      }),
    [save],
  );
  return {
    board,
    addText: (x: number, y: number) => {
      const id = uid();
      update((b) => ({ ...b, texts: [...b.texts, { id, x, y, text: "" }] }));
      return id;
    },
    addComment: (x: number, y: number, route?: string) => {
      const id = uid();
      update((b) => ({ ...b, comments: [...b.comments, { id, x, y, text: "", ts: Date.now(), ...(route ? { route } : {}) }] }));
      return id;
    },
    addGroup: (kind: CanvasGroup["kind"], r: { x: number; y: number; w: number; h: number }) => {
      const id = uid();
      update((b) => {
        const n = b.groups.filter((g) => g.kind === kind).length + 1;
        // Behind what is already there: drawn later, a section still sits under the frames in it.
        const g = { id, kind, ...r, name: `${kind === "section" ? "Section" : "Frame"} ${n}` };
        return { ...b, groups: kind === "section" ? [g, ...b.groups] : [...b.groups, g] };
      });
      return id;
    },
    setGroup: (id: string, patch: Partial<CanvasGroup>) => update((b) => ({ ...b, groups: b.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
    setText: (id: string, text: string) => update((b) => ({ ...b, texts: b.texts.map((t) => (t.id === id ? { ...t, text } : t)) })),
    setComment: (id: string, patch: Partial<CanvasComment>) => update((b) => ({ ...b, comments: b.comments.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
    /** Moves texts, comments and groups by id to these positions, in one change. */
    moveMany: (to: Record<string, { x: number; y: number }>) =>
      update((b) => ({
        texts: b.texts.map((t) => (to[t.id] ? { ...t, ...to[t.id] } : t)),
        comments: b.comments.map((c) => (to[c.id] ? { ...c, ...to[c.id] } : c)),
        groups: b.groups.map((g) => (to[g.id] ? { ...g, ...to[g.id] } : g)),
      })),
    remove: (id: string) => update((b) => ({ texts: b.texts.filter((t) => t.id !== id), comments: b.comments.filter((c) => c.id !== id), groups: b.groups.filter((g) => g.id !== id) })),
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
  canSend: boolean;
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
        {c.sent ? <Check size={14} strokeWidth={3} /> : data.index}
      </button>
      {data.open && (
        <div className="nodrag nowheel nopan absolute top-0 left-10 z-20 w-72 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between text-[11px] text-ink-500">
            <span>{data.pageTitle ? `On ${data.pageTitle}` : "On the canvas"}</span>
            <span className="flex items-center gap-1">
              <button type="button" onClick={data.onRemove} aria-label="Delete comment" className="grid size-6 cursor-pointer place-items-center rounded-md hover:bg-ink-800 hover:text-red-400">
                <Trash2 size={13} />
              </button>
              <button type="button" onClick={() => data.onClose(draft.trim())} aria-label="Close" className="grid size-6 cursor-pointer place-items-center rounded-md hover:bg-ink-800 hover:text-ink-200">
                <X size={13} />
              </button>
            </span>
          </div>
          <textarea
            ref={ref}
            value={draft}
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
          {data.pageTitle && (
            <button
              type="button"
              disabled={!draft.trim() || !data.canSend}
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
        isVisible={selected}
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
            {selected && (
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

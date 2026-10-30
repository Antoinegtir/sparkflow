"use client";

import { useStore, type Node, type NodeProps } from "@xyflow/react";
import clsx from "clsx";
import { Check, Frame, Hand, MessageCircle, MousePointer2, Send, Trash2, Type, X } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { PHONE_H, PHONE_W } from "@/lib/web/layout";

export type Tool = "move" | "hand" | "frame" | "text" | "comment";

const TOOLS: { id: Tool; icon: typeof Frame; label: string; key: string }[] = [
  { id: "move", icon: MousePointer2, label: "Move", key: "V" },
  { id: "hand", icon: Hand, label: "Hand", key: "H" },
  { id: "frame", icon: Frame, label: "Frame: a new page", key: "F" },
  { id: "text", icon: Type, label: "Text", key: "T" },
  { id: "comment", icon: MessageCircle, label: "Comment", key: "C" },
];

/** Cursor over the canvas for each tool. */
export const TOOL_CURSOR: Record<Tool, string | undefined> = { move: undefined, hand: "grab", frame: "crosshair", text: "text", comment: "crosshair" };

/** The tools, in a floating bar on the canvas's left edge, like Figma's bottom bar. V H F T C pick them, Escape goes back to Move. */
export function ToolBar({ tool, onTool }: { tool: Tool; onTool: (t: Tool) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || el?.closest("input, textarea, select, [contenteditable=true]")) return;
      if (e.key === "Escape") return onTool("move");
      const t = TOOLS.find((x) => x.key === e.key.toUpperCase());
      if (t) onTool(t.id);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onTool]);
  return (
    <div className="absolute top-1/2 left-4 z-10 flex -translate-y-1/2 flex-col gap-1 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-1.5 shadow-xl" role="toolbar" aria-label="Canvas tools">
      {TOOLS.map(({ id, icon: Icon, label, key }, i) => (
        <div key={id}>
          {/* Move and Hand, then what can be added. */}
          {i === 2 && <div className="mx-1.5 mb-1 h-px bg-[var(--line)]" />}
          <button
            type="button"
            onClick={() => onTool(id)}
            title={`${label} (${key})`}
            aria-label={label}
            aria-pressed={tool === id}
            className={clsx(
              "group relative grid size-9 cursor-pointer place-items-center rounded-xl transition",
              tool === id ? "bg-spark-500 text-white" : "text-ink-300 hover:bg-ink-800 hover:text-ink-100",
            )}>
            <Icon size={17} strokeWidth={1.9} />
            <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-ink-950 px-2 py-1 text-[11px] text-ink-200 opacity-0 shadow-lg transition group-hover:opacity-100">
              {label} <span className="ml-1 font-mono text-ink-500">{key}</span>
            </span>
          </button>
        </div>
      ))}
    </div>
  );
}

// ---- what the tools place on the canvas ----

export type CanvasText = { id: string; x: number; y: number; text: string };
export type CanvasComment = { id: string; x: number; y: number; text: string; route?: string; ts: number; sent?: boolean };
export type Board = { texts: CanvasText[]; comments: CanvasComment[] };

const boardKey = (id: string) => `sparkflow.board.${id}`;
const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * The canvas's text and comments, kept with the project on your computer (and in this browser, for a
 * sparkflow that doesn't keep them yet). Saved a moment after each change.
 */
export function useBoard(projectId: string) {
  const [board, setBoard] = useState<Board>({ texts: [], comments: [] });
  const loaded = useRef(false);
  useEffect(() => {
    loaded.current = false;
    let local: Board | null = null;
    try {
      local = JSON.parse(localStorage.getItem(boardKey(projectId)) ?? "null");
    } catch {}
    if (local) setBoard(local);
    void fetch(`/api/projects/${projectId}/board`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b: Board | null) => {
        if (b && (b.texts?.length || b.comments?.length || !local)) setBoard({ texts: b.texts ?? [], comments: b.comments ?? [] });
      })
      .catch(() => {})
      .finally(() => (loaded.current = true));
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
    setText: (id: string, text: string) => update((b) => ({ ...b, texts: b.texts.map((t) => (t.id === id ? { ...t, text } : t)) })),
    setComment: (id: string, patch: Partial<CanvasComment>) => update((b) => ({ ...b, comments: b.comments.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
    move: (id: string, x: number, y: number) =>
      update((b) => ({
        texts: b.texts.map((t) => (t.id === id ? { ...t, x, y } : t)),
        comments: b.comments.map((c) => (c.id === id ? { ...c, x, y } : c)),
      })),
    remove: (id: string) => update((b) => ({ texts: b.texts.filter((t) => t.id !== id), comments: b.comments.filter((c) => c.id !== id) })),
  };
}

// ---- nodes ----

/**
 * Focuses a field once it can be: React Flow keeps a new node hidden until it has measured it, and a
 * hidden field can't take the focus.
 */
function useFocusWhen(on: boolean) {
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  useEffect(() => {
    if (!on) return;
    let tries = 0;
    let raf = 0;
    const go = () => {
      const el = ref.current;
      if (el && document.activeElement !== el) {
        el.focus();
        el.setSelectionRange?.(el.value.length, el.value.length);
      }
      if ((!el || document.activeElement !== el) && ++tries < 30) raf = requestAnimationFrame(go);
    };
    raf = requestAnimationFrame(go);
    return () => cancelAnimationFrame(raf);
  }, [on]);
  return ref;
}

/** Keeps a pin or a pop-up the same size on screen whatever the canvas zoom, as Figma does. */
const useUnzoom = () => {
  const zoom = useStore((s) => s.transform[2]);
  return { transform: `scale(${1 / zoom})`, transformOrigin: "top left" } as const;
};

export type TextData = { text: string; editing: boolean; onChange: (text: string) => void; onDone: () => void; onEdit: () => void; onRemove: () => void };

/** Text on the canvas, as in Figma: typed in place, double-click to edit again; an empty one goes away. */
export const TextNode = memo(function TextNode({ data, selected }: NodeProps<Node<TextData>>) {
  const ref = useFocusWhen(data.editing);
  const fit = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "0";
    el.style.height = `${el.scrollHeight}px`;
  };
  useEffect(() => fit(ref.current), [data.text, data.editing]);
  return (
    <div className={clsx("rounded-md px-1.5 py-0.5", (selected || data.editing) && "ring-1 ring-spark-400")} onDoubleClick={data.onEdit}>
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
      {selected && !data.editing && (
        <button type="button" onClick={data.onRemove} aria-label="Delete text" className="nodrag absolute -top-3 -right-3 grid size-6 cursor-pointer place-items-center rounded-full bg-ink-800 text-ink-300 shadow hover:text-red-400">
          <Trash2 size={12} />
        </button>
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

export type FrameData = { pages: { route: string; title: string }[]; from?: string; running: boolean; onSubmit: (a: { name: string; description: string; from?: string }) => void; onCancel: () => void };

/** A new page's frame where it was placed: name it, say what it shows, and the agent makes it there. */
export const FrameNode = memo(function FrameNode({ data }: NodeProps<Node<FrameData>>) {
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
        <Frame size={28} strokeWidth={1.5} />
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

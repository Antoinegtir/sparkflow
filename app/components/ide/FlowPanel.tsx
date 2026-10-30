"use client";

import { ArrowUpRight, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { ProjectState } from "@/lib/shared";
import type { FlowAction } from "./ActivityPanel";
import { AttachedImage, useImageAttach } from "./ImageAttach";

/** Overview of pages and links: add a page, link/unlink pages, delete a page. Each action becomes a prompt. */
export function FlowPanel({ state, onOpenPage, onAction }: { state: ProjectState; onOpenPage: (route: string) => void; onAction: (a: FlowAction) => void }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [from, setFrom] = useState(state.order[0] ?? "");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const running = state.status === "running";
  const sketch = useImageAttach(running);
  const title = (r: string) => state.screens[r]?.title ?? r;

  return (
    <div className="h-full overflow-y-auto p-3 pb-24">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-500">Pages &amp; links</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onAction({ type: "add", name: name.trim(), description: desc.trim(), from: from || undefined, ...(sketch.image ? { image: sketch.image.input } : {}) });
          setName("");
          setDesc("");
          sketch.clear();
        }}
        {...sketch.zone}
        className={`mb-4 space-y-2 rounded-xl border p-3 ${sketch.dragging ? "border-spark-500" : "border-[var(--line)]"}`}>
        <p className="text-[12px] font-medium text-ink-200">New page</p>
        <input disabled={running} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="w-full rounded-md border border-[var(--line)] bg-[var(--panel-2)] px-2 py-1.5 text-[12px] text-ink-100 outline-none" />
        <textarea disabled={running} value={desc} onChange={(e) => setDesc(e.target.value)} onPaste={sketch.paste} placeholder="What it shows" rows={2} className="w-full resize-none rounded-md border border-[var(--line)] bg-[var(--panel-2)] px-2 py-1.5 text-[12px] text-ink-100 outline-none" />
        <AttachedImage a={sketch} />
        <label className="flex items-center gap-2 text-[11.5px] text-ink-400">
          Opened from
          <select disabled={running} value={from} onChange={(e) => setFrom(e.target.value)} className="flex-1 cursor-pointer rounded-md border border-[var(--line)] bg-[var(--panel-2)] px-1.5 py-1 text-[11.5px] text-ink-200 outline-none">
            <option value="">nowhere</option>
            {state.order.map((r) => (
              <option key={r} value={r}>
                {title(r)}
              </option>
            ))}
          </select>
        </label>
        <button disabled={running || !name.trim()} className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md bg-spark-500 py-1.5 text-[12px] font-medium text-white disabled:opacity-40">
          <Plus size={13} /> Ask the agent
        </button>
      </form>

      <div className="space-y-2">
        {state.order.map((r) => {
          const out = state.edges.filter((e) => e.from === r && state.order.includes(e.to));
          const inCount = state.edges.filter((e) => e.to === r).length;
          const others = state.order.filter((o) => o !== r && !out.some((e) => e.to === o));
          return (
            <div key={r} className="rounded-xl border border-[var(--line)] p-2.5">
              <div className="flex items-center gap-2">
                <button onClick={() => onOpenPage(r)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-1 text-left text-[12.5px] font-medium text-ink-100 hover:text-spark-400">
                  <span className="truncate">{title(r)}</span> <ArrowUpRight size={12} className="shrink-0" />
                </button>
                <span className="text-[10.5px] text-ink-500">{inCount ? `${inCount} in` : "entry"}</span>
                <button
                  disabled={running}
                  onClick={() => {
                    if (confirmDelete !== r) return setConfirmDelete(r);
                    setConfirmDelete(null);
                    onAction({ type: "delete", route: r });
                  }}
                  className="cursor-pointer rounded p-1 text-[10.5px] text-ink-500 hover:text-red-400 disabled:opacity-40">
                  {confirmDelete === r ? "Delete?" : <Trash2 size={12} />}
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {out.map((e) => (
                  <span key={e.to} className="flex items-center gap-1 rounded-md bg-ink-800 px-1.5 py-0.5 text-[11px] text-ink-300">
                    → {title(e.to)}
                    <button disabled={running} aria-label="Remove link" onClick={() => onAction({ type: "unlink", from: r, to: e.to })} className="cursor-pointer text-ink-500 hover:text-ink-100">
                      <X size={10} />
                    </button>
                  </span>
                ))}
                {others.length > 0 && (
                  <select
                    disabled={running}
                    value=""
                    onChange={(e) => e.target.value && onAction({ type: "link", from: r, to: e.target.value })}
                    className="cursor-pointer rounded-md border border-dashed border-[var(--line)] bg-transparent px-1 py-0.5 text-[11px] text-ink-500 outline-none">
                    <option value="">Link to…</option>
                    {others.map((o) => (
                      <option key={o} value={o}>
                        {title(o)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-[11px] text-ink-500">Tip: drag from the dot on the right of a page to another page on the canvas to link them.</p>
    </div>
  );
}

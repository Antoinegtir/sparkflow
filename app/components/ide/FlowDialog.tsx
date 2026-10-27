"use client";

import { ArrowRight, X } from "lucide-react";
import { useState } from "react";
import type { FlowAction } from "./ActivityPanel";

/** The prompt sent to the agent for a flow action, plus the route it is scoped to. */
export function flowPrompt(a: FlowAction, title: (r: string) => string): { text: string; route?: string } {
  switch (a.type) {
    case "add":
      return {
        text: `Add a new page "${a.name}"${a.description ? `: ${a.description}` : ""}.${a.from ? ` Open it from the page "${title(a.from)}" with a clear button or row.` : ""} Keep every existing page working.`,
      };
    case "link":
      return { text: `On this page, add a clear way to open the page "${title(a.to)}"${a.label ? ` — a "${a.label}" button` : ""}. Keep the rest of the page as it is.`, route: a.from };
    case "unlink":
      return { text: `Remove the way to open the page "${title(a.to)}" from this page. Keep both pages.`, route: a.from };
    case "delete":
      return { text: `Delete the page "${title(a.route)}" and remove every button or link that opens it. Keep every other page working.` };
  }
}

/** Confirmation for links drawn (or edges clicked) on the canvas. */
export function FlowDialog({ draft, title, onCancel, onConfirm }: { draft: { type: "link" | "unlink"; from: string; to: string }; title: (r: string) => string; onCancel: () => void; onConfirm: (a: FlowAction) => void }) {
  const [label, setLabel] = useState("");
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/50 backdrop-blur-sm" onMouseDown={onCancel}>
      <div onMouseDown={(e) => e.stopPropagation()} className="w-[380px] rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-ink-100">{draft.type === "link" ? "Link pages" : "Remove link"}</h3>
          <button onClick={onCancel} aria-label="Close" className="cursor-pointer text-ink-500 hover:text-ink-100">
            <X size={15} />
          </button>
        </div>
        <div className="mb-4 flex items-center justify-center gap-2 text-[12.5px]">
          <span className="rounded-md bg-ink-800 px-2 py-1 text-ink-100">{title(draft.from)}</span>
          <ArrowRight size={14} className="text-ink-500" />
          <span className="rounded-md bg-ink-800 px-2 py-1 text-ink-100">{title(draft.to)}</span>
        </div>
        {draft.type === "link" ? (
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Button label (optional)"
            className="mb-4 w-full rounded-md border border-[var(--line)] bg-[var(--panel-2)] px-2.5 py-2 text-[12.5px] text-ink-100 outline-none"
          />
        ) : (
          <p className="mb-4 text-[12.5px] text-ink-400">The agent removes the button or link that opens “{title(draft.to)}” from “{title(draft.from)}”.</p>
        )}
        <button
          onClick={() => onConfirm(draft.type === "link" ? { type: "link", from: draft.from, to: draft.to, label: label.trim() || undefined } : { type: "unlink", from: draft.from, to: draft.to })}
          className="w-full cursor-pointer rounded-lg bg-spark-500 py-2 text-[12.5px] font-medium text-white">
          Ask the agent
        </button>
      </div>
    </div>
  );
}

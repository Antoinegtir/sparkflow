"use client";

import clsx from "clsx";
import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { can, useAccess } from "@/lib/web/access";

/** `needs`: what the viewer's role must allow for the command to be listed (agent runs, owner-only…). */
export type Command = { id: string; group: "Pages" | "Actions" | "Project" | "View"; label: string; hint?: string; keywords?: string; needs?: Parameters<typeof can>[1]; run: () => void };

/** ⌘K palette: multi-word filter, groups kept together, ↑↓ Enter Esc. */
export function CommandPalette({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [index, setIndex] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const access = useAccess();

  const filtered = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = commands.filter((c) => {
      if (c.needs && !can(access, c.needs)) return false;
      const hay = `${c.label} ${c.group} ${c.keywords ?? ""}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    const order = ["Pages", "Actions", "Project", "View"];
    return hits.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
  }, [q, commands, access]);

  useEffect(() => setIndex(0), [q]);
  useEffect(() => {
    list.current?.querySelector(`[data-i="${index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [index]);

  const run = (c: Command | undefined) => {
    if (!c) return;
    onClose();
    setTimeout(c.run, 0);
  };

  return (
    <div className="fixed inset-0 z-[95] flex justify-center bg-black/40 pt-[14vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} className="h-fit w-[560px] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-2xl">
        <div className="flex items-center gap-2 border-b border-[var(--line)] px-4">
          <Search size={15} className="text-ink-500" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") (e.preventDefault(), setIndex((i) => Math.min(filtered.length - 1, i + 1)));
              if (e.key === "ArrowUp") (e.preventDefault(), setIndex((i) => Math.max(0, i - 1)));
              if (e.key === "Enter") run(filtered[index]);
              if (e.key === "Escape") onClose();
            }}
            placeholder="Type a command or a page…"
            className="h-12 flex-1 bg-transparent text-[14px] text-ink-100 outline-none placeholder:text-ink-500"
          />
        </div>
        <div ref={list} className="max-h-[50vh] overflow-y-auto p-1.5">
          {!filtered.length && <p className="p-4 text-center text-[12.5px] text-ink-500">No command matches.</p>}
          {filtered.map((c, i) => (
            <div key={c.id}>
              {(i === 0 || filtered[i - 1].group !== c.group) && <p className="px-2.5 pt-2 pb-1 text-[10.5px] font-semibold uppercase tracking-wide text-ink-500">{c.group}</p>}
              <button
                data-i={i}
                onMouseMove={() => setIndex(i)}
                onClick={() => run(c)}
                className={clsx("flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13px]", i === index ? "bg-spark-500/15 text-ink-100" : "text-ink-300")}>
                {c.label}
                {c.hint && <span className="font-mono text-[11px] text-ink-500">{c.hint}</span>}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

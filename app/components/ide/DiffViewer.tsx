"use client";

import clsx from "clsx";
import { Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Commit = { sha: string; message: string; date: string; stat: string; patch: string };

/** Unified diff of one commit, per file, in a portal (the hero is its own stacking context). */
export function DiffViewer({ projectId, sha, onClose }: { projectId: string; sha: string; onClose: () => void }) {
  const [c, setC] = useState<Commit | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/commits/${sha}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setC(j);
      })
      .catch((e) => setError(String(e.message)));
  }, [projectId, sha]);

  useEffect(() => {
    // Captured so Esc closes only this modal.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const files = useMemo(() => {
    if (!c) return [];
    return c.patch
      .split(/^diff --git /m)
      .filter(Boolean)
      .map((chunk) => {
        const name = chunk.match(/ b\/(.+)\n/)?.[1] ?? "file";
        const lines = chunk.split("\n").slice(chunk.indexOf("@@") >= 0 ? chunk.slice(0, chunk.indexOf("@@")).split("\n").length - 1 : 1);
        return {
          name,
          lines,
          add: lines.filter((l) => l.startsWith("+") && !l.startsWith("+++")).length,
          del: lines.filter((l) => l.startsWith("-") && !l.startsWith("---")).length,
        };
      });
  }, [c]);

  return createPortal(
    <div data-ide className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-6 backdrop-blur-sm" onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} className="flex max-h-full w-[min(900px,100%)] flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] p-4">
          {c ? (
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-ink-100">{c.message}</p>
              <p className="mt-0.5 font-mono text-[11px] text-ink-500">
                {c.sha.slice(0, 7)} · {new Date(c.date).toLocaleString()} · {files.length} file(s) · <span className="text-emerald-400">+{files.reduce((a, f) => a + f.add, 0)}</span>{" "}
                <span className="text-red-400">−{files.reduce((a, f) => a + f.del, 0)}</span>
              </p>
            </div>
          ) : (
            <span className="text-[13px] text-ink-400">{error ?? "Loading…"}</span>
          )}
          <button onClick={onClose} aria-label="Close" className="cursor-pointer text-ink-500 hover:text-ink-100">
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {!c && !error && <Loader2 className="m-6 animate-spin text-ink-500" size={18} />}
          {c && !files.length && <p className="p-4 text-[12.5px] text-ink-500">No text changes in this iteration.</p>}
          {files.map((f) => (
            <div key={f.name} className="border-b border-[var(--line)]">
              <div className="sticky top-0 flex items-center justify-between bg-[var(--panel-2)] px-4 py-1.5 font-mono text-[11.5px] text-ink-200">
                {f.name}
                <span>
                  <span className="text-emerald-400">+{f.add}</span> <span className="text-red-400">−{f.del}</span>
                </span>
              </div>
              <pre className="font-mono text-[11.5px] leading-[1.55]">
                {f.lines.map((l, i) => (
                  <div
                    key={i}
                    className={clsx(
                      "whitespace-pre px-4",
                      l.startsWith("+") && "bg-emerald-400/10 text-emerald-300",
                      l.startsWith("-") && "bg-red-400/10 text-red-300",
                      l.startsWith("@@") && "text-violet-400",
                      !/^[+\-@]/.test(l) && "text-ink-400",
                    )}>
                    {l || " "}
                  </div>
                ))}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

"use client";

import clsx from "clsx";
import { FolderOpen } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { NavEdge, ProjectState } from "@/lib/shared";
import { highlightLine } from "@/lib/web/highlight";
import { MaterialIcon } from "./FileTree";
import { FlowPanel } from "./FlowPanel";
import { GitHubSetup } from "./GitHubSetup";
import { LayoutTree, type LayoutPick } from "./LayoutTree";

export type PanelTab = "layout" | "code" | "activity";

type Props = {
  projectId: string;
  state: ProjectState;
  focused: string | null;
  tab: PanelTab;
  onTab: (t: PanelTab) => void;
  file: string | null;
  line: number | null;
  onFile: (path: string | null, line?: number | null) => void;
  /** Shows the open file in the explorer's Source tree. */
  onReveal: () => void;
  onLayoutHover: (pick: LayoutPick | null) => void;
  onLayoutPick: (pick: LayoutPick) => void;
  selectedKeys: Set<string>;
  onOpenPage: (route: string) => void;
  onFlow: (action: FlowAction) => void;
};

export type FlowAction =
  | { type: "add"; name: string; description: string; from?: string }
  | { type: "link"; from: string; to: string; label?: string }
  | { type: "unlink"; from: string; to: string }
  | { type: "delete"; route: string };

export function ActivityPanel(p: Props) {
  const tabs: { id: PanelTab; label: string }[] = [
    { id: "layout", label: p.focused ? "Layout" : "Flow" },
    { id: "code", label: "Code" },
    { id: "activity", label: "Activity" },
  ];
  return (
    <section className="flex h-full min-h-0 flex-col bg-[var(--panel)]">
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-[var(--line)] px-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => p.onTab(t.id)}
            className={clsx("cursor-pointer rounded-md px-2.5 py-1 text-[12px] font-medium", p.tab === t.id ? "bg-ink-800 text-ink-100" : "text-ink-500 hover:text-ink-200")}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        {p.tab === "activity" && <Activity state={p.state} />}
        {p.tab === "code" && <CodeView projectId={p.projectId} state={p.state} file={p.file} line={p.line} onReveal={p.onReveal} />}
        {p.tab === "layout" &&
          (p.focused || p.state.native ? (
            <LayoutTree projectId={p.projectId} state={p.state} route={p.focused} selectedKeys={p.selectedKeys} onHover={p.onLayoutHover} onPick={p.onLayoutPick} onJump={(f, l) => p.onFile(f, l)} />
          ) : (
            <FlowPanel state={p.state} onOpenPage={p.onOpenPage} onAction={p.onFlow} />
          ))}
      </div>
    </section>
  );
}

function Activity({ state }: { state: ProjectState }) {
  const ref = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const items = useMemo(() => {
    const logs = state.logs.map((l) => ({ kind: "log" as const, seq: l.seq, l }));
    const tl = state.timeline.map((t) => ({ kind: "timeline" as const, seq: t.seq, t }));
    return [...logs, ...tl].sort((a, b) => a.seq - b.seq);
  }, [state.logs, state.timeline]);

  useEffect(() => {
    const el = ref.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [items.length]);

  return (
    <div
      ref={ref}
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      }}
      className="h-full space-y-1.5 overflow-y-auto p-3">
      {(state.prompt || state.inputs.image || state.inputs.audio) && (
        <Bubble who="user">
          {state.prompt || <em className="text-ink-400">No text</em>}
          {(state.inputs.image || state.inputs.audio) && (
            <span className="ml-1 text-ink-400">
              {state.inputs.image && "+ sketch "}
              {state.inputs.audio && "+ voice memo"}
            </span>
          )}
        </Bubble>
      )}
      {items.map((it) =>
        it.kind === "log" ? (
          <p
            key={`l${it.seq}`}
            className={clsx("break-words font-mono text-[11px] leading-relaxed", it.l.level === "error" ? "text-red-400" : it.l.message.startsWith("✓") ? "text-emerald-400" : "text-ink-500")}>
            {it.l.message}
          </p>
        ) : (
          <Bubble key={`t${it.seq}`} who={it.t.kind} sub={[it.t.route && state.screens[it.t.route]?.title, it.t.kind === "user" && it.t.testId].filter(Boolean).join(" · ")}>
            {it.t.text}
          </Bubble>
        ),
      )}
    </div>
  );
}

function Bubble({ who, sub, children }: { who: "user" | "agent"; sub?: string; children: React.ReactNode }) {
  return (
    <div className={clsx("flex flex-col py-1", who === "user" ? "items-end" : "items-start")}>
      <div className={clsx("max-w-[92%] rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed", who === "user" ? "rounded-br-md bg-spark-500 text-white" : "rounded-bl-md bg-ink-800 text-ink-100")}>{children}</div>
      {sub && <span className="mt-0.5 px-1 text-[10.5px] text-ink-500">{sub}</span>}
    </div>
  );
}

const CODE = /\.(tsx?|jsx?|json|mjs|cjs|md|css|swift)$/i;
const IMAGE = /\.(png|jpe?g|gif|webp|svg)$/i;

function CodeView({ projectId, state, file, line, onReveal }: { projectId: string; state: ProjectState; file: string | null; line: number | null; onReveal: () => void }) {
  // `saved` is the file as on disk; `draft` is the editor, saved automatically a moment after you stop typing.
  const [saved, setSaved] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [status, setStatus] = useState<"saved" | "saving" | "error">("saved");
  const [error, setError] = useState<string | null>(null);
  // TypeScript errors in this file, shown at the end of their line like VS Code's Error Lens.
  const [diags, setDiags] = useState<{ line: number; message: string }[]>([]);
  const [checks, setChecks] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const dirty = useRef(false);
  dirty.current = draft != null && draft !== saved;

  useEffect(() => {
    setSaved(null);
    setDraft(null);
    setError(null);
  }, [file]);

  useEffect(() => {
    if (!file || IMAGE.test(file)) return;
    let live = true;
    fetch(`/api/projects/${projectId}/files?path=${encodeURIComponent(file)}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        if (!live) return;
        setSaved(j.content);
        // A new commit (the agent's, or ours) refreshes the file unless you're mid-edit.
        if (!dirty.current) setDraft(j.content);
      })
      .catch((e) => live && setError(String(e.message)));
    return () => {
      live = false;
    };
  }, [projectId, file, state.commits.length]);

  useEffect(() => {
    setDiags([]);
    if (!file || !/\.tsx?$/.test(file)) return;
    let live = true;
    fetch(`/api/projects/${projectId}/files?diagnostics&path=${encodeURIComponent(file)}`)
      .then((r) => r.json())
      .then((j) => live && setDiags(j.diagnostics ?? []))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [projectId, file, state.commits.length, checks]);

  // Auto-save.
  useEffect(() => {
    if (draft == null || saved == null || draft === saved || !file) return;
    const t = setTimeout(async () => {
      setStatus("saving");
      const res = await fetch(`/api/projects/${projectId}/files`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "write", path: file, content: draft }),
      }).catch(() => null);
      if (!res?.ok) {
        setStatus("error");
        setError((await res?.json().catch(() => null))?.error ?? "Couldn't save the file");
        return;
      }
      setError(null);
      setSaved(draft);
      setStatus("saved");
      setChecks((n) => n + 1);
    }, 900);
    return () => clearTimeout(t);
  }, [draft, saved, file, projectId]);

  useEffect(() => {
    if (!line || saved == null) return;
    scroller.current?.querySelector(`[data-line="${line}"]`)?.scrollIntoView({ block: "center" });
  }, [line, saved]);

  const name = file?.split("/").pop() ?? "";
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-[var(--line)] p-2">
        <div className="flex h-7 min-w-0 flex-1 items-center gap-2 px-1 font-mono text-[11.5px] text-ink-200" title={file ?? undefined}>
          {file ? (
            <>
              <button onClick={onReveal} title="Show in Source" className="flex min-w-0 cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-ink-800">
                <MaterialIcon name={name} />
                <span className="truncate">{file}</span>
              </button>
              {draft != null && (
                <span className={clsx("ml-auto shrink-0 font-sans text-[10.5px]", status === "error" ? "text-red-400" : "text-ink-500")}>
                  {status === "saving" || dirty.current ? "Saving…" : status === "error" ? "Not saved" : "Saved"}
                </span>
              )}
            </>
          ) : (
            <span className="font-sans text-ink-500">No file open</span>
          )}
        </div>
        <button
          // sparkflow opens the folder in VS Code on this computer.
          onClick={() => void fetch(`/api/projects/${projectId}/reveal?app=vscode`, { method: "POST" })}
          title="Open the project in VS Code"
          aria-label="Open the project in VS Code"
          className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-md border border-[var(--line)] hover:bg-ink-800">
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
            <path fill="#0065A9" d="M23.15 2.59 18.21.21a1.49 1.49 0 0 0-1.7.29L7.04 9.13 2.93 6.01a1 1 0 0 0-1.27.06L.33 7.28a1 1 0 0 0 0 1.48L3.9 12 .33 15.24a1 1 0 0 0 0 1.48l1.33 1.21a1 1 0 0 0 1.27.06l4.11-3.12 9.47 8.63a1.49 1.49 0 0 0 1.7.29l4.94-2.38A1.5 1.5 0 0 0 24 20.06V3.94a1.5 1.5 0 0 0-.85-1.35ZM18 17.45 10.82 12 18 6.55Z" />
          </svg>
        </button>
        <button
          onClick={() => void fetch(`/api/projects/${projectId}/reveal`, { method: "POST" })}
          title="Show the project in Finder"
          aria-label="Show the project in Finder"
          className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-md border border-[var(--line)] text-ink-200 hover:bg-ink-800">
          <FolderOpen size={14} />
        </button>
        {!state.native && <GitHubSetup projectId={projectId} appName={state.name} />}
      </div>
      <div ref={scroller} className="min-h-0 flex-1 overflow-auto">
        {!file && <p className="p-4 text-[12px] text-ink-500">Open a file from Source in the explorer, or click an element in the Layout tab. Edits save automatically.</p>}
        {file && IMAGE.test(file) && (
          <div className="p-4">
            <div className="grid place-items-center rounded-lg border border-[var(--line)] bg-[repeating-conic-gradient(#8882_0_25%,transparent_0_50%)] bg-[length:16px_16px] p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/projects/${projectId}/files?raw&path=${encodeURIComponent(file)}`} alt="" className="max-h-64 max-w-full" />
            </div>
            <code className="mt-3 block rounded bg-ink-800 px-2 py-1.5 font-mono text-[11px] text-ink-200">require(&apos;{state.native ? "./" : "@/"}
              {file}&apos;)</code>
          </div>
        )}
        {file && !IMAGE.test(file) && !CODE.test(file) && draft == null && !error && <p className="p-4 text-[12px] text-ink-500">Binary file.</p>}
        {error && <p className="px-4 py-2 text-[12px] text-red-400">{error}</p>}
        {draft != null && (
          // A transparent textarea over the highlighted lines, so errors stay on their line while typing.
          <div className="relative w-max min-w-full">
            <pre className="py-2 font-mono text-[11.5px] leading-[1.6]" aria-hidden>
              {draft.split("\n").map((l, i) => {
                const errs = diags.filter((d) => d.line === i + 1);
                return (
                  <div key={i} data-line={i + 1} className={clsx("flex", errs.length ? "bg-red-500/10" : line === i + 1 && "bg-spark-500/15")}>
                    <span className={clsx("w-10 shrink-0 select-none pr-3 text-right", errs.length ? "text-red-400" : "text-ink-600")}>{i + 1}</span>
                    <code className="whitespace-pre text-ink-200">{highlightLine(l)}</code>
                    {errs.length > 0 && <span className="select-none whitespace-pre pl-6 pr-3 text-red-400/90">{errs.map((e) => e.message).join("  ·  ")}</span>}
                  </div>
                );
              })}
            </pre>
            <textarea
              value={draft}
              wrap="off"
              spellCheck={false}
              aria-label={file ?? "Code"}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // ⌘S out of habit: it's saved anyway.
                if ((e.metaKey || e.ctrlKey) && e.key === "s") e.preventDefault();
                else if (e.key === "Tab") {
                  // Two spaces, like the project's code, instead of leaving the field.
                  e.preventDefault();
                  const t = e.currentTarget;
                  const { selectionStart: a, selectionEnd: b } = t;
                  setDraft(draft.slice(0, a) + "  " + draft.slice(b));
                  requestAnimationFrame(() => t.setSelectionRange(a + 2, a + 2));
                }
              }}
              className="absolute inset-0 resize-none overflow-hidden whitespace-pre bg-transparent py-2 pl-10 font-mono text-[11.5px] leading-[1.6] text-transparent caret-ink-100 outline-none selection:bg-spark-500/30"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export type { NavEdge };

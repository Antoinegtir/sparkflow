"use client";

import { isCloud } from "@/lib/web/backend";
import { AgentActivity } from "./AgentActivity";
import clsx from "clsx";
import { FolderOpen, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { NavEdge, ProjectState, MediaInput } from "@/lib/shared";
import { can, useAccess } from "@/lib/web/access";
import { CodeEditor } from "./CodeEditor";
import { MaterialIcon } from "./FileTree";
import { ReleaseLog } from "./ReleaseMenu";
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
  /** Adds the open file (or its selected lines) to the prompt as context. */
  onContext?: (c: { file: string; start?: number; end?: number }) => void;
};

export type FlowAction =
  | { type: "add"; name: string; description: string; from?: string; attachments?: MediaInput[] }
  | { type: "link"; from: string; to: string; label?: string }
  | { type: "unlink"; from: string; to: string }
  | { type: "delete"; route: string };

export function ActivityPanel(p: Props) {
  const access = useAccess();
  const owner = access.role === "owner";
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
        {p.tab === "activity" && (
          <div className="flex h-full min-h-0 flex-col">
            {owner && <ReleaseLog projectId={p.projectId} />}
            <div className="min-h-0 flex-1">
              <AgentActivity state={p.state} people={access.people} />
            </div>
          </div>
        )}
        {p.tab === "code" && <CodeView projectId={p.projectId} state={p.state} file={p.file} line={p.line} onReveal={p.onReveal} onFile={p.onFile} onContext={p.onContext} />}
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

const CODE = /\.(tsx?|jsx?|json|mjs|cjs|md|css|swift)$/i;
const IMAGE = /\.(png|jpe?g|gif|webp|svg)$/i;

function CodeView({
  projectId,
  state,
  file,
  line,
  onReveal,
  onFile,
  onContext,
}: {
  projectId: string;
  state: ProjectState;
  file: string | null;
  line: number | null;
  onReveal: () => void;
  onFile: (p: string, l?: number | null) => void;
  onContext?: (c: { file: string; start?: number; end?: number }) => void;
}) {
  // Lines selected in the editor: the + button adds just those.
  const [sel, setSel] = useState<{ start: number; end: number } | null>(null);
  useEffect(() => setSel(null), [file]);
  const access = useAccess();
  const owner = access.role === "owner";
  // Sparkflow in the cloud: no Finder, VS Code or GitHub CLI on that computer.
  const cloud = isCloud();
  const writable = can(access, "files.write");
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
    // Type checking runs on the owner's Mac: editors and the owner only.
    if (!file || !/\.tsx?$/.test(file) || !writable) return;
    let live = true;
    fetch(`/api/projects/${projectId}/files?diagnostics&path=${encodeURIComponent(file)}`)
      .then((r) => r.json())
      .then((j) => live && setDiags(j.diagnostics ?? []))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [projectId, file, state.commits.length, checks, writable]);

  // Auto-save.
  useEffect(() => {
    if (draft == null || saved == null || draft === saved || !file || !writable) return;
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
  }, [draft, saved, file, projectId, writable]);

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
        {owner && !cloud && (
        <button
          // sparkflow opens the folder in VS Code on this computer.
          onClick={() => void fetch(`/api/projects/${projectId}/reveal?app=vscode${file ? `&path=${encodeURIComponent(file)}` : ""}`, { method: "POST" })}
          title={file ? `Open ${name} in VS Code` : "Open the project in VS Code"}
          aria-label="Open the project in VS Code"
          className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-md border border-[var(--line)] hover:bg-ink-800">
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
            <path fill="#0065A9" d="M23.15 2.59 18.21.21a1.49 1.49 0 0 0-1.7.29L7.04 9.13 2.93 6.01a1 1 0 0 0-1.27.06L.33 7.28a1 1 0 0 0 0 1.48L3.9 12 .33 15.24a1 1 0 0 0 0 1.48l1.33 1.21a1 1 0 0 0 1.27.06l4.11-3.12 9.47 8.63a1.49 1.49 0 0 0 1.7.29l4.94-2.38A1.5 1.5 0 0 0 24 20.06V3.94a1.5 1.5 0 0 0-.85-1.35ZM18 17.45 10.82 12 18 6.55Z" />
          </svg>
        </button>
        )}
        {owner && !cloud && (
        <button
          onClick={() => void fetch(`/api/projects/${projectId}/reveal${file ? `?path=${encodeURIComponent(file)}` : ""}`, { method: "POST" })}
          title={file ? `Show ${name} in Finder` : "Show the project in Finder"}
          aria-label="Show the project in Finder"
          className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-md border border-[var(--line)] text-ink-200 hover:bg-ink-800">
          <FolderOpen size={14} />
        </button>
        )}
        {owner && !state.native && !cloud && <GitHubSetup projectId={projectId} appName={state.name} />}
      </div>
      <div ref={scroller} className={clsx("relative min-h-0 flex-1", draft != null && file ? "overflow-hidden" : "overflow-auto")}>
        {file && onContext && (
          // Floating, like picking elements of a page: the file (or its selected lines) joins the prompt.
          <button
            type="button"
            onClick={() => onContext({ file, ...(sel ? { start: sel.start, end: sel.end } : {}) })}
            title={sel ? `Add lines ${sel.start}–${sel.end} to the prompt` : `Add ${name} to the prompt`}
            className="absolute right-4 bottom-4 z-20 flex cursor-pointer items-center gap-1.5 rounded-full bg-spark-500 py-2 pr-3.5 pl-2.5 text-[12.5px] font-medium text-white shadow-xl shadow-black/40 hover:bg-spark-400">
            <Plus size={15} strokeWidth={2.5} />
            {sel ? `Lines ${sel.start}${sel.end !== sel.start ? `–${sel.end}` : ""}` : "Add to prompt"}
          </button>
        )}
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
        {draft != null && file && (
          <CodeEditor projectId={projectId} file={file} value={draft} line={line} diagnostics={diags} onChange={setDraft} onOpenFile={(p, l) => onFile(p, l)} onSelection={setSel} />
        )}
      </div>
    </div>
  );
}

export type { NavEdge };

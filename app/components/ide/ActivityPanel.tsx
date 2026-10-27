"use client";

import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import type { NavEdge, ProjectState } from "@/lib/shared";
import { highlightLine } from "@/lib/web/highlight";
import { FlowPanel } from "./FlowPanel";
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
        {p.tab === "code" && <CodeView projectId={p.projectId} state={p.state} file={p.file} line={p.line} onFile={p.onFile} />}
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

function CodeView({ projectId, state, file, line, onFile }: { projectId: string; state: ProjectState; file: string | null; line: number | null; onFile: (p: string | null, l?: number | null) => void }) {
  const [files, setFiles] = useState<string[]>([]);
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/files`)
      .then((r) => r.json())
      .then((j) => setFiles((j.files as string[]).filter((f) => /\.(tsx?|json)$/.test(f) && !f.startsWith("components/sparkflow"))))
      .catch(() => {});
  }, [projectId, state.commits.length]);

  useEffect(() => {
    setContent(null);
    setError(null);
    if (!file || IMAGE.test(file)) return;
    fetch(`/api/projects/${projectId}/files?path=${encodeURIComponent(file)}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setContent(j.content);
      })
      .catch((e) => setError(String(e.message)));
  }, [projectId, file, state.commits.length]);

  useEffect(() => {
    if (!line || !content) return;
    scroller.current?.querySelector(`[data-line="${line}"]`)?.scrollIntoView({ block: "center" });
  }, [line, content]);

  const lines = content?.split("\n") ?? [];
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-[var(--line)] p-2">
        <select
          value={file ?? ""}
          onChange={(e) => onFile(e.target.value || null)}
          className="w-full cursor-pointer rounded-md border border-[var(--line)] bg-[var(--panel-2)] px-2 py-1 font-mono text-[11.5px] text-ink-200 outline-none">
          <option value="">Choose a file…</option>
          {file && !files.includes(file) && <option value={file}>{file}</option>}
          {files.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>
      <div ref={scroller} className="min-h-0 flex-1 overflow-auto">
        {!file && <p className="p-4 text-[12px] text-ink-500">Read-only view of the project&apos;s code. Pick a file, or click an element in the Layout tab.</p>}
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
        {file && !IMAGE.test(file) && !CODE.test(file) && !content && !error && <p className="p-4 text-[12px] text-ink-500">Binary file.</p>}
        {error && <p className="p-4 text-[12px] text-red-400">{error}</p>}
        {content != null && (
          <pre className="py-2 font-mono text-[11.5px] leading-[1.6]">
            {lines.map((l, i) => (
              <div key={i} data-line={i + 1} className={clsx("flex", line === i + 1 && "bg-spark-500/15")}>
                <span className="w-10 shrink-0 select-none pr-3 text-right text-ink-600">{i + 1}</span>
                <code className="whitespace-pre text-ink-200">{highlightLine(l)}</code>
              </div>
            ))}
          </pre>
        )}
      </div>
    </div>
  );
}

export type { NavEdge };

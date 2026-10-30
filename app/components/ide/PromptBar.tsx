"use client";

import clsx from "clsx";
import type { SimFind } from "./LayoutTree";
import { ArrowUp, Crosshair, ImagePlus, LayoutGrid, Loader2, Mic, Square, X } from "lucide-react";
import { MaterialIcon } from "./FileTree";
import { useEffect, useRef, useState } from "react";
import type { MediaInput, Phase, ProjectState } from "@/lib/shared";
import { can, useAccess } from "@/lib/web/access";
import { blobToWav, imageToInput, startRecording } from "@/lib/web/media";

export type Selection = {
  key: string;
  testId: string;
  label: string;
  text?: string;
  area?: { x: number; y: number; width: number; height: number };
  file?: string;
  line?: number;
  layout?: boolean;
  /** Picked in the Layout tree: how the live Simulator finds it. */
  find?: SimFind;
  /** Elements without a testID are found in the app by what they contain. */
  anchors?: { ids: string[]; texts: string[]; labels?: string[]; climb?: boolean; control?: boolean };
};

const PHASES: { id: Phase; label: string }[] = [
  { id: "sandbox", label: "Sandbox" },
  { id: "planner", label: "Planner" },
  { id: "builder", label: "Builder" },
  { id: "verifier", label: "Verifier" },
];

function PhasePipeline({ state, onRetry }: { state: ProjectState; onRetry: () => void }) {
  const running = state.status === "running";
  const idx = PHASES.findIndex((p) => p.id === state.phase);
  const screen = state.phaseRoute ? state.screens[state.phaseRoute]?.title : undefined;
  if (!running) {
    const tone = state.status === "failed" ? "text-red-400" : state.status === "stopped" ? "text-amber-400" : "text-emerald-400";
    return (
      <div className={clsx("flex items-center gap-1.5 text-[11.5px]", tone)}>
        <span className={clsx("size-1.5 rounded-full", state.status === "failed" ? "bg-red-400" : state.status === "stopped" ? "bg-amber-400" : "bg-emerald-400")} />
        <span className="truncate">{state.status === "done" || state.status === "idle" ? "Ready" : (state.statusMessage ?? state.status)}</span>
        {/* A failed run (a generation, or the demo app's build) starts again from where it stopped. */}
        {state.status === "failed" && (
          <button onClick={onRetry} className="shrink-0 cursor-pointer rounded-md px-1.5 py-0.5 text-ink-300 hover:bg-ink-800 hover:text-ink-100">
            Retry
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="flex min-w-0 items-center gap-1 text-[11.5px] text-ink-500">
      {PHASES.map((p, i) => (
        <span key={p.id} className="flex items-center gap-1">
          {i > 0 && <span className="text-ink-700">→</span>}
          <span className={clsx(i === idx && "animate-pulse-soft font-medium text-spark-400", i < idx && "text-ink-300")}>{p.label}</span>
        </span>
      ))}
      {(screen || state.phaseDetail) && (
        <span className="truncate text-ink-400">
          · {screen}
          {screen && state.phaseDetail && state.phaseDetail !== screen ? " — " : ""}
          {state.phaseDetail !== screen ? state.phaseDetail : ""}
        </span>
      )}
    </div>
  );
}

type Props = {
  state: ProjectState;
  focusedTitle?: string;
  selections: Selection[];
  inspect: boolean;
  canInspect: boolean;
  onInspect: (on: boolean) => void;
  onRemoveSelection: (key: string) => void;
  onAllPages: () => void;
  onSend: (text: string, image?: MediaInput, audio?: MediaInput) => Promise<boolean>;
  onStop: () => void;
};

/** Floating bar at the bottom: pipeline, scope chips, text + image + voice, inspect toggle, send/stop. */
export function PromptBar(p: Props) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<{ input: MediaInput; url: string } | null>(null);
  const [audio, setAudio] = useState<{ input: MediaInput; seconds: number } | null>(null);
  const [rec, setRec] = useState<{ stop: () => Promise<Blob>; started: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [sending, setSending] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const running = p.state.status === "running";
  const access = useAccess();

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(140, el.scrollHeight)}px`;
  }, [text]);

  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - rec.started) / 1000)), 250);
    return () => clearInterval(t);
  }, [rec]);

  const attach = async (f?: File | null) => {
    if (f?.type.startsWith("image/")) setImage({ input: await imageToInput(f), url: URL.createObjectURL(f) });
  };

  const send = async () => {
    if (running || sending || (!text.trim() && !audio)) return;
    setSending(true);
    const ok = await p.onSend(text, image?.input, audio?.input);
    setSending(false);
    if (ok) {
      setText("");
      setImage(null);
      setAudio(null);
    }
  };

  // Roles that can't run the agent get a slim bar saying what they can do instead.
  if (!can(access, "agent"))
    return (
      <div data-prompt-bar className="pointer-events-auto absolute bottom-4 left-1/2 z-40 -translate-x-1/2">
        <div className={clsx("flex items-center gap-3 rounded-full border bg-[var(--panel)]/95 px-4 py-2 text-[12.5px] text-ink-300 shadow-xl backdrop-blur-xl", running ? "agent-glow border-transparent" : "border-[var(--line)]")}>
          {running && <Loader2 size={13} className="animate-spin text-spark-400" />}
          {can(access, "comment") ? (
            <span>
              You can comment: press <kbd className="rounded border border-[var(--line)] px-1 font-mono text-[11px]">C</kbd>
            </span>
          ) : (
            <span>View only</span>
          )}
        </div>
      </div>
    );

  const placeholder = running
    ? "The agent is working…"
    : p.selections.length > 1
      ? `What should change about these ${p.selections.length} elements?`
      : p.selections.length === 1
        ? `What should change about "${p.selections[0].text?.slice(0, 40) || p.selections[0].label}"?`
        : p.focusedTitle
          ? `Change ${p.focusedTitle}… e.g. make the header bigger and blue`
          : "Ask for a change across the app, or click a page to focus it…";

  return (
    <div data-prompt-bar className="pointer-events-auto absolute bottom-4 left-1/2 z-40 w-[min(760px,calc(100%-32px))] -translate-x-1/2">
      <div className={clsx("rounded-2xl border bg-[var(--panel)]/95 p-2.5 shadow-[0_20px_60px_-20px_rgba(0,0,0,.6)] backdrop-blur-xl transition-colors", running ? "agent-glow border-transparent" : "border-[var(--line)]")}>
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <PhasePipeline state={p.state} onRetry={() => void p.onSend("Retry")} />
          {p.focusedTitle && (
            <button onClick={p.onAllPages} className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] text-ink-400 hover:bg-ink-800 hover:text-ink-100">
              <LayoutGrid size={12} /> All pages
            </button>
          )}
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-1.5 px-1">
          <span className="rounded-md bg-ink-800 px-2 py-0.5 text-[11px] text-ink-300">{p.focusedTitle ? `Page · ${p.focusedTitle}` : "Whole app"}</span>
          {p.selections.map((s, i) => (
            <span key={s.key} className="flex max-w-[260px] items-center gap-1 rounded-md border border-spark-500/40 bg-spark-500/10 px-1.5 py-0.5 text-[11px] text-ink-200">
              <span className="grid size-4 place-items-center rounded bg-spark-500 text-[9px] font-bold text-white">{i + 1}</span>
              {/* A file added as context (Code view, imported asset): its kind, then its name (and lines). */}
              {s.key.startsWith("file:") && s.file && <MaterialIcon name={s.file.split("/").pop() ?? s.file} />}
              <span className="truncate font-mono">{s.key.startsWith("file:") ? s.label : s.file ? `${s.file.split("/").pop()}${s.line ? `:${s.line}` : ""}` : s.label}</span>
              {s.text && <span className="truncate text-ink-400">“{s.text.slice(0, 24)}”</span>}
              <button aria-label="Remove" onClick={() => p.onRemoveSelection(s.key)} className="cursor-pointer text-ink-400 hover:text-ink-100">
                <X size={11} />
              </button>
            </span>
          ))}
          {p.inspect && <span className="text-[11px] text-spark-400">Click elements to add them · click again to remove · Esc when done</span>}
          {image && (
            <span className="flex items-center gap-1 rounded-md border border-[var(--line)] p-0.5 pr-1.5 text-[11px] text-ink-300">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt="" className="size-6 rounded object-cover" /> image
              <button aria-label="Remove image" onClick={() => setImage(null)} className="cursor-pointer text-ink-400 hover:text-ink-100">
                <X size={11} />
              </button>
            </span>
          )}
          {audio && (
            <span className="flex items-center gap-1 rounded-md border border-[var(--line)] px-1.5 py-0.5 text-[11px] text-ink-300">
              <Mic size={11} /> Voice memo · {audio.seconds}s
              <button aria-label="Remove voice memo" onClick={() => setAudio(null)} className="cursor-pointer text-ink-400 hover:text-ink-100">
                <X size={11} />
              </button>
            </span>
          )}
        </div>
        <div className="flex items-end gap-1.5">
          <textarea
            ref={area}
            data-prompt
            rows={1}
            value={text}
            disabled={running}
            placeholder={placeholder}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            onPaste={(e) => {
              const img = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
              if (img) {
                e.preventDefault();
                void attach(img);
              }
            }}
            className="max-h-[140px] min-h-[36px] flex-1 resize-none bg-transparent px-2 py-2 text-[14px] text-ink-100 outline-none placeholder:text-ink-500 disabled:opacity-60"
          />
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => void attach(e.target.files?.[0])} />
          <IconBtn label="Attach an image" onClick={() => file.current?.click()} disabled={running}>
            <ImagePlus size={16} />
          </IconBtn>
          <IconBtn
            label={rec ? "Stop recording" : "Record a voice memo"}
            disabled={running}
            active={!!rec}
            onClick={async () => {
              if (rec) {
                const blob = await rec.stop();
                setRec(null);
                setAudio({ input: await blobToWav(blob), seconds: Math.max(1, elapsed) });
              } else {
                try {
                  const r = await startRecording();
                  setElapsed(0);
                  setRec({ stop: r.stop, started: Date.now() });
                } catch {}
              }
            }}>
            {rec ? <span className="text-[11px] font-semibold text-red-400">■ {elapsed}s</span> : <Mic size={16} />}
          </IconBtn>
          {p.canInspect && (
            <IconBtn label="Point at elements" active={p.inspect} onClick={() => p.onInspect(!p.inspect)} disabled={running}>
              <Crosshair size={16} />
            </IconBtn>
          )}
          {running ? (
            <button onClick={p.onStop} aria-label="Stop the agent" className="grid size-9 cursor-pointer place-items-center rounded-xl bg-ink-800 text-ink-100 hover:bg-ink-700">
              <Square size={13} className="fill-current" />
            </button>
          ) : (
            <button
              onClick={() => void send()}
              disabled={sending || (!text.trim() && !audio)}
              aria-label="Send"
              className="grid size-9 cursor-pointer place-items-center rounded-xl bg-spark-500 text-white disabled:cursor-default disabled:bg-ink-800 disabled:text-ink-500">
              {sending ? <Loader2 size={15} className="animate-spin" /> : <ArrowUp size={16} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function IconBtn({ children, label, onClick, disabled, active }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "grid h-9 min-w-9 cursor-pointer place-items-center rounded-xl px-1 text-ink-400 transition hover:bg-ink-800 hover:text-ink-100 disabled:opacity-40",
        active && "bg-spark-500/15 text-spark-400",
      )}>
      {children}
    </button>
  );
}

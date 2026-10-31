"use client";

import { AsciiSpark, SPARK_BEAT_MS } from "../AsciiLoader";
import clsx from "clsx";
import {
  Box,
  Check,
  ChevronDown,
  Eye,
  FilePen,
  FileSearch,
  FileText,
  Flag,
  FolderTree,
  GitCommitHorizontal,
  Hammer,
  ImageIcon,
  type LucideIcon,
  Map as MapIcon,
  MousePointerClick,
  Play,
  RotateCcw,
  Scan,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Phase, ProjectState } from "@/lib/shared";
import { DEFAULT_PHASE_MODEL, modelName, PHASE_ROLE, TOOL_MODEL } from "@/lib/shared/models";
import type { Person } from "@/lib/shared/share";
import { MetaLogo } from "../MetaLogo";
import { Avatar } from "./Avatar";

/**
 * The agent loop, made visible: a diagram of the loop (plan, build, verify, fix) with the Meta model at
 * each step, then every request as a run: its steps on a rail, each with its model, the tools the agent
 * used, the verifier's verdicts (with the screenshot it judged), and the fixes they triggered.
 */

type Step = ProjectState["steps"][number];
type Check_ = ProjectState["checks"][number];
type Log = ProjectState["logs"][number];
type Entry =
  | { kind: "user"; seq: number; text: string; route?: string; testId?: string; by?: string }
  | { kind: "agent"; seq: number; text: string; route?: string }
  | { kind: "step"; seq: number; s: Step }
  | { kind: "log"; seq: number; l: Log }
  | { kind: "check"; seq: number; c: Check_ };
type Block = { step: Step | null; items: (Extract<Entry, { kind: "log" }> | Extract<Entry, { kind: "check" }>)[] };
type Agent = Extract<Entry, { kind: "agent" }>;
/** A request and what followed, in order: steps (grouped into blocks) and the agent's messages. */
type Run = { user: Extract<Entry, { kind: "user" }> | null; parts: (Block | Agent)[] };
const isBlock = (x: Block | Agent): x is Block => "items" in x;

const PHASE_LOOK: Record<string, { label: string; icon: LucideIcon; tone: string }> = {
  sandbox: { label: "Sandbox", icon: Box, tone: "text-ink-300 bg-ink-700" },
  planner: { label: "Plan", icon: MapIcon, tone: "text-violet-200 bg-violet-500/25" },
  builder: { label: "Build", icon: Hammer, tone: "text-sky-200 bg-sky-500/25" },
  verifier: { label: "Verify", icon: ScanSearch, tone: "text-emerald-200 bg-emerald-500/25" },
  fix: { label: "Fix", icon: RotateCcw, tone: "text-amber-200 bg-amber-500/25" },
  sam: { label: "Segment", icon: Scan, tone: "text-fuchsia-200 bg-fuchsia-500/25" },
};

const TOOL_ICON: Record<string, LucideIcon> = {
  list_files: FolderTree,
  read_file: FileSearch,
  write_file: FileText,
  apply_patch: FilePen,
  delete_file: Trash2,
  run: Terminal,
  typecheck: ShieldCheck,
  start_app: Play,
  app_logs: Terminal,
  screenshot: Eye,
  ui_tree: FolderTree,
  interact: MousePointerClick,
  generate_image: ImageIcon,
  segment: Scan,
  commit: GitCommitHorizontal,
  skill: Sparkles,
  finish: Flag,
};

const stepKind = (s: Step) => (s.model === "sam-3.1" ? "sam" : s.phase === "builder" && /^fix\b/i.test(s.detail ?? "") ? "fix" : s.phase);

/** "🔧 read_file {"path":"app/x.tsx"}" → the tool and the one argument worth showing. */
function parseTool(message: string): { name: string; arg: string } | null {
  const m = /^🔧 (\w+)\s*(.*)$/s.exec(message);
  if (!m) return null;
  let arg = m[2].trim();
  try {
    const j = JSON.parse(arg);
    arg = j.path ?? j.dir ?? j.command ?? j.route ?? j.prompt ?? j.summary ?? j.name ?? (Object.keys(j).length ? JSON.stringify(j) : "");
  } catch {
    const p = /"(?:path|dir|command|route|summary)":"((?:[^"\\]|\\.)*)/.exec(arg);
    if (p) arg = p[1].replace(/\\"/g, '"');
  }
  return { name: m[1], arg: String(arg) };
}

// Log lines the run view says better on its own (the verdicts as check rows, the models as chips).
const REDUNDANT = /^([✓✗] .*criteria pass|Planning with |Segmenting the sketch)/;

function ModelChip({ id, small }: { id?: string | null; small?: boolean }) {
  const name = modelName(id);
  if (!name) return null;
  return (
    <span className={clsx("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-[#0081FB]/35 bg-[#0081FB]/10 font-medium text-[#7cb8ff]", small ? "px-1.5 py-px text-[9.5px]" : "px-2 py-0.5 text-[10.5px]")}>
      <MetaLogo className={small ? "size-2.5" : "size-3"} /> {name}
    </span>
  );
}

/**
 * The loop as a diagram, top to bottom (it fits a narrow panel): plan, build, verify, each with the Meta
 * model doing it, and a bracket from verify back to build for the pages that fail their review.
 */
function LoopDiagram({ state }: { state: ProjectState }) {
  const running = state.status === "running";
  const fixing = running && state.phase === "builder" && /^fix\b/i.test(state.phaseDetail ?? "");
  const active = running ? (fixing ? "fix" : state.phase) : null;
  const model = (p: Phase) => {
    // The latest model each step used in this project (else the default one).
    const last = [...(state.steps ?? [])].reverse().find((s) => s.phase === p && s.model && s.model !== "sam-3.1");
    return last?.model ?? DEFAULT_PHASE_MODEL[p];
  };
  const usedSam = (state.steps ?? []).some((s) => s.model === "sam-3.1");
  const usedImage = (state.logs ?? []).some((l) => l.message.startsWith("🔧 generate_image"));
  const checks = state.checks ?? [];
  const fixes = (state.steps ?? []).filter((s) => stepKind(s) === "fix").length;
  const passed = checks.filter((c) => c.ok).length;
  const row = (id: "planner" | "builder" | "verifier", sub: string) => {
    const look = PHASE_LOOK[id];
    const on = active === id || (id === "builder" && active === "fix");
    return (
      <div title={PHASE_ROLE[id]} className={clsx("relative flex items-center gap-2.5 rounded-xl border px-2.5 py-2 transition", on ? "agent-glow border-transparent bg-spark-500/5" : "border-[var(--line)] bg-[var(--panel-2)]")}>
        <span className={clsx("grid size-7 shrink-0 place-items-center rounded-lg", look.tone, on && "animate-pulse-soft")}>
          <look.icon size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-medium leading-tight text-ink-100">{id === "builder" && active === "fix" ? "Fix" : look.label}</p>
          <p className="truncate text-[10.5px] leading-tight text-ink-500">{sub}</p>
        </div>
        <ModelChip id={model(id)} small />
      </div>
    );
  };
  const link = <div className="ml-[22px] h-2 w-px bg-[var(--line)]" />;
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-ink-400 uppercase">
          <MetaLogo className="size-3.5" /> Agent loop
        </p>
        <span className="flex items-center gap-2 text-[10.5px] text-ink-500">
          {checks.length > 0 && (
            <span className="text-emerald-400/90">
              {passed}/{checks.length} reviews passed
            </span>
          )}
          {fixes > 0 && <span className="text-amber-300/90">{fixes} fix{fixes > 1 ? "es" : ""}</span>}
          {state.usage?.costUsd ? <span>${state.usage.costUsd.toFixed(2)}</span> : null}
        </span>
      </div>
      <div className="relative pr-7">
        {row("planner", "Pages & links")}
        {link}
        {row("builder", "React Native code")}
        {link}
        {row("verifier", "Screenshots & criteria")}
        {/* The way back: a page that fails its review goes to the builder again, with its screenshot. */}
        <div
          title="A page that fails its criteria goes back to the builder with the rejected screenshot, then is reviewed again"
          className={clsx("absolute right-0 rounded-r-xl border-y border-r border-dashed", active === "fix" ? "border-amber-400" : "border-amber-500/50")}
          style={{ top: "calc(50% - 4px)", bottom: 18, width: 20 }}>
          <span className="absolute top-1/2 -right-[9px] grid size-[18px] -translate-y-1/2 place-items-center rounded-full bg-[var(--panel)] text-amber-300">
            <RotateCcw size={11} className={clsx(active === "fix" && "animate-spin")} />
          </span>
        </div>
      </div>
      {(usedSam || usedImage) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-[var(--line)] pt-2 text-[10.5px] text-ink-500">
          Also:
          {usedSam && (
            <span className="flex items-center gap-1">
              <ModelChip id="sam-3.1" small /> reads the sketch
            </span>
          )}
          {usedImage && (
            <span className="flex items-center gap-1">
              <ModelChip id="muse-image-1.0" small /> draws images
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function ToolRow({ name, arg, error }: { name: string; arg: string; error?: string }) {
  const Icon = TOOL_ICON[name] ?? Wrench;
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-1.5 text-[11px]">
        <Icon size={11} className={clsx("shrink-0", error ? "text-red-400" : "text-ink-500")} />
        <span className="shrink-0 font-mono text-ink-300">{name}</span>
        {arg && <span className="truncate font-mono text-ink-500">{arg}</span>}
        {TOOL_MODEL[name] && <ModelChip id={TOOL_MODEL[name]} small />}
      </div>
      {error && <p className="ml-4 break-words font-mono text-[10.5px] leading-snug text-red-400/90">{error}</p>}
    </div>
  );
}

function CheckRow({ c, state }: { c: Check_; state: ProjectState }) {
  const s = state.screens[c.route];
  // The screenshot the verifier judged: the page's capture from just before its verdict.
  const shot = s?.history.filter((h) => h.ts <= c.ts).at(-1)?.url;
  return (
    <div className={clsx("flex items-center gap-2 rounded-lg border px-2 py-1.5", c.ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5")}>
      {shot && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shot} alt="" className="h-10 w-[22px] shrink-0 rounded-[3px] object-cover object-top ring-1 ring-white/10" />
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-ink-100">
          {c.ok ? <Check size={12} className="text-emerald-400" /> : <X size={12} className="text-red-400" />}
          <span className="truncate">{s?.title ?? c.route}</span>
        </p>
        <p className="text-[10.5px] text-ink-500">
          {c.passed}/{c.total} criteria{c.defects ? ` · ${c.defects} defect${c.defects > 1 ? "s" : ""}` : ""} · review {c.attempt}
        </p>
      </div>
      <span className={clsx("shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium", c.ok ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300")}>{c.ok ? "Pass" : "Fix"}</span>
    </div>
  );
}

const TOOLS_SHOWN = 6;

function StepBlock({ b, state, live, last }: { b: Block; state: ProjectState; live: boolean; last: boolean }) {
  const [open, setOpen] = useState(false);
  const kind = b.step ? stepKind(b.step) : null;
  const look = kind ? (PHASE_LOOK[kind] ?? PHASE_LOOK.sandbox) : null;
  const page = b.step?.route ? state.screens[b.step.route]?.title : undefined;
  // Tool calls, with the error line that follows one attached to it.
  const rows: ({ t: "tool"; name: string; arg: string; error?: string } | { t: "log"; l: Log } | { t: "check"; c: Check_ })[] = [];
  for (const it of b.items) {
    if (it.kind === "check") rows.push({ t: "check", c: it.c });
    else {
      const tool = parseTool(it.l.message);
      if (tool) rows.push({ t: "tool", ...tool });
      else if (/^↳/.test(it.l.message) && rows.at(-1)?.t === "tool") (rows.at(-1) as { error?: string }).error = it.l.message.replace(/^↳\s*/, "");
      else if (!REDUNDANT.test(it.l.message)) rows.push({ t: "log", l: it.l });
    }
  }
  const tools = rows.filter((r) => r.t === "tool").length;
  const hidden = !open && tools > TOOLS_SHOWN ? tools - TOOLS_SHOWN : 0;
  let seen = 0;
  return (
    <div className="relative flex gap-2.5">
      {/* The rail: one node per step, joined down the run. */}
      <div className="flex flex-col items-center">
        <span className={clsx("grid size-6 shrink-0 place-items-center rounded-lg", look?.tone ?? "bg-ink-800 text-ink-400", live && "animate-pulse-soft ring-2 ring-spark-500/50")}>
          {look ? <look.icon size={12} /> : <Wrench size={12} />}
        </span>
        {!last && <span className="w-px flex-1 bg-[var(--line)]" />}
      </div>
      <div className="min-w-0 flex-1 space-y-1 pb-3">
        {b.step && (
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 pt-0.5">
            <span className="text-[12px] font-medium text-ink-100">{kind === "fix" ? "Fix after review" : look?.label}</span>
            {(page || b.step.detail) && <span className="text-[11px] text-ink-400">{[page, b.step.detail !== page ? b.step.detail : null].filter(Boolean).join(" · ")}</span>}
            {/* Older runs didn't record the model: the one that step always uses. */}
            <ModelChip id={b.step.model ?? DEFAULT_PHASE_MODEL[b.step.phase]} />
          </div>
        )}
        {rows.map((r, i) => {
          if (r.t === "check") return <CheckRow key={i} c={r.c} state={state} />;
          if (r.t === "log")
            return (
              <p key={i} className={clsx("break-words font-mono text-[10.5px] leading-snug", r.l.level === "error" ? "text-red-400" : "text-ink-500")}>
                {r.l.message}
              </p>
            );
          seen++;
          if (hidden && seen > TOOLS_SHOWN) return null;
          return <ToolRow key={i} name={r.name} arg={r.arg} error={r.error} />;
        })}
        {tools > TOOLS_SHOWN && (
          <button onClick={() => setOpen((o) => !o)} className="flex cursor-pointer items-center gap-1 text-[10.5px] text-spark-400 hover:text-spark-300">
            <ChevronDown size={11} className={clsx("transition", open && "rotate-180")} /> {open ? "Fewer" : `${hidden} more tool calls`}
          </button>
        )}
      </div>
    </div>
  );
}

function Bubble({ who, sub, by, people, children }: { who: "user" | "agent"; sub?: string; by?: string; people?: Record<string, Person>; children: React.ReactNode }) {
  return (
    <div className={clsx("flex flex-col py-1", who === "user" ? "items-end" : "items-start")}>
      {by && (
        <span className="mb-0.5 flex items-center gap-1 px-1 text-[10.5px] text-ink-500">
          {people?.[by]?.name ?? "Someone"} <Avatar person={people?.[by]} seed={by} size={14} />
        </span>
      )}
      <div className={clsx("max-w-[92%] rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed", who === "user" ? "rounded-br-md bg-spark-500 text-white" : "rounded-bl-md bg-ink-800 text-ink-100")}>{children}</div>
      {sub && <span className="mt-0.5 px-1 text-[10.5px] text-ink-500">{sub}</span>}
    </div>
  );
}

export function AgentActivity({ state, people }: { state: ProjectState; people: Record<string, Person> }) {
  // Avatars only once the app is shared with someone: alone, every prompt is yours.
  const shared = Object.keys(people).some((k) => k !== "owner");
  const ref = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  // "Up to date": three beats of the sparkle when the agent is done (and on opening), then it fades away.
  const idle = state.status !== "running";
  const [caughtUp, setCaughtUp] = useState(idle);
  useEffect(() => {
    if (!idle) return setCaughtUp(false);
    setCaughtUp(true);
    const t = setTimeout(() => setCaughtUp(false), 3 * SPARK_BEAT_MS);
    return () => clearTimeout(t);
  }, [idle]);
  const runs = useMemo(() => {
    const entries: Entry[] = [
      ...state.timeline.map((t) => (t.kind === "user" ? { kind: "user" as const, seq: t.seq, text: t.text, route: t.route, testId: t.testId, by: t.by } : { kind: "agent" as const, seq: t.seq, text: t.text, route: t.route })),
      ...(state.steps ?? []).map((s) => ({ kind: "step" as const, seq: s.seq, s })),
      ...state.logs.map((l) => ({ kind: "log" as const, seq: l.seq, l })),
      ...(state.checks ?? []).map((c) => ({ kind: "check" as const, seq: c.seq, c })),
    ].sort((a, b) => a.seq - b.seq);
    const out: Run[] = [{ user: null, parts: [] }];
    for (const e of entries) {
      const run = out.at(-1)!;
      const lastBlock = () => {
        const last = run.parts.at(-1);
        return last && isBlock(last) ? last : null;
      };
      if (e.kind === "user") out.push({ user: e, parts: [] });
      else if (e.kind === "agent") run.parts.push(e);
      else if (e.kind === "step") {
        // A step repeated (the same phase, page and detail) stays one block.
        const prev = lastBlock()?.step;
        if (prev && prev.phase === e.s.phase && prev.route === e.s.route && prev.detail === e.s.detail && prev.model === e.s.model) continue;
        run.parts.push({ step: e.s, items: [] });
      } else {
        const b = lastBlock() ?? (run.parts.push({ step: null, items: [] }), lastBlock()!);
        b.items.push(e);
      }
    }
    return out.filter((r) => r.user || r.parts.length);
  }, [state.timeline, state.steps, state.logs, state.checks]);

  const count = state.logs.length + (state.steps?.length ?? 0) + (state.checks?.length ?? 0) + state.timeline.length;
  useEffect(() => {
    const el = ref.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [count]);

  const running = state.status === "running";
  return (
    <div
      ref={ref}
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      }}
      className="h-full space-y-3 overflow-y-auto p-3">
      <LoopDiagram state={state} />
      {(state.prompt || state.inputs.image || state.inputs.audio) && (
        <Bubble who="user">
          {state.prompt || <em className="text-white/70">No text</em>}
          {(state.inputs.image || state.inputs.audio) && (
            <span className="ml-1 text-white/70">
              {state.inputs.image && "+ sketch "}
              {state.inputs.audio && "+ voice memo"}
            </span>
          )}
        </Bubble>
      )}
      {runs.map((r, ri) => {
        const lastRun = ri === runs.length - 1;
        return (
          <div key={r.user?.seq ?? `r${ri}`} className="space-y-2">
            {r.user && (
              <Bubble
                who="user"
                by={shared ? (r.user.by ?? "owner") : undefined}
                people={people}
                sub={[r.user.route && state.screens[r.user.route]?.title, r.user.testId].filter(Boolean).join(" · ")}>
                {r.user.text}
              </Bubble>
            )}
            {/* Consecutive steps share one panel; the agent's messages sit between them, where they came. */}
            {r.parts
              .reduce<(Block[] | Agent)[]>((acc, part) => {
                const last = acc.at(-1);
                if (isBlock(part)) Array.isArray(last) ? last.push(part) : acc.push([part]);
                else acc.push(part);
                return acc;
              }, [])
              .map((g, gi, groups) =>
                Array.isArray(g) ? (
                  <div key={g[0].step?.seq ?? `g${gi}`} className="rounded-2xl border border-[var(--line)] bg-[var(--panel)]/60 px-3 pt-3">
                    {g.map((b, bi) => (
                      <StepBlock key={b.step?.seq ?? `b${bi}`} b={b} state={state} live={running && lastRun && gi === groups.length - 1 && bi === g.length - 1} last={bi === g.length - 1} />
                    ))}
                  </div>
                ) : (
                  <Bubble key={g.seq} who="agent" sub={g.route ? state.screens[g.route]?.title : undefined}>
                    {g.text}
                  </Bubble>
                ),
              )}
          </div>
        );
      })}
      {/* Caught up: a small ASCII star under the last message for three beats (not while the agent works). */}
      {idle && (
        <div className={clsx("flex flex-col items-center gap-1 pt-3 text-[11px] text-ink-500 transition-opacity", caughtUp ? "opacity-100" : "opacity-0 duration-300")}>
          <AsciiSpark neon className="text-[11px] leading-none" />
          You&apos;re up to date
        </div>
      )}
      {/* Room under the last item (a tenth of the panel), so the newest sits above the bottom edge. */}
      <div aria-hidden className="h-[10%] shrink-0" />
    </div>
  );
}

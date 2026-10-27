"use client";

import "@xyflow/react/dist/style.css";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps,
} from "@xyflow/react";
import clsx from "clsx";
import { Sparkles } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NavEdge, ScreenState } from "@/lib/shared";
import { edgeSides, layoutScreens, NODE_W, PHONE_H, PHONE_W } from "@/lib/web/layout";
import { CupertinoSpinner, deviceById, DeviceMockup, PhoneFrame, StatusPill } from "./ui";

export type PhoneData = { screen: ScreenState; hidden: boolean; scanning: boolean; ipad: boolean; native: boolean; dark: boolean; device?: string; onOpen: (route: string) => void };

const SIDES = { top: Position.Top, bottom: Position.Bottom, left: Position.Left, right: Position.Right };

/** One page on the canvas: title, frame (click to focus), status and scores. */
export const PhoneNode = memo(function PhoneNode({ data }: NodeProps<Node<PhoneData>>) {
  const s = data.screen;
  const busy = s.status === "building" || s.status === "verifying";
  const h = data.ipad ? Math.round(PHONE_W * 1.33) : PHONE_H;
  const criteria = s.verdict?.criteria;
  return (
    <div className="flex flex-col items-center gap-2" style={{ width: NODE_W }} data-phone={s.route}>
      {(["top", "bottom", "left", "right"] as const).map((p) => (
        <Handle key={`t-${p}`} id={`t-${p}`} type="target" position={SIDES[p]} className="!size-2 !border-0 !bg-transparent" />
      ))}
      {(["top", "bottom", "left", "right"] as const).map((p) => (
        <Handle
          key={`s-${p}`}
          id={`s-${p}`}
          type="source"
          position={SIDES[p]}
          title={p === "right" ? "Drag to link to another page" : undefined}
          className={clsx("!border-0", p === "right" ? "link-handle !size-3 !bg-spark-500" : "!size-2 !bg-transparent")}
        />
      ))}
      <div className="w-full truncate text-center text-[13px] font-medium text-ink-100">
        {s.title} <span className="font-mono text-[10.5px] text-ink-500">{s.previewPath} · v{s.version}</span>
      </div>
      <button onClick={() => data.onOpen(s.route)} className={clsx("cursor-zoom-in transition hover:-translate-y-1", data.hidden && "invisible")} aria-label={`Open ${s.title}`}>
        {data.native ? (
          <PhoneFrame width={PHONE_W} height={h} radius={data.ipad ? PHONE_W * 0.03 : PHONE_W * 0.137} bezel={Math.max(5, PHONE_W * 0.025)} hardware ipad={data.ipad} glow={busy ? "spark" : s.status === "failed" ? "bad" : null}>
            <ScreenContent screen={s} scanning={data.scanning} />
          </PhoneFrame>
        ) : (
          // The project's preview device (iPhone, SE, iPad mini, Pixel, Galaxy), as in the focus view.
          <DeviceMockup device={deviceById(data.device)} width={PHONE_W} dark={data.dark} glow={busy ? "spark" : s.status === "failed" ? "bad" : null}>
            <ScreenContent screen={s} scanning={data.scanning} light={!data.dark} />
          </DeviceMockup>
        )}
      </button>
      <div className="flex items-center gap-1.5">
        <StatusPill screen={s} />
        {criteria && (
          <span className="text-[10.5px] text-ink-500">
            {criteria.filter((c) => c.pass).length}/{criteria.length} criteria
          </span>
        )}
      </div>
    </div>
  );
});

/** `light`: the placeholder matches a light status bar and home indicator around it. */
export function ScreenContent({ screen, scanning, light }: { screen: ScreenState; scanning?: boolean; light?: boolean }) {
  const s = screen;
  const block = light ? "bg-zinc-200" : "bg-ink-700";
  return (
    <div className={clsx("relative h-full w-full overflow-hidden", light ? "bg-white" : "bg-ink-800")}>
      {s.screenshotUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={s.screenshotUrl} src={s.screenshotUrl} alt={s.title} className={clsx("animate-fade-in h-full w-full object-cover object-top transition", s.deviceLoading && "scale-105 blur-md")} draggable={false} />
      ) : (
        <div className={clsx("flex h-full flex-col gap-2 p-3", s.status === "pending" && "opacity-40")}>
          <div className={clsx("h-4 w-2/3 rounded", block)} />
          <div className={clsx("h-2 w-1/3 rounded", block)} />
          {[0, 1, 2].map((i) => (
            // While building, the blocks pulse one after the other, like parts being laid out.
            <div key={i} className={clsx("h-10 rounded-lg opacity-70", block, s.status === "building" && "animate-pulse-soft")} style={s.status === "building" ? { animationDelay: `${i * 0.25}s` } : undefined} />
          ))}
        </div>
      )}
      {s.status === "building" && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="animate-build-sweep absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-sky-400/30 to-transparent" />
          {/* A blue edge breathing inside the screen. */}
          <div className="animate-pulse-soft absolute inset-0 shadow-[inset_0_0_24px_rgba(10,132,255,.45)] ring-1 ring-inset ring-sky-400/40" />
        </div>
      )}
      {s.deviceLoading && (
        // Until this device's capture arrives, the old one stays blurred behind a spinner.
        <div className="absolute inset-0 grid place-items-center bg-black/20">
          <CupertinoSpinner />
        </div>
      )}
      {(s.status === "verifying" || scanning) && (
        <div className="animate-scan pointer-events-none absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-sky-400/30 to-transparent">
          <div className="absolute inset-x-0 bottom-1/2 h-px bg-sky-300" />
        </div>
      )}
    </div>
  );
}

const nodeTypes = { phone: PhoneNode };
// Bottom padding keeps the pages clear of the floating prompt bar.
const FIT = { padding: { top: "36px", left: "48px", right: "48px", bottom: "180px" }, maxZoom: 1 } as const;

type Props = {
  /** Where the pages' positions are kept (per project, in this browser). */
  projectId: string;
  screens: ScreenState[];
  edges: NavEdge[];
  hiddenRoute: string | null;
  scanning: Set<string>;
  ipad: boolean;
  native: boolean;
  dark: boolean;
  device?: string;
  status: string;
  canLink: boolean;
  dimmed: boolean;
  onOpen: (route: string) => void;
  onLink: (from: string, to: string) => void;
  onUnlink: (from: string, to: string) => void;
};

type Pos = { x: number; y: number };
const posKey = (id: string) => `sparkflow.canvas.${id}`;
function Flow(p: Props) {
  const layout = useMemo(() => layoutScreens(p.screens.map((s) => s.route), p.edges), [p.screens, p.edges]);
  // Pages the user moved, kept per project in this browser; the others follow the automatic layout.
  const [moved, setMoved] = useState<Record<string, Pos>>({});
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(posKey(p.projectId)) ?? "{}");
      // Saves from the frames version held { pos, ... }.
      setMoved(saved.pos ?? saved);
    } catch {
      setMoved({});
    }
  }, [p.projectId]);
  // A page let go after a drag isn't opened by the click that ends it.
  const lastDrag = useRef(0);
  const open = useCallback((r: string) => Date.now() - lastDrag.current > 250 && p.onOpen(r), [p]);
  const posOf = (r: string): Pos => moved[r] ?? layout.get(r) ?? { x: 0, y: 0 };

  // Sizes React Flow measured, handed back with every node: without them it hides the nodes to
  // measure them again, which made the canvas blink while dragging.
  const sizes = useRef(new Map<string, { width: number; height: number }>());
  const nodes: Node<PhoneData>[] = p.screens.map((s) => ({
    id: s.route,
    type: "phone",
    position: posOf(s.route),
    measured: sizes.current.get(s.route),
    data: { screen: s, hidden: p.hiddenRoute === s.route, scanning: p.scanning.has(s.route), ipad: p.ipad, native: p.native, dark: p.dark, device: p.device, onOpen: open },
  }));

  const onNodesChange = (changes: NodeChange[]) => {
    let next: Record<string, Pos> | null = null;
    for (const c of changes) {
      if (c.type === "dimensions" && c.dimensions) sizes.current.set(c.id, c.dimensions);
      if (c.type !== "position") continue;
      lastDrag.current = Date.now();
      next ??= { ...moved };
      if (c.position) next[c.id] = c.position;
      if (c.dragging === false) {
        try {
          localStorage.setItem(posKey(p.projectId), JSON.stringify(next));
        } catch {}
      }
    }
    if (next) setMoved(next);
  };

  const busy = new Set(p.screens.filter((s) => s.status === "building" || s.status === "verifying").map((s) => s.route));
  const edges: Edge[] = p.edges
    .filter((e) => layout.has(e.from) && layout.has(e.to))
    .map((e) => {
      const [a, b] = edgeSides(posOf(e.from), posOf(e.to));
      return {
        id: `${e.from}→${e.to}`,
        source: e.from,
        target: e.to,
        sourceHandle: `s-${a}`,
        targetHandle: `t-${b}`,
        type: "smoothstep",
        className: busy.has(e.from) || busy.has(e.to) ? "edge-active" : undefined,
        // Planned links are dashed, links found in the code are solid.
        style: e.source === "plan" ? { strokeDasharray: "5 5" } : undefined,
        markerEnd: { type: MarkerType.ArrowClosed, color: "var(--edge-marker)", width: 16, height: 16 },
      };
    });

  const flow = useReactFlow();
  const initialized = useNodesInitialized();
  const count = p.screens.length;
  // Re-fit whenever the page count or the preview device changes, once the nodes are measured.
  useEffect(() => {
    if (!initialized || !count) return;
    const t = setTimeout(() => void flow.fitView({ ...FIT, duration: 300 }), 50);
    return () => clearTimeout(t);
  }, [initialized, count, p.device, flow]);

  if (!count) {
    return (
      <div className="grid h-full place-items-center text-center">
        <div className="flex flex-col items-center gap-3">
          <Sparkles className={clsx("text-spark-400", p.status === "running" && "animate-pulse-soft")} size={28} />
          <p className="text-sm font-medium text-ink-200">{p.native ? "Native iOS project" : p.status === "running" ? "Planning your app…" : "No pages yet"}</p>
          <p className="max-w-xs text-xs text-ink-500">
            {p.native ? "Open it in the iOS Simulator with Play, then its pages appear here." : p.status === "running" ? "The planner is turning your idea into screens." : "Describe a change below to start."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <ReactFlow
      className={clsx(p.dimmed && "canvas-focused")}
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={FIT}
      onNodesChange={onNodesChange}
      nodesConnectable={p.canLink && !p.dimmed}
      connectionMode={ConnectionMode.Loose}
      connectionRadius={90}
      connectionLineStyle={{ stroke: "var(--color-spark-500)", strokeDasharray: "6 4", strokeWidth: 1.5 }}
      onConnect={(c) => c.source && c.target && c.source !== c.target && p.onLink(c.source, c.target)}
      onEdgeClick={(_, e) => p.canLink && p.onUnlink(e.source, e.target)}
      minZoom={0.15}
      maxZoom={1.6}
      panOnScroll
      zoomOnPinch
      proOptions={{ hideAttribution: true }}>
      <Background variant={BackgroundVariant.Dots} gap={22} size={1.8} color="var(--canvas-dot)" />
      {!p.dimmed && <Controls position="bottom-left" showInteractive={false} />}
    </ReactFlow>
  );
}

export function Canvas(props: Props) {
  return (
    <ReactFlowProvider>
      <Flow {...props} />
    </ReactFlowProvider>
  );
}

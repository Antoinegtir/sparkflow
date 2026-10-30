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
import { SkinFrame } from "./SkinFrame";
import type { DeviceSkin } from "@/lib/web/device-skin";

export type PhoneData = { screen: ScreenState; hidden: boolean; scanning: boolean; ipad: boolean; native: boolean; dark: boolean; device?: string; skin?: DeviceSkin | null; onOpen: (route: string) => void };

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
        {data.native && data.skin ? (
          // The Android emulator in use: its own frame.
          <SkinFrame skin={data.skin} style={{ width: PHONE_W, height: Math.round((PHONE_W * data.skin.height) / data.skin.width) }}>
            <ScreenContent screen={s} scanning={data.scanning} />
          </SkinFrame>
        ) : data.native ? (
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
  return (
    <div className={clsx("relative h-full w-full overflow-hidden", light ? "bg-white" : "bg-ink-800")}>
      {s.screenshotUrl ? (
        <Capture url={s.screenshotUrl} title={s.title} blurred={!!s.deviceLoading} />
      ) : (
        <PageSkeleton light={!!light} status={s.status} />
      )}
      {s.status === "building" && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="animate-build-sweep absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-sky-400/15 to-transparent" />
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
  /** The Android emulator's frame, when the pages show in one. */
  skin?: DeviceSkin | null;
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
    data: { screen: s, hidden: p.hiddenRoute === s.route, scanning: p.scanning.has(s.route), ipad: p.ipad, native: p.native, dark: p.dark, device: p.device, skin: p.skin, onOpen: open },
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
    const planning = !p.native && p.status === "running";
    return (
      <div className="grid h-full place-items-center text-center">
        <div className="flex flex-col items-center gap-4">
          {planning ? <PlanningSketch /> : <Sparkles className="text-spark-400" size={28} />}
          <p className="text-sm font-medium text-ink-200">{p.native ? "Native iOS project" : planning ? "Planning your app…" : "No pages yet"}</p>
          {planning ? (
            <PlanningSteps />
          ) : (
            <p className="max-w-xs text-xs text-ink-500">{p.native ? "Open it in the iOS Simulator with Play, then its pages appear here." : "Describe a change below to start."}</p>
          )}
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

/**
 * A page before its first capture: a plausible app (title, search, cards, tab bar) in placeholder blocks
 * with one shimmer running across them. While building, the parts lay themselves out one after another.
 */
function PageSkeleton({ light, status }: { light: boolean; status: ScreenState["status"] }) {
  const building = status === "building";
  const bone = clsx("skeleton-bone rounded", light ? "skeleton-light" : "skeleton-dark");
  let n = 0;
  // Each part pops in after the previous one, again and again while the Builder works.
  const part = () => (building ? { className: "skeleton-part", style: { animationDelay: `${n++ * 0.18}s` } } : {});
  return (
    <div className={clsx("flex h-full flex-col px-3 pt-3", status === "pending" && "opacity-40")}>
      <div {...part()}>
        <div className={clsx(bone, "h-4 w-1/2")} />
        <div className={clsx(bone, "mt-1.5 h-2 w-1/4")} />
      </div>
      <div {...part()}>
        <div className={clsx(bone, "mt-3 h-6 w-full rounded-full")} />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} {...part()}>
          <div className={clsx("mt-2.5 flex items-center gap-2 rounded-lg p-2", light ? "bg-zinc-100" : "bg-ink-700/40")}>
            <div className={clsx(bone, "size-6 shrink-0 rounded-full")} />
            <div className="flex-1">
              <div className={clsx(bone, "h-2")} style={{ width: `${80 - i * 15}%` }} />
              <div className={clsx(bone, "mt-1.5 h-1.5 w-2/5")} />
            </div>
          </div>
        </div>
      ))}
      <div className="flex-1" />
      <div {...part()}>
        <div className={clsx("flex justify-around border-t py-2", light ? "border-zinc-200" : "border-ink-700")}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={clsx(bone, "size-3 rounded-full")} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** While planning: three page outlines drawing themselves in turn, linked by a dashed line. */
function PlanningSketch() {
  return (
    <svg width="132" height="64" viewBox="0 0 132 64" fill="none" className="text-spark-400" aria-hidden>
      <path d="M32 32h18M82 32h18" stroke="currentColor" strokeOpacity=".5" strokeDasharray="3 3" className="plan-link" />
      {[6, 52, 98].map((x, i) => (
        <g key={x} className="plan-page" style={{ animationDelay: `${i * 0.45}s` }}>
          <rect x={x} y="6" width="28" height="52" rx="6" stroke="currentColor" strokeWidth="1.5" pathLength={1} className="plan-outline" />
          <rect x={x + 6} y="16" width="16" height="3" rx="1.5" fill="currentColor" fillOpacity=".7" />
          <rect x={x + 6} y="24" width="16" height="6" rx="2" fill="currentColor" fillOpacity=".35" />
          <rect x={x + 6} y="33" width="16" height="6" rx="2" fill="currentColor" fillOpacity=".35" />
        </g>
      ))}
    </svg>
  );
}

const PLANNING = ["Reading your idea", "Choosing the screens", "Linking the pages", "Writing what each page must show", "Picking the theme"];
/** What the planner is on, in turn, so the wait reads as progress. */
function PlanningSteps() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => Math.min(n + 1, PLANNING.length - 1)), 2600);
    return () => clearInterval(t);
  }, []);
  return (
    <p key={i} className="animate-fade-in text-xs text-ink-500">
      {PLANNING[i]}…
    </p>
  );
}

/**
 * A page's capture, filling the room between the bars. One from before 0.3.42 is taller (390×844, the whole
 * screen): its top and its bottom are kept at full size and the middle of the scroll is left out, so the
 * header, the tab bar and a floating button all show without squashing anything.
 */
function Capture({ url, title, blurred }: { url: string; title: string; blurred: boolean }) {
  const [tall, setTall] = useState(false);
  const cls = clsx("animate-fade-in absolute inset-0 transition", blurred && "scale-105 blur-md");
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={url}
        src={url}
        alt={title}
        onLoad={(e) => {
          const img = e.currentTarget;
          setTall(img.naturalHeight / img.naturalWidth > (img.clientHeight / img.clientWidth) * 1.03);
        }}
        className={clsx(cls, "h-full w-full object-cover object-top", tall && "opacity-0")}
        draggable={false}
      />
      {tall && (
        <div className={clsx(cls, "flex flex-col")}>
          <div className="min-h-0 flex-1" style={{ backgroundImage: `url(${url})`, backgroundSize: "100% auto", backgroundPosition: "top" }} />
          <div className="h-[22%] shrink-0" style={{ backgroundImage: `url(${url})`, backgroundSize: "100% auto", backgroundPosition: "bottom" }} />
        </div>
      )}
    </>
  );
}

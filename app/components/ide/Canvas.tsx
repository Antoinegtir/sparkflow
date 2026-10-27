"use client";

import "@xyflow/react/dist/style.css";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  Handle,
  MarkerType,
  NodeResizer,
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
import { edgeSides, FRAME_HEAD, FRAME_PAD, layoutGroups, NODE_H, NODE_W, pageGroups, PHONE_H, PHONE_W } from "@/lib/web/layout";
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

type Rect = { x: number; y: number; width: number; height: number };
type FrameData = {
  title: string;
  count: number;
  width: number;
  height: number;
  onResizeStart: () => void;
  onResize: (r: Rect) => void;
  onResizeEnd: () => void;
  onRename: (name: string) => void;
};

/**
 * A category's frame behind its pages, as in Figma: drag it by its title to move the whole group,
 * pull its edges or corners to resize it, double-click the title to rename it.
 */
const FrameNode = memo(function FrameNode({ data }: NodeProps<Node<FrameData>>) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.title);
  const commit = () => {
    setEditing(false);
    if (draft.trim() !== data.title) data.onRename(draft.trim());
  };
  return (
    <div className="group/frame rounded-3xl border border-white/[0.07] bg-white/[0.018] transition-colors hover:border-white/[0.14]" style={{ width: data.width, height: data.height }}>
      <NodeResizer
        minWidth={NODE_W}
        minHeight={NODE_H}
        lineClassName="frame-resize-line"
        handleClassName="frame-resize-handle"
        onResizeStart={data.onResizeStart}
        onResize={(_, r) => data.onResize(r)}
        onResizeEnd={data.onResizeEnd}
      />
      {/* Only the title takes the mouse: the rest of the frame lets the canvas pan. */}
      <div className="frame-handle pointer-events-auto flex w-fit cursor-grab items-center gap-2 px-5 active:cursor-grabbing" style={{ height: FRAME_HEAD + 14 }}>
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setDraft(data.title);
                setEditing(false);
              }
            }}
            className="nodrag w-40 rounded-md border border-spark-500/60 bg-ink-900 px-1.5 py-0.5 text-[13px] font-semibold text-ink-100 outline-none"
          />
        ) : (
          <span
            title="Double-click to rename"
            onDoubleClick={() => {
              setDraft(data.title);
              setEditing(true);
            }}
            className="text-[13px] font-semibold text-ink-200">
            {data.title}
          </span>
        )}
        <span className="rounded-full bg-white/[0.06] px-1.5 text-[11px] text-ink-500">{data.count}</span>
      </div>
    </div>
  );
});

const nodeTypes = { phone: PhoneNode, frame: FrameNode };
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
/**
 * What the user arranged: moved pages, pages taken out of their category or put in another one
 * (null: no frame), frames resized (box) and renamed.
 */
type Arranged = { pos: Record<string, Pos>; frame: Record<string, string | null>; box: Record<string, Rect>; names: Record<string, string> };
const EMPTY: Arranged = { pos: {}, frame: {}, box: {}, names: {} };

function Flow(p: Props) {
  const routes = useMemo(() => p.screens.map((s) => s.route), [p.screens]);
  const auto = useMemo(() => pageGroups(routes, p.edges, p.native), [routes, p.edges, p.native]);
  const layout = useMemo(() => layoutGroups(auto), [auto]);
  const [arranged, setArranged] = useState<Arranged>(EMPTY);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(posKey(p.projectId)) ?? "{}");
      // Older saves held the positions only.
      setArranged(saved.pos ? { ...EMPTY, ...saved } : { ...EMPTY, pos: saved });
    } catch {
      setArranged(EMPTY);
    }
  }, [p.projectId]);
  const persist = useCallback(
    (next: Arranged) => {
      try {
        localStorage.setItem(posKey(p.projectId), JSON.stringify(next));
      } catch {}
    },
    [p.projectId],
  );
  // A page let go after a drag isn't opened by the click that ends it.
  const lastDrag = useRef(0);
  const open = useCallback((r: string) => Date.now() - lastDrag.current > 250 && p.onOpen(r), [p]);
  // The page being dragged: its frame doesn't stretch to follow it, so it can leave.
  const [dragging, setDragging] = useState<string | null>(null);
  // While a frame is resized, React Flow also reports it moving: that must not move its pages.
  const resizing = useRef(false);

  const posOf = (r: string): Pos => arranged.pos[r] ?? layout.get(r) ?? { x: 0, y: 0 };
  const nodeH = p.ipad ? Math.round(PHONE_W * 1.33) + 80 : NODE_H;

  // Categories after the user's changes: a page can leave its frame or join another.
  const groups = auto.map((g) => ({ root: g.root, members: [] as string[] }));
  for (const g of auto) {
    for (const m of g.members) {
      const to = m in arranged.frame ? arranged.frame[m] : g.root;
      groups.find((x) => x.root === to)?.members.push(m);
    }
  }

  // Each category's frame wraps its pages where they are now (all but the one in hand).
  const frames = groups
    .map((g) => ({ ...g, inside: g.members.filter((m) => m !== dragging) }))
    .filter((g) => g.inside.length && (!p.native || g.members.length > 1))
    .map((g) => {
      // The pages' bounds, grown to the size the user gave the frame (never smaller than its pages).
      const ps = g.inside.map(posOf);
      const box = arranged.box[g.root];
      const x = Math.min(...ps.map((q) => q.x - FRAME_PAD), box?.x ?? Infinity);
      const y = Math.min(...ps.map((q) => q.y - FRAME_PAD - FRAME_HEAD), box?.y ?? Infinity);
      const width = Math.max(...ps.map((q) => q.x + NODE_W + FRAME_PAD), box ? box.x + box.width : -Infinity) - x;
      const height = Math.max(...ps.map((q) => q.y + nodeH + FRAME_PAD), box ? box.y + box.height : -Infinity) - y;
      const root = g.root;
      const title = arranged.names[root] || (p.screens.find((s) => s.route === root)?.title ?? root);
      const data: FrameData = {
        title,
        count: g.inside.length,
        width,
        height,
        onResizeStart: () => (resizing.current = true),
        onResize: (r) => setArranged((a) => ({ ...a, box: { ...a.box, [root]: r } })),
        onResizeEnd: () => {
          resizing.current = false;
          setArranged((a) => (persist(a), a));
        },
        onRename: (name) =>
          setArranged((a) => {
            const names = { ...a.names };
            if (name) names[root] = name;
            else delete names[root];
            const next = { ...a, names };
            persist(next);
            return next;
          }),
      };
      return { id: `frame:${root}`, root, members: g.members, x, y, data };
    });

  // Sizes React Flow measured, handed back with every node: without them it hides the nodes to
  // measure them again, which made the canvas blink while dragging.
  const sizes = useRef(new Map<string, { width: number; height: number }>());
  const nodes: Node[] = [
    ...frames.map((f) => ({ id: f.id, type: "frame", width: f.data.width, height: f.data.height, measured: { width: f.data.width, height: f.data.height }, position: { x: f.x, y: f.y }, data: f.data, zIndex: 0, selectable: false, dragHandle: ".frame-handle", style: { pointerEvents: "none" as const } })),
    ...p.screens.map((s) => ({
      id: s.route,
      type: "phone",
      position: posOf(s.route),
      measured: sizes.current.get(s.route),
      zIndex: 1,
      data: { screen: s, hidden: p.hiddenRoute === s.route, scanning: p.scanning.has(s.route), ipad: p.ipad, native: p.native, dark: p.dark, device: p.device, onOpen: open } satisfies PhoneData,
    })),
  ];

  /** Where a page dropped at `at` belongs: the frame under its middle, or none. */
  const frameAt = (r: string, at: Pos) => {
    const cx = at.x + NODE_W / 2;
    const cy = at.y + nodeH / 2;
    return frames.find((f) => cx >= f.x && cx <= f.x + f.data.width && cy >= f.y && cy <= f.y + f.data.height && !(f.members.length === 1 && f.members[0] === r))?.root ?? null;
  };

  const onNodesChange = (changes: NodeChange[]) => {
    let next: Arranged | null = null;
    for (const c of changes) {
      if (c.type === "dimensions" && c.dimensions) sizes.current.set(c.id, c.dimensions);
      if (c.type !== "position") continue;
      lastDrag.current = Date.now();
      const frame = frames.find((f) => f.id === c.id);
      if (frame && resizing.current) continue;
      next ??= { ...arranged, pos: { ...arranged.pos }, frame: { ...arranged.frame }, box: { ...arranged.box } };
      if (frame) {
        // Moving a frame moves all its pages (and the size it was given) by the same amount.
        if (c.position) {
          const dx = c.position.x - frame.x;
          const dy = c.position.y - frame.y;
          for (const m of frame.members) {
            const q = posOf(m);
            next.pos[m] = { x: q.x + dx, y: q.y + dy };
          }
          const box = next.box[frame.root];
          if (box) next.box[frame.root] = { ...box, x: box.x + dx, y: box.y + dy };
        }
      } else {
        if (c.position) next.pos[c.id] = c.position;
        if (c.dragging) setDragging(c.id);
        else if (c.dragging === false) {
          // Let go: it joins the frame it's over, or stands on its own.
          const to = frameAt(c.id, next.pos[c.id] ?? posOf(c.id));
          const home = auto.find((g) => g.members.includes(c.id))?.root ?? null;
          if (to === home) delete next.frame[c.id];
          else next.frame[c.id] = to;
          setDragging(null);
        }
      }
      if (c.dragging === false) persist(next);
    }
    if (next) setArranged(next);
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

"use client";

import "@xyflow/react/dist/style.css";
import {
  Background,
  BackgroundVariant,
  ConnectionMode, SelectionMode,
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
import { edgeSides, GAP_X, layoutScreens, NODE_H, NODE_W, PHONE_H, PHONE_W } from "@/lib/web/layout";
import { CupertinoSpinner, deviceById, DeviceMockup, PhoneFrame, StatusPill } from "./ui";
import { SkinFrame } from "./SkinFrame";
import { can, useAccess } from "@/lib/web/access";
import { useOwnerProfile } from "@/lib/web/owner-profile";
import { allowedTools, CommentNode, PEOPLE_EVENT, GroupNode, NewPageNode, TextNode, ToolBar, useBoard, type CanvasGroup, type CommentData, type GroupData, type NewPageData, type TextData, type Tool } from "./CanvasTools";
import type { DeviceSkin } from "@/lib/web/device-skin";

export type PhoneData = { screen: ScreenState; hidden: boolean; scanning: boolean; ipad: boolean; native: boolean; dark: boolean; device?: string; skin?: DeviceSkin | null; onOpen: (route: string) => void };

const SIDES = { top: Position.Top, bottom: Position.Bottom, left: Position.Left, right: Position.Right };

/** One page on the canvas: title, frame (click to focus), status and scores. */
export const PhoneNode = memo(function PhoneNode({ data, selected }: NodeProps<Node<PhoneData>>) {
  const s = data.screen;
  const busy = s.status === "building" || s.status === "verifying";
  const h = data.ipad ? Math.round(PHONE_W * 1.33) : PHONE_H;
  const criteria = s.verdict?.criteria;
  return (
    // Selected (a box drawn with Move): outlined, like frames and text.
    <div className={clsx("flex flex-col items-center gap-2 rounded-2xl", selected && "outline-2 outline-offset-4 outline-spark-500")} style={{ width: NODE_W }} data-phone={s.route}>
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

type PendingData = { name: string; ipad: boolean; native: boolean; dark: boolean; device?: string; skin?: DeviceSkin | null };

/**
 * The page the New page tool asked for, until the agent adds it: a phone being built, with the page's
 * name, where it was placed. Not a page yet: no links, comments or focus.
 */
const PendingNode = memo(function PendingNode({ data }: NodeProps<Node<PendingData>>) {
  const screen: ScreenState = { route: "", title: data.name, file: "", previewPath: "", status: "building", version: 0, attempt: 1, history: [] };
  return (
    <div className="pointer-events-none flex flex-col items-center gap-2">
      <div className="flex items-baseline gap-1.5 text-[12px]">
        <span className="font-medium text-ink-100">{data.name}</span>
        <span className="text-ink-500">· planning</span>
      </div>
      {data.native && data.skin ? (
        <SkinFrame skin={data.skin} style={{ width: PHONE_W, height: Math.round((PHONE_W * data.skin.height) / data.skin.width) }}>
          <ScreenContent screen={screen} />
        </SkinFrame>
      ) : data.native ? (
        <PhoneFrame width={PHONE_W} height={data.ipad ? Math.round(PHONE_W * 1.33) : PHONE_H} radius={data.ipad ? PHONE_W * 0.03 : PHONE_W * 0.137} bezel={Math.max(5, PHONE_W * 0.025)} hardware ipad={data.ipad} glow="spark">
          <ScreenContent screen={screen} />
        </PhoneFrame>
      ) : (
        <DeviceMockup device={deviceById(data.device)} width={PHONE_W} dark={data.dark} glow="spark">
          <ScreenContent screen={screen} light={!data.dark} />
        </DeviceMockup>
      )}
      <StatusPill screen={screen} />
    </div>
  );
});

/**
 * Which New page placeholder each newly added page belongs to: its name first, else the oldest one
 * whose request was sent before the page appeared.
 */
function claimPages<T extends { id: number; name: string; before: Set<string>; sent: number | null }>(pendings: T[], screens: ScreenState[]) {
  const out = new Map<string, T>();
  const sent = pendings.filter((x) => x.sent != null).sort((a, b) => a.sent! - b.sent!);
  const free = (x: T) => screens.filter((s) => !x.before.has(s.route) && !out.has(s.route));
  const used = new Set<number>();
  for (const x of sent) {
    const s = free(x).find((s) => s.title.trim().toLowerCase() === x.name.trim().toLowerCase());
    if (s) (out.set(s.route, x), used.add(x.id));
  }
  for (const x of sent) {
    if (used.has(x.id)) continue;
    const s = free(x)[0];
    if (s) (out.set(s.route, x), used.add(x.id));
  }
  return out;
}

const nodeTypes = { phone: PhoneNode, pending: PendingNode, text: TextNode, comment: CommentNode, newpage: NewPageNode, area: GroupNode };
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
  /** A frame placed with the Frame tool: the agent adds that page. */
  onAddPage: (a: { name: string; description: string; from?: string }) => Promise<boolean>;
  /** The project is a native app (its new pages arrive with the Simulator's captures, after the run). */
  nativeApp: boolean;
  /** A comment on a page, sent to the agent as a change for it. */
  onAsk: (text: string, route: string) => void;
};

type Pos = { x: number; y: number };
const posKey = (id: string) => `sparkflow.canvas.${id}`;
/** Where pages the layout placed (never moved by hand) first showed up. */
const autoKey = (id: string) => `sparkflow.canvas.${id}.auto`;
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
  // The tools: what a click on the canvas does (Move opens pages, the others place something).
  const [tool, setTool] = useState<Tool>("move");
  const [draw, setDraw] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const open = useCallback((r: string) => toolRef.current === "move" && Date.now() - lastDrag.current > 250 && p.onOpen(r), [p]);
  const board = useBoard(p.projectId);
  const access = useAccess();
  useOwnerProfile(p.projectId, access.role === "owner", () => dispatchEvent(new Event(PEOPLE_EVENT)));
  // Texts, groups, page links and new pages are the editors'; comments are each author's own.
  const canvasOk = can(access, "canvas");
  const tools = useMemo(() => allowedTools(access.role), [access.role]);
  const me = board.me || access.me;
  const people = { ...access.people, ...board.people };
  const commentRights = (by?: string) => {
    const mine = (by ?? "owner") === me;
    return { mine, canModify: mine || access.role === "owner" };
  };
  const [editing, setEditing] = useState<string | null>(null);
  const [openComment, setOpenComment] = useState<string | null>(null);
  const [newPage, setNewPage] = useState<Pos | null>(null);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  // Selected groups, text and comments (the nodes are built from state, so their selection is kept here).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // The group being resized from its edges: its moves then aren't drags that carry what's inside.
  const resizing = useRef<string | null>(null);
  // A group being dragged: where it started and what it carries (pages, text, comments, smaller groups).
  const drag = useRef<{ id: string; from: Pos; routes: Record<string, Pos>; items: Record<string, Pos> } | null>(null);
  // Pages asked for with the New page tool: each shown at once where it was placed (a phone being built),
  // then handed that spot when the agent adds it. `sent`: when its request reached the agent (it may wait
  // in the queue first); before that, other runs and their pages aren't its own. `started`/`ended`: its run.
  type Pending = { id: number; at: Pos; name: string; before: Set<string>; sent: number | null; started: boolean; ended?: number };
  const [pendings, setPendings] = useState<Pending[]>([]);
  useEffect(() => setPendings([]), [p.projectId]);
  const screensRef = useRef(p.screens);
  screensRef.current = p.screens;
  const claims = claimPages(pendings, p.screens);
  useEffect(() => {
    if (claims.size) {
      setMoved((m) => {
        const next = { ...m };
        for (const [r, x] of claims) next[r] = x.at;
        try {
          localStorage.setItem(posKey(p.projectId), JSON.stringify(next));
        } catch {}
        return next;
      });
      const done = new Set([...claims.values()].map((x) => x.id));
      setPendings((ps) => ps.filter((x) => !done.has(x.id)));
      return;
    }
    const sent = pendings.filter((x) => x.sent != null);
    if (!sent.length) return;
    if (p.status === "running") {
      if (sent.some((x) => !x.started)) setPendings((ps) => ps.map((x) => (x.sent != null && !x.started ? { ...x, started: true } : x)));
      return;
    }
    if (sent.some((x) => x.started && !x.ended)) return void setPendings((ps) => ps.map((x) => (x.started && !x.ended ? { ...x, ended: Date.now() } : x)));
    // Its run ended without the page (stopped, failed), or was never seen running (it started and ended
    // between two updates): the placeholder goes after a grace period. A native app's pages come with the
    // Simulator's captures, after a run that went through: those wait longer.
    const deadline = (x: Pending) => (x.started ? x.ended! + (p.nativeApp && p.status === "done" ? 60_000 : 1500) : x.sent! + 4000);
    const now = Date.now();
    const expired = new Set(sent.filter((x) => deadline(x) <= now).map((x) => x.id));
    if (expired.size) return void setPendings((ps) => ps.filter((x) => !expired.has(x.id)));
    const t = setTimeout(() => setPendings((ps) => [...ps]), Math.min(...sent.map(deadline)) - now + 20);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.screens, p.status, p.projectId, pendings]);

  // Pages stay where they first showed up. The automatic layout only places a page the first time:
  // when a page is added (with no link yet, it lands in the top row, which re-centers it), the others
  // would otherwise jump around until its links arrive. Kept per project in this browser, so a reload
  // shows the same arrangement.
  const shown = useRef(new Map<string, Pos>());
  const shownDirty = useRef(false);
  useEffect(() => {
    try {
      shown.current = new Map(Object.entries(JSON.parse(localStorage.getItem(autoKey(p.projectId)) ?? "{}") as Record<string, Pos>));
    } catch {
      shown.current = new Map();
    }
    shownDirty.current = false;
  }, [p.projectId]);
  useEffect(() => {
    // Pages that are gone lose their spot (added back, they're placed again).
    const live = new Set(p.screens.map((s) => s.route));
    for (const r of [...shown.current.keys()]) if (!live.has(r)) (shown.current.delete(r), (shownDirty.current = true));
    if (!shownDirty.current || !p.screens.length) return;
    shownDirty.current = false;
    try {
      localStorage.setItem(autoKey(p.projectId), JSON.stringify(Object.fromEntries(shown.current)));
    } catch {}
  });
  const overlaps = (a: Pos, b: Pos) => Math.abs(a.x - b.x) < NODE_W + GAP_X / 2 && Math.abs(a.y - b.y) < NODE_H;
  const posOf = (r: string): Pos => {
    if (moved[r]) return moved[r];
    // The page the New page placeholder stands for: straight onto its spot, never a stop elsewhere first.
    const claim = claims.get(r);
    if (claim) return claim.at;
    const kept = shown.current.get(r);
    if (kept) return kept;
    // A page placed for the first time: its spot in the layout, moved right past any page already there.
    const others = p.screens.filter((s) => s.route !== r).map((s) => moved[s.route] ?? shown.current.get(s.route)).filter((x): x is Pos => !!x);
    for (const x of pendings) others.push(x.at);
    const at = { ...(layout.get(r) ?? { x: 0, y: 0 }) };
    for (let guard = 0; guard < 50 && others.some((o) => overlaps(o, at)); guard++) at.x += NODE_W + GAP_X;
    shown.current.set(r, at);
    shownDirty.current = true;
    return at;
  };

  // Sizes React Flow measured, handed back with every node: without them it hides the nodes to
  // measure them again, which made the canvas blink while dragging.
  const sizes = useRef(new Map<string, { width: number; height: number }>());
  const nodes: Node<PhoneData>[] = p.screens.map((s) => ({
    id: s.route,
    type: "phone",
    position: posOf(s.route),
    measured: sizes.current.get(s.route),
    selected: selected.has(s.route),
    data: { screen: s, hidden: p.hiddenRoute === s.route, scanning: p.scanning.has(s.route), ipad: p.ipad, native: p.native, dark: p.dark, device: p.device, skin: p.skin, onOpen: open },
  }));
  const title = (r?: string) => (r ? p.screens.find((s) => s.route === r)?.title : undefined);
  // Frames and sections, under everything: sections lowest, so a frame drawn in one stays on top.
  const groups: Node<GroupData>[] = board.board.groups.map((g) => ({
    id: `area:${g.id}`,
    type: "area",
    position: { x: g.x, y: g.y },
    width: g.w,
    height: g.h,
    measured: { width: g.w, height: g.h },
    zIndex: g.kind === "section" ? -2 : -1,
    draggable: canvasOk,
    selected: selected.has(`area:${g.id}`),
    data: {
      group: g,
      canEdit: canvasOk,
      editing: editingGroup === g.id,
      onEdit: () => canvasOk && setEditingGroup(g.id),
      onRename: (name) => {
        setEditingGroup(null);
        if (name !== g.name) board.setGroup(g.id, { name });
      },
      onRemove: () => board.remove(g.id),
      onResizing: (on) => (resizing.current = on ? g.id : null),
    },
  }));
  /** What a group carries when it moves: what has its centre (pages) or its corner (text, comments) inside, and groups wholly inside. */
  const contents = (g: CanvasGroup) => {
    const inside = (x: number, y: number) => x >= g.x && x <= g.x + g.w && y >= g.y && y <= g.y + g.h;
    const routes: Record<string, Pos> = {};
    for (const s of p.screens) {
      const at = posOf(s.route);
      const size = sizes.current.get(s.route) ?? { width: NODE_W, height: NODE_H };
      if (inside(at.x + size.width / 2, at.y + size.height / 2)) routes[s.route] = at;
    }
    const items: Record<string, Pos> = {};
    for (const t of [...board.board.texts, ...board.board.comments]) if (inside(t.x, t.y)) items[t.id] = { x: t.x, y: t.y };
    for (const o of board.board.groups) if (o.id !== g.id && inside(o.x, o.y) && inside(o.x + o.w, o.y + o.h)) items[o.id] = { x: o.x, y: o.y };
    return { routes, items };
  };
  const extras: Node[] = [
    ...board.board.texts.map(
      (t): Node<TextData> => ({
        id: `text:${t.id}`,
        type: "text",
        position: { x: t.x, y: t.y },
        measured: sizes.current.get(`text:${t.id}`),
        zIndex: 5,
        draggable: canvasOk,
        selected: selected.has(`text:${t.id}`),
        data: {
          text: t.text,
          editing: editing === t.id && canvasOk,
          canEdit: canvasOk,
          onChange: (v) => board.setText(t.id, v),
          onEdit: () => canvasOk && setEditing(t.id),
          onDone: () => {
            setEditing(null);
            if (!t.text.trim()) board.remove(t.id);
          },
          onRemove: () => board.remove(t.id),
        },
      }),
    ),
    ...board.board.comments.map((c, i): Node<CommentData> => {
      const key = c.by ?? "owner";
      const { mine, canModify } = commentRights(c.by);
      const author = people[key];
      // Your own comment if your role runs the agent; the owner may also send anyone's, as themselves.
      const canSend = (mine && can(access, "agent")) || access.role === "owner";
      return {
        id: `comment:${c.id}`,
        type: "comment",
        position: { x: c.x, y: c.y },
        measured: sizes.current.get(`comment:${c.id}`),
        zIndex: openComment === c.id ? 30 : 10,
        draggable: canModify || access.role === "edit",
        data: {
          comment: c,
          index: i + 1,
          pageTitle: title(c.route),
          open: openComment === c.id,
          canSend,
          busy: p.status === "running",
          canModify,
          author,
          authorKey: key,
          mine,
          onOpen: () => setOpenComment(c.id),
          onClose: (text) => {
            setOpenComment(null);
            if (!canModify) return;
            if (!text) board.remove(c.id);
            else if (text !== c.text) board.setComment(c.id, { text });
          },
          onChange: (v) => canModify && board.setComment(c.id, { text: v }),
          onSend: (text) => {
            if (!c.route || !text) return;
            if (!mine && !confirm(`Send ${author?.name ?? "this person"}'s comment to the agent as you?`)) return;
            p.onAsk(text, c.route);
            board.setComment(c.id, { text, sent: true });
            setOpenComment(null);
          },
          onRemove: () => {
            setOpenComment(null);
            if (canModify) board.remove(c.id);
          },
        },
      };
    }),
    ...pendings.map(
      (x) =>
        ({
          id: `page:pending:${x.id}`,
          type: "pending",
          position: x.at,
          measured: sizes.current.get(`page:pending:${x.id}`),
          draggable: false,
          selectable: false,
          connectable: false,
          data: { name: x.name, ipad: p.ipad, native: p.native, dark: p.dark, device: p.device, skin: p.skin },
        }) satisfies Node<PendingData>,
    ),
    ...(newPage
      ? [
          {
            id: "page:new",
            type: "newpage",
            position: newPage,
            zIndex: 20,
            data: {
              pages: p.screens.map((s) => ({ route: s.route, title: s.title })),
              running: p.status === "running",
              onCancel: () => setNewPage(null),
              onSubmit: (a) => {
                const id = Date.now();
                setPendings((ps) => [...ps, { id, at: newPage, name: a.name, before: new Set(p.screens.map((s) => s.route)), sent: null, started: false }]);
                setNewPage(null);
                // Sent: the pages there at that moment aren't its own. Not sent (offline, refused): it goes.
                void p.onAddPage(a).then((ok) =>
                  setPendings((ps) => (ok ? ps.map((x) => (x.id === id ? { ...x, before: new Set(screensRef.current.map((s) => s.route)), sent: Date.now() } : x)) : ps.filter((x) => x.id !== id))),
                );
              },
            },
          } satisfies Node<NewPageData>,
        ]
      : []),
  ];

  const onNodesChange = (changes: NodeChange[]) => {
    let next: Record<string, Pos> | null = null;
    const persist = (m: Record<string, Pos>) => {
      try {
        localStorage.setItem(posKey(p.projectId), JSON.stringify(m));
      } catch {}
    };
    let sel: Set<string> | null = null;
    for (const c of changes) {
      if (c.type === "add" || c.type === "replace") continue;
      if (c.type === "select") {
        // Pages too, so a box around a frame and its pages selects (and drags) them all.
        if (c.id.startsWith("page:")) continue;
        sel ??= new Set(selected);
        if (c.selected) sel.add(c.id);
        else sel.delete(c.id);
        continue;
      }
      const own = /^(area|text|comment):/.test(c.id) ? c.id.slice(c.id.indexOf(":") + 1) : null;
      // Delete or Backspace on a selected group, text or comment (pages stay: they're the app's).
      if (c.type === "remove") {
        const comment = c.id.startsWith("comment:") ? board.board.comments.find((x) => x.id === own) : null;
        if (own && (comment ? commentRights(comment.by).canModify : canvasOk)) board.remove(own);
        continue;
      }
      if (c.type === "dimensions" && c.dimensions) {
        sizes.current.set(c.id, c.dimensions);
        if (own && c.id.startsWith("area:") && c.resizing && resizing.current === own) board.setGroup(own, { w: Math.round(c.dimensions.width), h: Math.round(c.dimensions.height) });
      }
      if (c.type !== "position") continue;
      // A group: resized from its top or left edge, or dragged with what it holds.
      if (own && c.id.startsWith("area:")) {
        const g = board.board.groups.find((x) => x.id === own);
        if (resizing.current === own) {
          if (c.position) board.setGroup(own, { x: c.position.x, y: c.position.y });
          continue;
        }
        if (g && c.position) {
          const d = drag.current?.id === own ? drag.current : (drag.current = { id: own, from: { x: g.x, y: g.y }, ...contents(g) });
          const dx = c.position.x - d.from.x;
          const dy = c.position.y - d.from.y;
          next ??= { ...moved };
          for (const [r, at] of Object.entries(d.routes)) next[r] = { x: at.x + dx, y: at.y + dy };
          const to: Record<string, Pos> = { [own]: c.position };
          for (const [id, at] of Object.entries(d.items)) to[id] = { x: at.x + dx, y: at.y + dy };
          board.moveMany(to);
          lastDrag.current = Date.now();
        }
        if (c.dragging === false) {
          drag.current = null;
          if (next) persist(next);
        }
        continue;
      }
      // Text and comments: kept with the project; the new page: where it was dropped.
      if (own) {
        if (c.position) board.moveMany({ [own]: c.position });
        continue;
      }
      if (c.id === "page:new") {
        if (c.position) setNewPage(c.position);
        continue;
      }
      // A page inside a group being dragged moves with the group already.
      if (drag.current && c.id in drag.current.routes) continue;
      lastDrag.current = Date.now();
      next ??= { ...moved };
      if (c.position) next[c.id] = c.position;
      if (c.dragging === false) persist(next);
    }
    if (next) setMoved(next);
    if (sel) setSelected(sel);
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
          <p className="text-sm font-medium text-ink-200">{p.native ? "Native project" : planning ? "Planning your app…" : "No pages yet"}</p>
          {planning ? (
            <PlanningSteps />
          ) : (
            <p className="max-w-xs text-xs text-ink-500">{p.native ? "Open it in the iOS Simulator or the Android emulator with Play, then its pages appear here." : "Describe a change below to start."}</p>
          )}
        </div>
      </div>
    );
  }

  // A click elsewhere closes the open comment; one left empty goes (its typed text was saved on blur).
  const closeComment = () => {
    const c = board.board.comments.find((x) => x.id === openComment);
    const typed = document.querySelector<HTMLTextAreaElement>(`[data-id="comment:${openComment}"] textarea`)?.value.trim();
    if (c && !c.text.trim() && !typed && commentRights(c.by).canModify) board.remove(c.id);
    setOpenComment(null);
  };

  // A click with a tool that places something: at that point of the canvas, then back to Move (as in Figma).
  const place = (e: React.MouseEvent, route?: string) => {
    const at = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    if (!tools.has(tool)) return setTool("move");
    if (tool === "text") setEditing(board.addText(at.x, at.y - 12));
    else if (tool === "comment") setOpenComment(board.addComment(at.x, at.y - 32, route));
    else if (tool === "page" && !route) {
      setNewPage({ x: at.x - PHONE_W / 2, y: at.y - 24 });
      // The frame and its form beside it, in view (one placed near an edge would have its form cut off).
      void flow.setCenter(at.x + 140, at.y - 24 + PHONE_H / 2, { zoom: flow.getZoom(), duration: 300 });
    }
    else return;
    setTool("move");
  };

  // Frame and Section: drag a box over the canvas (over pages too); a plain click makes one around two pages' size.
  const drawing = tool === "frame" || tool === "section";
  const drawBox = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const finishBox = (e: React.PointerEvent) => {
    const d = draw;
    setDraw(null);
    if (!d || (tool !== "frame" && tool !== "section")) return;
    const r = e.currentTarget.getBoundingClientRect();
    const a = flow.screenToFlowPosition({ x: r.left + Math.min(d.x0, d.x1), y: r.top + Math.min(d.y0, d.y1) });
    const b = flow.screenToFlowPosition({ x: r.left + Math.max(d.x0, d.x1), y: r.top + Math.max(d.y0, d.y1) });
    const click = Math.abs(d.x1 - d.x0) < 8 && Math.abs(d.y1 - d.y0) < 8;
    const box = click ? { x: a.x, y: a.y, w: NODE_W * 2 + 80, h: NODE_H + 80 } : { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
    setEditingGroup(board.addGroup(tool, { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.w), h: Math.round(box.h) }));
    setTool("move");
  };

  return (
    <ReactFlow
      className={clsx(p.dimmed && "canvas-focused", `canvas-tool-${tool}`)}
      elevateNodesOnSelect={false}
      deleteKeyCode={canvasOk ? ["Backspace", "Delete"] : null}
      onPaneClick={(e) => {
        if (tool === "move" || tool === "hand") return closeComment();
        place(e);
      }}
      onNodeClick={(e, n) => n.type === "phone" && tool === "comment" && place(e, n.id)}
      nodesDraggable={tool !== "hand"}
      elementsSelectable={tool !== "hand"}
      // Move: dragging the empty canvas draws a selection (pan with two fingers, the wheel or the middle
      // button). Hand: dragging anywhere pans, nothing moves or opens.
      panOnDrag={tool === "hand" ? true : [1, 2]}
      selectionOnDrag={tool === "move"}
      // Touching the box is enough (a frame is rarely drawn all inside it).
      selectionMode={SelectionMode.Partial}
      nodes={[...groups, ...nodes, ...extras]}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={FIT}
      onNodesChange={onNodesChange}
      nodesConnectable={p.canLink && canvasOk && !p.dimmed}
      connectionMode={ConnectionMode.Loose}
      connectionRadius={90}
      connectionLineStyle={{ stroke: "var(--color-spark-500)", strokeDasharray: "6 4", strokeWidth: 1.5 }}
      onConnect={(c) => canvasOk && c.source && c.target && c.source !== c.target && p.onLink(c.source, c.target)}
      onEdgeClick={(_, e) => p.canLink && canvasOk && p.onUnlink(e.source, e.target)}
      minZoom={0.15}
      maxZoom={1.6}
      panOnScroll
      zoomOnPinch
      proOptions={{ hideAttribution: true }}>
      <Background variant={BackgroundVariant.Dots} gap={22} size={1.8} color="var(--canvas-dot)" />
      {!p.dimmed && <Controls position="bottom-left" showInteractive={false} />}
      {!p.dimmed && drawing && canvasOk && (
        <div
          className="absolute inset-0 z-[6] cursor-crosshair"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            const at = drawBox(e);
            setDraw({ x0: at.x, y0: at.y, x1: at.x, y1: at.y });
          }}
          onPointerMove={(e) => draw && setDraw({ ...draw, x1: drawBox(e).x, y1: drawBox(e).y })}
          onPointerUp={finishBox}>
          {draw && (
            <div
              className={clsx("pointer-events-none absolute border border-spark-400 bg-spark-500/10", tool === "section" && "rounded-xl")}
              style={{ left: Math.min(draw.x0, draw.x1), top: Math.min(draw.y0, draw.y1), width: Math.abs(draw.x1 - draw.x0), height: Math.abs(draw.y1 - draw.y0) }}
            />
          )}
        </div>
      )}
      {!p.dimmed && <ToolBar tool={tool} onTool={setTool} allowed={tools} />}
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
export function Capture({ url, title, blurred }: { url: string; title: string; blurred: boolean }) {
  const [tall, setTall] = useState(false);
  // From the file itself, not the layout: 844/390 ≈ 2.16 for an old full-screen iPhone capture, while
  // captures of the room between the bars stay under 2.1 (iPhone 759/393 ≈ 1.93, Pixel 855/412 ≈ 2.08).
  useEffect(() => {
    const img = new Image();
    img.onload = () => setTall(img.naturalHeight / img.naturalWidth > 2.1);
    img.src = url;
  }, [url]);
  const cls = clsx("animate-fade-in absolute inset-0 transition", blurred && "scale-105 blur-md");
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={url}
        src={url}
        alt={title}
        className={clsx(cls, "h-full w-full object-cover object-top", tall && "opacity-0")}
        draggable={false}
      />
      {tall && (
        <div className={clsx(cls, "flex flex-col")}>
          {/* Real images, not CSS backgrounds: on the hosted site only img src is sent to your computer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" draggable={false} className="min-h-0 w-full flex-1 object-cover object-top" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" draggable={false} className="h-[22%] w-full shrink-0 object-cover object-bottom" />
        </div>
      )}
    </>
  );
}

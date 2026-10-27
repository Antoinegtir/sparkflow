"use client";

import clsx from "clsx";
import { Box, ChevronDown, ChevronRight, Code2, GitBranch, Image as ImageIcon, List, MousePointerClick, Repeat, Route, Sparkles, Type } from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";

/** Keys of the elements currently picked into the prompt; their rows stay highlighted. */
const Selected = createContext<Set<string>>(new Set());
import type { ProjectState } from "@/lib/shared";
import type { JsxComponent, JsxNode } from "@/lib/web/jsx-tree";

/** An element picked from the tree: highlighted on the phone on hover, added to the selection on click. */
export type LayoutPick = { key: string; testId?: string; label: string; texts: string[]; each: boolean; file: string; line: number; anchors?: Anchors };
/** What an element without a testID contains: the app finds it as the smallest block holding all of these. */
export type Anchors = { ids: string[]; texts: string[]; labels?: string[]; climb?: boolean; control?: boolean };

const LITERAL_ATTRS = ["title", "label", "subtitle", "placeholder"];

function anchorsOf(n: JsxNode): Anchors {
  const ids = new Set<string>();
  const texts = new Set<string>();
  const walk = (x: JsxNode) => {
    if (x.kind === "text") {
      if (!/^\{.*\}$/.test(x.text)) texts.add(x.text);
      return;
    }
    if (x.kind === "element") {
      const id = x.attrs.testID;
      if (id && !id.startsWith("{")) ids.add(id);
      for (const a of LITERAL_ATTRS) if (x.attrs[a] && !x.attrs[a].startsWith("{")) texts.add(x.attrs[a]);
    }
    x.children.forEach(walk);
  };
  walk(n);
  // Only a container (an element with element children) may grow to its surface; a Text stays itself.
  const climb = n.kind === "element" && n.children.some((c) => c.kind !== "text");
  return { ids: [...ids].slice(0, 8), texts: [...texts].slice(0, 8), climb };
}

type Layout = { file: string | null; component: string | null; components: JsxComponent[] };

const KEY_ATTRS = ["testID", "name", "title", "label", "accessibilityLabel", "style", "variant", "source", "component"];

/** Icon and color by kind of element, so the tree reads at a glance. */
function iconFor(n: JsxNode) {
  if (n.kind === "text") return { Icon: Type, color: "text-amber-300" };
  if (n.kind === "logic") return n.label.includes(".map(") ? { Icon: Repeat, color: "text-orange-400" } : { Icon: GitBranch, color: "text-orange-400" };
  const l = n.label;
  if (/\.Screen$|Navigator$|Stack$|Tabs$/.test(l)) return { Icon: Route, color: "text-violet-400" };
  if (/Glass/.test(l)) return { Icon: Sparkles, color: "text-cyan-300" };
  if (/^(Text|Header)$/.test(l)) return { Icon: Type, color: "text-amber-300" };
  if (/Image|Icon|Avatar/.test(l)) return { Icon: ImageIcon, color: "text-pink-400" };
  if (/Pressable|Button|Input|Touchable|Switch|Toggle|Segmented|Fab/.test(l)) return { Icon: MousePointerClick, color: "text-sky-400" };
  if (/Scroll|List|FlatList|SectionList/.test(l)) return { Icon: List, color: "text-teal-400" };
  if (l === "Fragment") return { Icon: Code2, color: "text-ink-500" };
  if (/^Screen$/.test(l)) return { Icon: Box, color: "text-violet-300" };
  return { Icon: Box, color: "text-emerald-400" };
}

/** "{h.name}" inside a .map over a literal array → the strings it renders. */
function textsOf(n: JsxNode, hintsBy: Record<string, string[]>): string[] {
  if (n.kind === "text") {
    const m = n.text.match(/^\{(.+)\}$/);
    if (!m) return [n.text];
    return hintsBy[m[1].trim()] ?? [];
  }
  if (n.kind === "element") return n.children.flatMap((c) => textsOf(c, hintsBy));
  return [];
}

export function LayoutTree({
  projectId,
  state,
  route,
  onHover,
  onPick,
  onJump,
  selectedKeys,
}: {
  projectId: string;
  state: ProjectState;
  route: string | null;
  selectedKeys: Set<string>;
  onHover: (p: LayoutPick | null) => void;
  onPick: (p: LayoutPick) => void;
  onJump: (file: string, line: number) => void;
}) {
  const [layout, setLayout] = useState<Layout | null>(null);
  const version = route ? state.screens[route]?.version : 0;

  useEffect(() => {
    const q = route ? `route=${encodeURIComponent(route)}` : state.native ? "file=App.tsx" : `route=${encodeURIComponent(state.order[0] ?? "")}`;
    fetch(`/api/projects/${projectId}/layout?${q}`)
      .then((r) => r.json())
      .then((j) => setLayout(j.components ? j : null))
      .catch(() => setLayout(null));
  }, [projectId, route, version, state.commits.length, state.native, state.order]);

  if (!layout) return <p className="p-4 text-[12px] text-ink-500">Loading the layout…</p>;
  if (!layout.file) return <p className="p-4 text-[12px] text-ink-500">No source file for this page.</p>;
  const page = layout.components.find((c) => c.name === layout.component);
  const title = route ? state.screens[route]?.title : undefined;

  return (
    <Selected.Provider value={selectedKeys}>
    <div className="h-full overflow-auto pb-24">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--line)] bg-[var(--panel)] px-3 py-2">
        <span className="truncate font-mono text-[11px] text-ink-400">{layout.file}</span>
        <span className="shrink-0 text-[11px] text-ink-500">{title ? `Page · ${title}` : "Whole app"}</span>
      </div>
      <div className="py-1">
        {page
          ? page.tree.map((n, i) => <Row key={i} node={n} depth={0} file={layout.file!} hintsBy={{}} inList={false} onHover={onHover} onPick={onPick} onJump={onJump} />)
          : layout.components.map((c) => <ComponentBlock key={c.name} c={c} file={layout.file!} isPage={c.name === layout.component} onHover={onHover} onPick={onPick} onJump={onJump} />)}
      </div>
    </div>
    </Selected.Provider>
  );
}

function ComponentBlock({ c, file, isPage, ...rest }: { c: JsxComponent; file: string; isPage: boolean; onHover: (p: LayoutPick | null) => void; onPick: (p: LayoutPick) => void; onJump: (f: string, l: number) => void }) {
  const [open, setOpen] = useState(isPage);
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full cursor-pointer items-center gap-1.5 px-3 py-1 text-left font-mono text-[12px] text-ink-200 hover:bg-ink-800/60">
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />} &lt;{c.name} /&gt;
        {isPage && <span className="rounded bg-spark-500/15 px-1.5 text-[10px] text-spark-400">this page</span>}
      </button>
      {open && c.tree.map((n, i) => <Row key={i} node={n} depth={1} file={file} hintsBy={{}} inList={false} {...rest} />)}
    </div>
  );
}

function Row({
  node,
  depth,
  file,
  hintsBy,
  inList,
  onHover,
  onPick,
  onJump,
}: {
  node: JsxNode;
  depth: number;
  file: string;
  hintsBy: Record<string, string[]>;
  inList: boolean;
  onHover: (p: LayoutPick | null) => void;
  onPick: (p: LayoutPick) => void;
  onJump: (f: string, l: number) => void;
}) {
  const [open, setOpen] = useState(depth < 4);
  const selected = useContext(Selected).has(`layout:${file}:${node.line}`);
  const { Icon, color } = iconFor(node);
  const kids = node.kind === "text" ? [] : node.children;
  const nextHints = node.kind === "logic" && node.hintsBy ? { ...hintsBy, ...node.hintsBy } : hintsBy;
  const nextInList = inList || (node.kind === "logic" && node.label.includes(".map("));
  const textOnly = node.kind === "element" && kids.length > 0 && kids.every((k) => k.kind === "text");
  const inline = textOnly ? kids.map((k) => (k.kind === "text" ? k.text : "")).join(" ") : null;

  const pick = (): LayoutPick | null => {
    if (node.kind !== "element") return null;
    const texts = textsOf(node, nextHints).filter(Boolean);
    const testId = node.attrs.testID?.startsWith("{") ? undefined : node.attrs.testID;
    return {
      key: `layout:${file}:${node.line}`,
      testId,
      label: testId ?? (texts[0] ? `${node.label} "${texts[0].slice(0, 30)}"` : node.label),
      texts,
      each: textOnly && nextInList,
      file,
      line: node.line,
      ...(testId ? {} : { anchors: anchorsOf(node) }),
    };
  };

  const attrs =
    node.kind === "element"
      ? KEY_ATTRS.filter((k) => node.attrs[k])
          .slice(0, 2)
          .map((k) => [k, k === "style" ? node.attrs[k].replace(/^\{styles\./, ".").replace(/\}$/, "") : node.attrs[k]])
      : [];

  return (
    <div>
      <div
        onMouseEnter={() => onHover(pick())}
        onMouseLeave={() => onHover(null)}
        onClick={() => {
          const p = pick();
          if (p) onPick(p);
        }}
        className={clsx(
          "group relative flex cursor-pointer items-center gap-1.5 py-[3px] pr-2 text-[12px]",
          selected ? "bg-[#0a84ff]/15 shadow-[inset_2px_0_0_#0a84ff]" : "hover:bg-spark-500/10",
          node.kind === "logic" ? "text-ink-500" : "text-ink-200",
        )}
        style={{ paddingLeft: 10 + depth * 14 }}>
        {Array.from({ length: depth }).map((_, i) => (
          <span key={i} className="absolute top-0 bottom-0 w-px bg-[var(--line)]" style={{ left: 16 + i * 14 }} />
        ))}
        {kids.length && !textOnly ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen((o) => !o);
            }}
            className="cursor-pointer text-ink-600">
            {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>
        ) : (
          <span className="w-[11px]" />
        )}
        <Icon size={12} className={clsx("shrink-0", color)} />
        <span className={clsx("truncate", node.kind === "element" && clsx("font-mono", color))}>{node.kind === "text" ? `"${node.text}"` : node.label}</span>
        {inline && <span className="truncate text-ink-400">“{inline}”</span>}
        {attrs.map(([k, v]) => (
          <span key={k} className="truncate font-mono text-[10.5px] text-ink-500">
            <span className={k === "testID" ? "text-sky-300/80" : "text-ink-600"}>{k === "testID" ? "#" : `${k}=`}</span>
            {v}
          </span>
        ))}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onJump(file, node.line);
          }}
          className="ml-auto hidden shrink-0 cursor-pointer rounded px-1 font-mono text-[10px] text-ink-500 hover:bg-ink-800 hover:text-ink-200 group-hover:block">
          &lt;/&gt; {node.line}
        </button>
      </div>
      {open &&
        !textOnly &&
        kids.map((k, i) => <Row key={i} node={k} depth={depth + 1} file={file} hintsBy={nextHints} inList={nextInList} onHover={onHover} onPick={onPick} onJump={onJump} />)}
    </div>
  );
}

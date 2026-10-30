"use client";

import clsx from "clsx";
import { ChevronDown, ChevronRight, CornerDownRight, File, FolderPlus, GripVertical, Home, LayoutGrid, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import type { ProjectState } from "@/lib/shared";
import { History } from "./History";
import { StatusDot } from "./ui";

const ASSET_MIME = "application/x-sparkflow-asset";
const IMAGE = /\.(png|jpe?g|gif|webp|svg)$/i;

/** The landing's folder emoji (as on "Import from a React Native project"); it tilts open when dragged onto. */
function FolderIcon({ open, size = 44 }: { open?: boolean; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/folder.png" alt="" width={size} height={size} draggable={false} className={clsx("transition", open && "-rotate-6 scale-110")} style={{ width: size, height: size }} />
  );
}

function Section({
  title,
  count,
  children,
  defaultOpen = true,
  className,
  openKey,
  handle,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  openKey?: number;
  /** The grip that drags the section to another place in the explorer. */
  handle?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  // Opens again when something inside asks to be shown.
  useEffect(() => {
    if (openKey) setOpen(true);
  }, [openKey]);
  return (
    <div data-section className={clsx("border-b border-[var(--line)] bg-[var(--panel)]", className)}>
      <div className="group/section relative">
        {handle}
        <button onClick={() => setOpen((o) => !o)} className="flex w-full cursor-pointer items-center gap-1 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-500 hover:text-ink-300">
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />} {title}
          {count != null && <span className="ml-auto font-normal normal-case text-ink-600">{count}</span>}
        </button>
      </div>
      {open && <div className="pb-2">{children}</div>}
    </div>
  );
}

const SECTION_MIME = "application/x-sparkflow-section";
const ORDER_KEY = "sparkflow.explorer.order";
type SectionId = "pages" | "assets" | "source" | "history";
const DEFAULT_ORDER: SectionId[] = ["pages", "assets", "source", "history"];

/**
 * The explorer's sections in the order the user dragged them to, kept in this browser. A saved order
 * missing a section (or from an older version) gets the missing ones at the end.
 */
function useSectionOrder() {
  const [order, setOrder] = useState<SectionId[]>(DEFAULT_ORDER);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(ORDER_KEY) ?? "[]") as string[];
      const known = saved.filter((x): x is SectionId => (DEFAULT_ORDER as string[]).includes(x));
      if (known.length) setOrder([...new Set([...known, ...DEFAULT_ORDER])]);
    } catch {}
  }, []);
  const move = useCallback((id: SectionId, target: SectionId, after: boolean) => {
    if (id === target) return;
    setOrder((o) => {
      const rest = o.filter((x) => x !== id);
      const at = rest.indexOf(target) + (after ? 1 : 0);
      const next = [...rest.slice(0, at), id, ...rest.slice(at)];
      try {
        localStorage.setItem(ORDER_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);
  return { order, move };
}

type Props = {
  projectId: string;
  state: ProjectState;
  focused: string | null;
  onOpenPage: (route: string) => void;
  onOpenFile: (path: string) => void;
  /** The file open in the code view, and a counter bumped to reveal it in Source. */
  active?: string | null;
  reveal?: number;
};

/** Explorer: pages (with status), assets (Finder-like, drag & drop) and source files. */
export function FileTree({ projectId, state, focused, onOpenPage, onOpenFile, active, reveal }: Props) {
  const [files, setFiles] = useState<string[]>(state.tree);
  const [cwd, setCwd] = useState("assets");
  const [selected, setSelected] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [upload, setUpload] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);
  const [hoverFolder, setHoverFolder] = useState<string | null>(null);
  const native = !!state.native;

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/files`, { cache: "no-store" }).catch(() => null);
    if (res?.ok) setFiles((await res.json()).files);
  }, [projectId]);
  useEffect(() => {
    void refresh();
  }, [refresh, state.commits.length]);

  // ---- pages tree: native via file path, web via the first incoming link ----
  const pages = useMemo(() => {
    const parent = new Map<string, string>();
    if (native) {
      for (const r of state.order) {
        const seg = r.split("/").filter(Boolean);
        if (seg.length > 1) parent.set(r, "/" + seg[0]);
      }
    } else {
      for (const [i, r] of state.order.entries()) {
        if (i === 0 || r.includes("/(")) continue;
        const inc = state.edges.find((e) => e.to === r && state.order.includes(e.from) && e.from !== r);
        if (inc) parent.set(r, inc.from);
      }
    }
    const out: { route: string; depth: number }[] = [];
    const visit = (r: string, depth: number, seen: Set<string>) => {
      if (seen.has(r)) return;
      seen.add(r);
      out.push({ route: r, depth });
      for (const c of state.order) if (parent.get(c) === r) visit(c, depth + 1, seen);
    };
    const seen = new Set<string>();
    for (const r of state.order) if (!parent.has(r) || !state.order.includes(parent.get(r)!)) visit(r, 0, seen);
    for (const r of state.order) visit(r, 0, seen);
    return out;
  }, [state.order, state.edges, native]);

  // ---- assets ----
  const assetFiles = files.filter((f) => f.startsWith("assets/"));
  const entries = useMemo(() => {
    const prefix = cwd + "/";
    const dirs = new Set<string>();
    const list: string[] = [];
    for (const f of assetFiles) {
      if (!f.startsWith(prefix)) continue;
      const rest = f.slice(prefix.length);
      if (rest.includes("/")) dirs.add(prefix + rest.split("/")[0]);
      else if (rest !== ".keep") list.push(f);
    }
    return [...[...dirs].sort().map((d) => ({ path: d, dir: true })), ...list.sort().map((f) => ({ path: f, dir: false }))];
  }, [assetFiles, cwd]);

  const op = async (body: unknown) => {
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/files`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) setError((await res.json()).error ?? "Failed");
    await refresh();
  };

  const uploadFiles = async (list: FileList | File[], dir = cwd) => {
    const arr = [...list];
    if (!arr.length) return;
    setUpload("Adding…");
    setError(null);
    const form = new FormData();
    for (const f of arr) form.append("files", f);
    form.append("dir", dir);
    const res = await fetch(`/api/projects/${projectId}/files`, { method: "POST", body: form });
    const json = await res.json();
    if (!res.ok) {
      setUpload(null);
      setError(json.error ?? "Upload failed");
      return;
    }
    setUpload(`Added ${json.added.map((a: string) => a.split("/").pop()).join(", ")}`);
    setTimeout(() => setUpload(null), 2500);
    await refresh();
    if (json.added[0]) onOpenFile(json.added[0]);
  };

  const newFolder = async () => {
    let n = 1;
    const names = new Set(entries.map((e) => e.path));
    while (names.has(`${cwd}/untitled folder${n > 1 ? ` ${n}` : ""}`)) n++;
    const p = `${cwd}/untitled folder${n > 1 ? ` ${n}` : ""}`;
    await op({ type: "mkdir", path: p });
    setRenaming(p);
  };

  const rename = async (from: string, name: string) => {
    setRenaming(null);
    const clean = name.trim();
    if (!clean || clean === from.split("/").pop()) return;
    await op({ type: "move", from, to: `${from.split("/").slice(0, -1).join("/")}/${clean}` });
  };

  const dropOn = (target: string) => async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setHoverFolder(null);
    setDropping(false);
    const internal = e.dataTransfer.getData(ASSET_MIME);
    if (internal) {
      if (internal === target || target.startsWith(internal + "/")) return;
      await op({ type: "move", from: internal, to: `${target}/${internal.split("/").pop()}` });
    } else await uploadFiles(e.dataTransfer.files, target);
  };

  const crumbs = cwd.split("/");
  const source = files.filter((f) => !f.startsWith("assets/") && !f.startsWith("components/sparkflow") && !f.startsWith(".expo/") && !/(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/.test(f));
  const headSha = state.commits.at(-1)?.sha;
  const pageFile = focused ? state.screens[focused]?.file : undefined;
  const pageFiles = usePageFiles(projectId, pageFile, source);
  // Revealing a file this page doesn't use lists all the files.
  useEffect(() => {
    if (reveal && active && !pageFiles.includes(active)) setAllSource(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal]);
  const [allSource, setAllSource] = useState(false);
  useEffect(() => setAllSource(false), [focused]);

  // ---- sections, in the order dragged to with their grip ----
  const { order, move } = useSectionOrder();
  const [dragging, setDragging] = useState<SectionId | null>(null);
  const [over, setOver] = useState<{ id: SectionId; after: boolean } | null>(null);
  const grip = (id: SectionId) => (
    <span
      draggable
      title="Drag to reorder"
      aria-label="Drag to reorder"
      onDragStart={(e) => {
        e.dataTransfer.setData(SECTION_MIME, id);
        e.dataTransfer.effectAllowed = "move";
        // The whole section follows the pointer, not just the grip.
        const section = e.currentTarget.closest<HTMLElement>("[data-section]");
        if (section) e.dataTransfer.setDragImage(section, 16, 16);
        setDragging(id);
      }}
      onDragEnd={() => {
        setDragging(null);
        setOver(null);
      }}
      className="absolute top-1/2 left-0 z-10 grid h-6 w-3 -translate-y-1/2 cursor-grab place-items-center text-ink-600 opacity-0 transition group-hover/section:opacity-100 hover:text-ink-300 active:cursor-grabbing">
      <GripVertical size={12} />
    </span>
  );
  const sections: Record<SectionId, ReactNode> = {
    pages: (
        <Section handle={grip("pages")} title="Pages" count={state.order.length}>
          {!pages.length && <p className="px-4 py-1 text-[12px] text-ink-500">Waiting for the plan…</p>}
          {pages.map(({ route, depth }, i) => {
            const s = state.screens[route];
            if (!s) return null;
            const Icon = depth > 0 ? CornerDownRight : i === 0 ? Home : LayoutGrid;
            return (
              <button
                key={route}
                onClick={() => onOpenPage(route)}
                className={clsx("flex w-full cursor-pointer items-center gap-2 py-1 pr-3 text-left text-[12.5px] hover:bg-ink-800/60", focused === route ? "bg-spark-500/10 text-ink-100" : "text-ink-300")}
                style={{ paddingLeft: 14 + depth * 14 }}>
                <Icon size={13} className="shrink-0 text-ink-500" />
                <span className="flex-1 truncate">{s.title}</span>
                <span className="font-mono text-[10px] text-ink-600">v{s.version}</span>
                <StatusDot status={s.status} />
              </button>
            );
          })}
        </Section>
    ),
    assets: (
        <Section handle={grip("assets")} title="Assets" count={assetFiles.filter((f) => !f.endsWith(".keep")).length} className={clsx("relative", dropping && "marching-ants")}>
          <div className="flex items-center gap-1 px-3 pb-1.5 text-[11.5px]">
            {crumbs.map((c, i) => {
              const p = crumbs.slice(0, i + 1).join("/");
              return (
                <span key={p} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight size={11} className="text-ink-600" />}
                  <button
                    onClick={() => setCwd(p)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={dropOn(p)}
                    className={clsx("cursor-pointer rounded px-1 hover:bg-ink-800", i === crumbs.length - 1 ? "text-ink-200" : "text-ink-500")}>
                    {c}
                  </button>
                </span>
              );
            })}
            <button onClick={() => void newFolder()} title="New folder" className="ml-auto cursor-pointer rounded p-1 text-ink-500 hover:bg-ink-800 hover:text-ink-200">
              <FolderPlus size={13} />
            </button>
          </div>
          <div
            tabIndex={0}
            onKeyDown={(e) => {
              if (!selected || renaming) return;
              if ((e.key === "Backspace" || e.key === "Delete") && confirm(`Delete ${selected.split("/").pop()}?`)) {
                void op({ type: "delete", path: selected });
                setSelected(null);
              }
              if (e.key === "Enter") setRenaming(selected);
            }}
            className="grid grid-cols-3 gap-1 px-2 outline-none">
            {entries.map((e) => {
              const name = e.path.split("/").pop()!;
              return (
                <div
                  key={e.path}
                  draggable={!renaming}
                  onDragStart={(ev) => ev.dataTransfer.setData(ASSET_MIME, e.path)}
                  onDragOver={(ev) => {
                    if (!e.dir) return;
                    ev.preventDefault();
                    setHoverFolder(e.path);
                  }}
                  onDragLeave={() => setHoverFolder(null)}
                  onDrop={e.dir ? dropOn(e.path) : undefined}
                  onClick={() => {
                    setSelected(e.path);
                    if (!e.dir) onOpenFile(e.path);
                  }}
                  onDoubleClick={() => e.dir && setCwd(e.path)}
                  className={clsx("flex cursor-default flex-col items-center gap-1 rounded-lg p-1.5", selected === e.path && "bg-spark-500/15", hoverFolder === e.path && "bg-spark-500/25")}>
                  <div className="grid h-11 w-full place-items-center">
                    {e.dir ? (
                      <FolderIcon open={hoverFolder === e.path} />
                    ) : IMAGE.test(name) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/projects/${projectId}/files?raw&path=${encodeURIComponent(e.path)}`} alt="" className="max-h-11 max-w-full rounded object-contain" />
                    ) : (
                      <File size={26} className="text-ink-500" />
                    )}
                  </div>
                  {renaming === e.path ? (
                    <input
                      autoFocus
                      defaultValue={name}
                      onFocus={(ev) => {
                        const dot = name.lastIndexOf(".");
                        ev.target.setSelectionRange(0, e.dir || dot <= 0 ? name.length : dot);
                      }}
                      onBlur={(ev) => void rename(e.path, ev.target.value)}
                      onKeyDown={(ev) => {
                        ev.stopPropagation();
                        if (ev.key === "Enter") (ev.target as HTMLInputElement).blur();
                        if (ev.key === "Escape") setRenaming(null);
                      }}
                      className="w-full rounded bg-ink-800 px-1 text-center text-[10.5px] text-ink-100 outline-none"
                    />
                  ) : (
                    <span onDoubleClick={(ev) => (ev.stopPropagation(), setRenaming(e.path))} className="w-full truncate text-center text-[10.5px] text-ink-300">
                      {name}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {!entries.length && <p className="px-4 py-2 text-[11.5px] text-ink-500">Empty folder. Drop files here.</p>}
          <div className="flex items-center justify-between px-3 pt-1.5 text-[10.5px] text-ink-600">
            <span>{upload ?? error ?? "Enter to rename · drag onto a folder"}</span>
            {selected && (
              <button
                onClick={() => {
                  if (confirm(`Delete ${selected.split("/").pop()}?`)) {
                    void op({ type: "delete", path: selected });
                    setSelected(null);
                  }
                }}
                className="cursor-pointer text-ink-500 hover:text-red-400">
                <Trash2 size={12} />
              </button>
            )}
          </div>
          {error && <p className="px-3 text-[11px] text-red-400">{error}</p>}
        </Section>
    ),
    source: (
        <Section handle={grip("source")} title={pageFile && !allSource ? "Source · this page" : "Source"} count={pageFile && !allSource ? pageFiles.length : source.length} openKey={reveal}>
          {pageFile && !allSource ? (
            // A focused page only lists the files it is built from, in their folders.
            <div className="pb-1">
              <SourceTree files={pageFiles} onOpen={onOpenFile} active={active} reveal={reveal} />
              <button onClick={() => setAllSource(true)} className="ml-3 mt-1 cursor-pointer text-[11px] text-spark-400 hover:text-spark-300">
                Show all {source.length} files
              </button>
            </div>
          ) : (
            <>
              <SourceTree files={source} onOpen={onOpenFile} active={active} reveal={reveal} />
              {pageFile && (
                <button onClick={() => setAllSource(false)} className="ml-3 mt-1 cursor-pointer text-[11px] text-spark-400 hover:text-spark-300">
                  Only this page&apos;s files
                </button>
              )}
            </>
          )}
        </Section>
    ),
    history: native ? null : (
          <Section handle={grip("history")} title="History" count={state.commits.length}>
            <History state={state} onOpenPage={onOpenPage} />
          </Section>
    ),
  };

  return (
    <aside
      className="flex min-h-0 flex-1 flex-col border-r border-[var(--line)] bg-[var(--panel)]"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDropping(true);
        }
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDropping(false)}
      onDrop={dropOn(cwd)}>
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-[var(--line)] px-3 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
        Explorer {native && <span className="rounded bg-sky-400/15 px-1.5 py-0.5 text-[10px] text-sky-300">iOS</span>}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {order.map((id) => {
          const node = sections[id];
          if (!node) return null;
          return (
            // A drop on the top half of a section puts the dragged one before it, on the bottom half after it.
            <div
              key={id}
              className={clsx("relative", dragging === id && "opacity-40")}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes(SECTION_MIME)) return;
                e.preventDefault();
                e.stopPropagation();
                const r = e.currentTarget.getBoundingClientRect();
                setOver({ id, after: e.clientY > r.top + r.height / 2 });
              }}
              onDrop={(e) => {
                if (!e.dataTransfer.types.includes(SECTION_MIME)) return;
                e.preventDefault();
                e.stopPropagation();
                const from = e.dataTransfer.getData(SECTION_MIME) as SectionId;
                if (from && over) move(from, id, over.after);
                setOver(null);
                setDragging(null);
              }}>
              {over?.id === id && dragging && dragging !== id && <div className={clsx("pointer-events-none absolute inset-x-2 z-10 h-0.5 rounded-full bg-spark-500", over.after ? "-bottom-px" : "-top-px")} />}
              {node}
            </div>
          );
        })}
      </div>
      <div className="shrink-0 border-t border-[var(--line)] px-3 py-1.5 font-mono text-[10.5px] text-ink-500">
        {native ? "imported · read-only" : headSha ? `Saved automatically · ${state.commits.length} versions` : "Nothing saved yet"}
      </div>
    </aside>
  );
}

type Tree = { name: string; path: string; children: Map<string, Tree>; file: boolean };

type Reveal = { active?: string | null; reveal?: number };

function SourceTree({ files, onOpen, expanded, active, reveal }: { files: string[]; onOpen: (p: string) => void; expanded?: boolean } & Reveal) {
  const root = useMemo(() => {
    const r: Tree = { name: "", path: "", children: new Map(), file: false };
    for (const f of files) {
      let node = r;
      f.split("/").forEach((part, i, arr) => {
        const p = arr.slice(0, i + 1).join("/");
        if (!node.children.has(part)) node.children.set(part, { name: part, path: p, children: new Map(), file: i === arr.length - 1 });
        node = node.children.get(part)!;
      });
    }
    return r;
  }, [files]);
  return <TreeLevel node={root} depth={0} onOpen={onOpen} expanded={expanded} active={active} reveal={reveal} />;
}

function TreeLevel({ node, depth, onOpen, expanded, active, reveal }: { node: Tree; depth: number; onOpen: (p: string) => void; expanded?: boolean } & Reveal) {
  const kids = [...node.children.values()].sort((a, b) => Number(a.file) - Number(b.file) || a.name.localeCompare(b.name));
  return (
    <>
      {kids.map((k) =>
        k.file ? (
          <FileRow key={k.path} node={k} depth={depth} onOpen={onOpen} active={active} reveal={reveal} />
        ) : (
          <FolderRow key={k.path} node={k} depth={depth} onOpen={onOpen} expanded={expanded} active={active} reveal={reveal} />
        ),
      )}
    </>
  );
}

/** Material Icon Theme icon for a file or folder name (served by /api/file-icon). */
export function MaterialIcon({ name, folder, open }: { name: string; folder?: boolean; open?: boolean }) {
  const q = new URLSearchParams({ name, ...(folder ? { kind: "folder" } : {}), ...(open ? { open: "1" } : {}) });
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/api/file-icon?${q}`} alt="" width={16} height={16} className="size-4 shrink-0" draggable={false} />;
}

function FolderRow({ node, depth, onOpen, expanded, active, reveal }: { node: Tree; depth: number; onOpen: (p: string) => void; expanded?: boolean } & Reveal) {
  const [open, setOpen] = useState(!!expanded);
  // Unfolds to show the open file when it's revealed.
  useEffect(() => {
    if (reveal && active?.startsWith(node.path + "/")) setOpen(true);
  }, [reveal, active, node.path]);
  return (
    <>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full cursor-pointer items-center gap-1.5 py-0.5 text-left text-[12px] text-ink-300 hover:bg-ink-800/60" style={{ paddingLeft: 12 + depth * 12 }}>
        {open ? <ChevronDown size={11} className="shrink-0 text-ink-600" /> : <ChevronRight size={11} className="shrink-0 text-ink-600" />}
        <MaterialIcon name={node.name} folder open={open} />
        <span className="truncate">{node.name}</span>
      </button>
      {open && <TreeLevel node={node} depth={depth + 1} onOpen={onOpen} expanded={expanded} active={active} reveal={reveal} />}
    </>
  );
}

function FileRow({ node, depth, onOpen, active, reveal }: { node: Tree; depth: number; onOpen: (p: string) => void } & Reveal) {
  const row = useRef<HTMLButtonElement>(null);
  const on = active === node.path;
  useEffect(() => {
    if (reveal && on) row.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [reveal, on]);
  return (
    <button
      ref={row}
      onClick={() => onOpen(node.path)}
      className={clsx("flex w-full cursor-pointer items-center gap-1.5 py-0.5 text-left text-[12px] hover:bg-ink-800/60", on ? "bg-spark-500/15 text-ink-100" : "text-ink-300")}
      style={{ paddingLeft: 24 + depth * 12 }}>
      <MaterialIcon name={node.name} />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

const IMPORT = /import\s+(?:type\s+)?([^'"]*?)\s*from\s*['"]([^'"]+)['"]/g;

/** The page's file plus the project files it imports (two levels deep). */
function usePageFiles(projectId: string, pageFile: string | undefined, all: string[]) {
  const [found, setFound] = useState<string[]>([]);
  const key = all.join("|");
  useEffect(() => {
    if (!pageFile) return setFound([]);
    let live = true;
    const known = new Set(all);
    const resolve = (from: string, spec: string) => {
      let base: string;
      if (spec.startsWith("@/")) base = spec.slice(2);
      else if (spec.startsWith(".")) {
        const parts = from.split("/").slice(0, -1);
        for (const seg of spec.split("/")) seg === ".." ? parts.pop() : seg !== "." && parts.push(seg);
        base = parts.join("/");
      } else return null;
      return ["", ".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts"].map((e) => base + e).find((c) => known.has(c)) ?? null;
    };
    void (async () => {
      const out = [pageFile];
      let level = [pageFile];
      for (let depth = 0; depth < 2 && level.length; depth++) {
        const next: string[] = [];
        for (const f of level) {
          const res = await fetch(`/api/projects/${projectId}/files?path=${encodeURIComponent(f)}`).catch(() => null);
          const text: string = res?.ok ? ((await res.json()).content ?? "") : "";
          for (const m of text.matchAll(IMPORT)) {
            const r = resolve(f, m[2]);
            if (!r || r.startsWith("components/sparkflow")) continue;
            // A barrel (folder/index) stands for the components named in the import, not the whole folder.
            const names = /\{([^}]*)\}/.exec(m[1])?.[1].split(",").map((n) => n.trim().split(/\s+as\s+/)[0]).filter(Boolean) ?? [];
            const dir = r.replace(/\/index\.(tsx?|jsx?)$/, "");
            const targets = dir !== r && names.length ? names.map((n) => resolve(dir + "/x", "./" + n)).filter((t): t is string => !!t) : [r];
            for (const t of targets) {
              if (out.includes(t)) continue;
              out.push(t);
              // Kit components are leaves: their own imports are styling details.
              if (dir === r) next.push(t);
            }
          }
        }
        level = next;
      }
      if (live) setFound(out);
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, pageFile, key]);
  return found.length ? found : pageFile ? [pageFile] : [];
}

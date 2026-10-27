"use client";

import clsx from "clsx";
import { Check, FolderInput, FolderPlus, History as HistoryIcon, ImagePlus, MessageSquare, RotateCcw, Sparkles, Trash2, TriangleAlert, Undo2 } from "lucide-react";
import { useState } from "react";
import type { ProjectState } from "@/lib/shared";
import { timeAgo } from "@/lib/web/media";

type Commit = ProjectState["commits"][number];
type Entry = { icon: typeof Check; tone: string; title: string; detail?: string };

/** A commit message in plain words: what happened, not how it was saved. */
export function describe(c: Commit, title: (route: string) => string | undefined): Entry {
  const m = c.message;
  if (m.startsWith("Foundation")) return { icon: Sparkles, tone: "bg-spark-500/15 text-spark-400", title: "App created", detail: "Look, colours and navigation" };
  let r = /^Undo (.+)$/.exec(m);
  if (r) return { icon: Undo2, tone: "bg-amber-500/15 text-amber-400", title: `Undid a change on ${r[1]}` };
  r = /^Restore (.+) to v(\d+)$/.exec(m);
  if (r) return { icon: RotateCcw, tone: "bg-sky-500/15 text-sky-400", title: `${r[1]} back to version ${r[2]}` };
  r = /^(.+) v(\d+)( \(unverified\))?$/.exec(m);
  if (r) {
    const first = r[2] === "1";
    return r[3]
      ? { icon: TriangleAlert, tone: "bg-amber-500/15 text-amber-400", title: `${r[1]} ${first ? "added" : "updated"}`, detail: "Not every check passed" }
      : { icon: Check, tone: "bg-emerald-500/15 text-emerald-400", title: `${r[1]} ${first ? "added" : "updated"}`, detail: "Checked and verified" };
  }
  // Images and folders in the assets panel.
  const name = (p: string) => p.split("/").pop();
  r = /^Add asset (.+)$/.exec(m);
  if (r) return { icon: ImagePlus, tone: "bg-sky-500/15 text-sky-400", title: `Added the image ${name(r[1])}` };
  r = /^New folder (.+)$/.exec(m);
  if (r) return { icon: FolderPlus, tone: "bg-sky-500/15 text-sky-400", title: `Created the folder ${name(r[1])}` };
  r = /^Move (.+) to (.+)$/.exec(m);
  if (r) return { icon: FolderInput, tone: "bg-sky-500/15 text-sky-400", title: `Moved ${name(r[1])}`, detail: `to ${r[2].split("/").slice(-2, -1)[0] ?? "assets"}` };
  r = /^Delete (.+)$/.exec(m);
  if (r) return { icon: Trash2, tone: "bg-rose-400/15 text-rose-300", title: `Removed ${name(r[1])}` };
  r = /^([^:\n]+): ([\s\S]+)$/.exec(m);
  if (r) {
    const ask = r[2].replace(/\s+/g, " ").trim();
    return { icon: MessageSquare, tone: "bg-violet-400/15 text-violet-300", title: `You asked: “${ask}”`, detail: r[1] === "App" ? "Whole app" : r[1] };
  }
  return { icon: HistoryIcon, tone: "bg-rose-400/15 text-rose-300", title: m, detail: c.routes.map(title).filter(Boolean).join(", ") || undefined };
}

/** Saved versions of the app as a friendly timeline; a click opens the page that changed. */
export function History({ state, onOpenPage }: { state: ProjectState; onOpenPage: (route: string) => void }) {
  const [all, setAll] = useState(false);
  const commits = [...state.commits].reverse();
  const shown = all ? commits : commits.slice(0, 5);
  const title = (route: string) => state.screens[route]?.title;
  if (!commits.length) return <p className="px-4 py-2 text-[11.5px] text-ink-500">Every change will be saved here automatically.</p>;
  return (
    <div className="px-2 pb-1">
      <ol className="relative">
        {shown.map((c, i) => {
          const e = describe(c, title);
          const route = c.routes.find((r) => state.screens[r]);
          return (
            <li key={c.sha}>
              <button
                disabled={!route}
                onClick={() => route && onOpenPage(route)}
                title={route ? `Open ${title(route)}` : undefined}
                className={clsx("group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left", route && "cursor-pointer hover:bg-ink-800/60")}>
                <span className={clsx("grid size-5 shrink-0 place-items-center rounded-full", e.tone)}>
                  <e.icon size={11} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] text-ink-200">{e.title}</span>
                  <span className="block truncate text-[10.5px] text-ink-500">
                    {i === 0 ? "Latest · " : ""}
                    {timeAgo(c.ts)}
                    {e.detail ? ` · ${e.detail}` : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {commits.length > 5 && (
        <button onClick={() => setAll((a) => !a)} className="ml-2 mt-0.5 cursor-pointer text-[11px] text-spark-400 hover:text-spark-300">
          {all ? "Show less" : `Show all ${commits.length} versions`}
        </button>
      )}
    </div>
  );
}

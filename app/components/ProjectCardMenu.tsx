"use client";

import clsx from "clsx";
import { Download, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiFetch, backendUrl } from "@/lib/web/backend";

/** Hover menu of a project card: rename, export, delete. */
export function ProjectCardMenu({ id, native, onRename, onDeleted }: { id: string; native?: boolean; onRename: () => void; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const item = "flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-white/5";
  return (
    <div ref={ref} className="absolute right-2 top-2 z-10" onClick={(e) => e.preventDefault()}>
      <button
        aria-label="Project actions"
        onClick={(e) => {
          // The card is a link: keep the click from opening the project.
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={clsx("grid size-7 cursor-pointer place-items-center rounded-lg border border-white/10 bg-ink-950/70 text-ink-300 backdrop-blur transition hover:text-ink-100", open ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-40 rounded-xl border border-white/10 bg-ink-900 p-1 text-ink-200 shadow-xl">
          <button
            className={item}
            onClick={() => {
              setOpen(false);
              onRename();
            }}>
            <Pencil size={13} /> Rename
          </button>
          {!native && (
            <a className={item} href={backendUrl(`/api/projects/${id}/export`)} onClick={(e) => {
                // Let this inner link download instead of the card opening the project.
                e.stopPropagation();
                setOpen(false);
              }}>
              <Download size={13} /> Export .zip
            </a>
          )}
          <button
            className={clsx(item, "text-red-400")}
            onClick={() => {
              // Gone from the grid at once; the server deletes the folder and sandbox meanwhile.
              setOpen(false);
              onDeleted();
              void apiFetch(`/api/projects/${id}`, { method: "DELETE" });
            }}>
            <Trash2 size={13} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

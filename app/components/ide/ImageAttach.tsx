"use client";

import { X } from "lucide-react";
import { useState, type ClipboardEvent, type DragEvent } from "react";
import type { MediaInput } from "@/lib/shared";
import { attachProblem, fileToAttachment, MAX_ATTACHMENTS } from "@/lib/web/media";
import { MaterialIcon } from "./FileTree";

export type Attached = { input: MediaInput; name: string; url?: string };

/** The drop border of a prompt field: dashed blue while files are dragged over it. */
export const dropBorder = (dragging: boolean, rest = "border-[var(--line)]") => (dragging ? "border-dashed border-spark-500" : rest);

/**
 * Files attached to a prompt field (sketches, screenshots, iPhone photos, a PDF or Markdown spec): dropped
 * on the field's box, picked, or pasted. Each is checked for kind and size. Spread `zone` on the box and
 * `paste` on its text field.
 */
export function useAttachments(disabled = false) {
  const [files, setFiles] = useState<Attached[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const add = async (list: FileList | File[] | null | undefined) => {
    const all = [...(list ?? [])];
    if (!all.length || disabled) return;
    const problems: string[] = [];
    const next: Attached[] = [];
    for (const f of all) {
      const problem = attachProblem(f);
      if (problem) {
        problems.push(problem);
        continue;
      }
      try {
        next.push({ input: await fileToAttachment(f), name: f.name, ...(/^image\/(png|jpeg|webp|gif)$/.test(f.type) ? { url: URL.createObjectURL(f) } : {}) });
      } catch {
        problems.push(`${f.name} could not be read.`);
      }
    }
    setFiles((cur) => {
      const merged = [...cur, ...next.filter((n) => !cur.some((c) => c.name === n.name))];
      if (merged.length > MAX_ATTACHMENTS) problems.push(`${MAX_ATTACHMENTS} files at most.`);
      return merged.slice(0, MAX_ATTACHMENTS);
    });
    setError(problems[0] ?? null);
  };
  return {
    files,
    error,
    dragging,
    inputs: () => files.map((f) => f.input),
    add,
    remove: (name: string) => setFiles((cur) => cur.filter((f) => f.name !== name)),
    clear: () => (setFiles([]), setError(null)),
    zone: {
      onDragOver: (e: DragEvent) => {
        if (disabled || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        e.stopPropagation();
        setDragging(true);
      },
      onDragLeave: (e: DragEvent) => !e.currentTarget.contains(e.relatedTarget as Node) && setDragging(false),
      onDrop: (e: DragEvent) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        e.stopPropagation();
        setDragging(false);
        void add(e.dataTransfer.files);
      },
    },
    paste: (e: ClipboardEvent) => {
      if (!e.clipboardData.files.length) return;
      e.preventDefault();
      void add(e.clipboardData.files);
    },
  };
}

/** The attached files (each with its own name and a remove button), the drop hint, or why one was refused. */
export function AttachedFiles({ a, hint = true }: { a: ReturnType<typeof useAttachments>; hint?: boolean }) {
  return (
    <>
      {a.dragging && <p className="text-[11px] text-spark-300">Drop to attach: images, HEIC, PDF or Markdown, 10 MB each</p>}
      {a.error && !a.dragging && <p className="text-[11px] text-red-400">{a.error}</p>}
      {a.files.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {a.files.map((f) => (
            <span key={f.name} className="flex max-w-[220px] items-center gap-1.5 rounded-md border border-[var(--line)] bg-ink-800/60 py-0.5 pr-1 pl-1 text-[11px] text-ink-200">
              {f.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.url} alt="" className="size-5 shrink-0 rounded object-cover" />
              ) : (
                <MaterialIcon name={f.name} />
              )}
              <span className="truncate">{f.name}</span>
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => a.remove(f.name)} className="cursor-pointer text-ink-500 hover:text-ink-100">
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
      {hint && !a.files.length && !a.dragging && !a.error && <p className="text-[10.5px] text-ink-600">Drop or paste sketches, screenshots, a PDF or Markdown spec</p>}
    </>
  );
}

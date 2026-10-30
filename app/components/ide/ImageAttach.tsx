"use client";

import { X } from "lucide-react";
import { useState, type ClipboardEvent, type DragEvent } from "react";
import type { MediaInput } from "@/lib/shared";
import { droppedImage, imageProblem, imageToInput } from "@/lib/web/media";

export type Attached = { input: MediaInput; url: string };

/**
 * A picture attached to a prompt field (a sketch of the page, a screenshot): dropped on the field's box or
 * pasted into it, checked for format and size. Spread `zone` on the box and `paste` on its text field.
 */
export function useImageAttach(disabled = false) {
  const [image, setImage] = useState<Attached | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const attach = async (f?: File | null) => {
    if (!f || disabled) return;
    const problem = imageProblem(f);
    setError(problem);
    if (problem) return;
    try {
      setImage({ input: await imageToInput(f), url: URL.createObjectURL(f) });
    } catch {
      setError("That image could not be read.");
    }
  };
  return {
    image,
    error,
    dragging,
    clear: () => (setImage(null), setError(null)),
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
        void attach(droppedImage(e.dataTransfer.files));
      },
    },
    paste: (e: ClipboardEvent) => {
      const img = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
      if (!img) return;
      e.preventDefault();
      void attach(img);
    },
  };
}

/** The attached picture (with a remove button), the drop hint while dragging, or why one was refused. */
export function AttachedImage({ a }: { a: ReturnType<typeof useImageAttach> }) {
  if (a.dragging) return <p className="text-[11px] text-spark-300">Drop the image (PNG, JPEG, WebP or GIF, 10 MB at most)</p>;
  if (a.error) return <p className="text-[11px] text-red-400">{a.error}</p>;
  if (!a.image) return <p className="text-[10.5px] text-ink-600">Drop or paste a sketch of it to guide the agent</p>;
  return (
    <span className="flex items-center gap-2 text-[11px] text-ink-300">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={a.image.url} alt="" className="size-8 rounded object-cover" />
      Sketch attached
      <button type="button" aria-label="Remove the image" onClick={a.clear} className="cursor-pointer text-ink-500 hover:text-ink-100">
        <X size={12} />
      </button>
    </span>
  );
}

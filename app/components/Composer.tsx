"use client";

import clsx from "clsx";
import { ArrowUp, ArrowUpRight, ImagePlus, Mic } from "lucide-react";
import { useRef, useState } from "react";

const EXAMPLES = [
  "A habit tracker: today's habits with checkboxes and streaks, a weekly stats chart, a habit detail page and reminders.",
  "A recipe app: browse recipes as photo cards, filter by category, a recipe detail page with ingredients and steps.",
  "A personal budget app: monthly balance, spending by category with a chart, a transaction list and add form.",
];

/** Zone de saisie de la landing : texte, croquis ou mémo vocal, plus des exemples cliquables. */
export function Composer() {
  const [value, setValue] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const ready = value.trim().length > 0;

  return (
    <div className="text-left">
      <div className="rounded-3xl border border-ink-700 bg-ink-900/80 p-4 pl-5 shadow-[0_30px_80px_-24px_var(--landing-glow)] backdrop-blur focus-within:border-ink-600">
        <textarea
          ref={input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={3}
          placeholder="Describe the mobile app you want, drop a sketch or record a voice memo..."
          className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-ink-100 outline-none placeholder:text-ink-500"
        />
        <div className="mt-2 flex items-center justify-between">
          <div className="flex gap-4 text-sm text-ink-300">
            <button className="flex items-center gap-1.5 hover:text-ink-100">
              <ImagePlus size={17} /> Sketch
            </button>
            <button className="flex items-center gap-1.5 hover:text-ink-100">
              <Mic size={17} /> Voice
            </button>
          </div>
          <button
            disabled={!ready}
            className={clsx(
              "flex items-center gap-2 rounded-full py-1.5 pl-4 pr-1.5 text-sm transition",
              ready ? "bg-spark-500 text-white" : "bg-ink-800 text-ink-500",
            )}>
            Build app
            <span className={clsx("grid size-6 place-items-center rounded-full", ready ? "bg-white/20" : "bg-ink-700")}>
              <ArrowUp size={14} />
            </span>
          </button>
        </div>
      </div>

      <ul data-no-lens className="mx-auto mt-6 max-w-[80%]">
        {EXAMPLES.map((ex) => (
          <li key={ex}>
            <button
              onClick={() => {
                setValue(ex);
                input.current?.focus();
              }}
              className="group flex w-full cursor-pointer items-center justify-between gap-4 border-b border-ink-800 py-2.5 text-left text-[13.5px] text-ink-400 hover:text-ink-100">
              <span className="truncate">{ex}</span>
              <ArrowUpRight size={14} className="shrink-0 text-ink-500 transition group-hover:text-spark-500" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

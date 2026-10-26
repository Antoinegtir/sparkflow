"use client";

import { useRef, useState } from "react";
import { ArrowUp, ArrowUpRight, ImagePlus, Mic } from "lucide-react";

const EXAMPLES = [
  "A habit tracker: today's habits with checkboxes and streaks, a weekly stats chart, a habit detail page and reminders.",
  "A recipe app: browse recipes as photo cards, filter by category, a recipe detail page with ingredients and steps.",
  "A personal budget app: monthly balance, spending by category with a chart, a transaction list and add form.",
];

export function Prompt() {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const ready = value.trim().length > 0;

  return (
    <>
      <div className="mx-auto max-w-[950px] rounded-[26px] border border-[#222a35] bg-panel pb-4 pl-8 pr-5 pt-6 text-left shadow-[0_30px_80px_-20px_rgba(26,140,255,.18)]">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Describe the mobile app you want, drop a sketch or record a voice memo..."
          className="min-h-[90px] w-full resize-none bg-transparent text-[19px] outline-none placeholder:text-dim"
        />
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-6">
            <button className="flex items-center gap-2 text-lg text-[#b9c0cb] hover:text-fg">
              <ImagePlus size={22} strokeWidth={1.7} /> Sketch
            </button>
            <button className="flex items-center gap-2 text-lg text-[#b9c0cb] hover:text-fg">
              <Mic size={22} strokeWidth={1.7} /> Voice
            </button>
          </div>
          <button
            disabled={!ready}
            className={`flex items-center gap-2.5 rounded-full py-3 pl-5 pr-2.5 text-lg transition ${
              ready ? "bg-apple text-white" : "bg-[#171d26] text-dim"
            }`}
          >
            Build app
            <span className={`grid size-[30px] place-items-center rounded-full ${ready ? "bg-white/20" : "bg-[#262d38]"}`}>
              <ArrowUp size={16} />
            </span>
          </button>
        </div>
      </div>

      <div className="mx-auto mt-8 max-w-[760px]">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => {
              setValue(ex);
              ref.current?.focus();
            }}
            className="flex w-full justify-between gap-6 border-b border-[#161b23] py-4 text-left text-[16.5px] text-[#9ea6b3] hover:text-fg"
          >
            <span className="truncate">{ex}</span>
            <ArrowUpRight size={16} className="shrink-0 text-dim" />
          </button>
        ))}
      </div>
    </>
  );
}

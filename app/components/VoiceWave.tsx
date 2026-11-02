"use client";

import { Check, X } from "lucide-react";

/** The recording strip: cancel, a voice waveform scrolling to the left, and a confirm button. */
export function VoiceWave({ levels, seconds, onCancel, onDone }: { levels: number[]; seconds: number; onCancel: () => void; onDone: () => void }) {
  return (
    <div className="flex w-full items-center gap-3">
      <button onClick={onCancel} aria-label="Cancel dictation" className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full bg-ink-800 text-ink-100 hover:bg-ink-700">
        <X size={15} />
      </button>
      <div className="flex h-8 min-w-0 flex-1 items-center justify-end gap-[3px] overflow-hidden" aria-hidden>
        {levels.map((l, i) => (
          <span key={i} className="w-[3px] shrink-0 rounded-full bg-ink-200" style={{ height: `${Math.max(3, Math.round(l * 28))}px`, opacity: l > 0.04 ? 1 : 0.4 }} />
        ))}
      </div>
      <span className="hidden shrink-0 text-[10.5px] text-ink-500 sm:inline">Muse Voice Transcribe</span>
      <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-ink-400">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>
      <button onClick={onDone} aria-label="Finish dictation" className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full bg-spark-500 text-white hover:bg-spark-400">
        <Check size={15} />
      </button>
    </div>
  );
}

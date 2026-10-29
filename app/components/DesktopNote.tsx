"use client";

import { Check, Laptop, Share } from "lucide-react";
import { useState } from "react";

/**
 * On a phone: Sparkflow builds and runs apps on a computer (it drives the iOS Simulator and Android
 * emulator there), so this page sends you to one, with the link ready to share or copy.
 */
export function DesktopNote({ what = "build and open your apps" }: { what?: string }) {
  const [copied, setCopied] = useState(false);
  async function send() {
    const url = location.origin;
    try {
      if (navigator.share) return await navigator.share({ title: "Sparkflow", text: "Open Sparkflow on my computer", url });
    } catch {
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }
  return (
    <div className="mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-spark-500/30 bg-spark-500/[0.07] p-4 text-left">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-spark-500/15 text-spark-400">
        <Laptop size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-[14px] font-medium text-ink-100">Continue on your Mac or Linux computer</p>
        <p className="mt-1 text-[12.5px] leading-snug text-ink-400">
          Sparkflow runs on your computer, with the iOS Simulator and the Android emulator, to {what}. Open this page there.
        </p>
        <button type="button" onClick={() => void send()} className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-spark-500 px-3 py-1.5 text-[12.5px] font-medium text-white">
          {copied ? <Check size={13} /> : <Share size={13} />}
          {copied ? "Link copied" : "Send the link to my computer"}
        </button>
      </div>
    </div>
  );
}

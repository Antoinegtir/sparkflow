"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";
import { useDevClientStatus } from "@/lib/web/dev-client-status";
import { dismissSimOpen, FIRST_BUILD, retrySimOpen, useSimOpen } from "@/lib/web/sim-open";
import { CupertinoSpinner } from "./ui";

const elapsed = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Over the live Simulator / emulator while an app opens in Sparkflow Dev: the build (first time only),
 * install and open steps with the time elapsed, or the error with a retry. Shared by the focus view and Play.
 */
export function DevClientOverlay({ name }: { name: string }) {
  const open = useSimOpen();
  const opening = open.phase === "opening";
  const build = useDevClientStatus(opening);
  const building = build?.state === "building";
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!opening) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [opening]);
  const device = open.platform === "android" ? "emulator" : "Simulator";
  const time = opening && open.started ? elapsed(now - open.started) : "";

  return (
    <div className={clsx("absolute inset-0 grid place-items-center bg-black transition-opacity duration-300", open.phase === "idle" ? "pointer-events-none opacity-0" : "opacity-100")}>
      {open.phase === "error" ? (
        <div className="flex max-w-[280px] flex-col items-center gap-3 text-center text-[13px] text-white/80">
          <span className="font-medium text-[#ff6961]">Couldn&apos;t open {name} in Sparkflow Dev</span>
          <pre className="max-h-[200px] w-full overflow-auto rounded-md bg-white/10 p-2 text-left font-mono text-[10.5px] whitespace-pre-wrap text-white/60">{open.error}</pre>
          <div className="flex gap-2">
            <button onClick={() => void retrySimOpen()} className="cursor-pointer rounded-md bg-white/20 px-3 py-1 text-[12px] text-white hover:bg-white/30">
              Retry
            </button>
            <button onClick={dismissSimOpen} className="cursor-pointer rounded-md px-3 py-1 text-[12px] text-white/60 hover:bg-white/10">
              Dismiss
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 text-[13px] text-white/70">
          <span className="scale-[1.4]">
            <CupertinoSpinner />
          </span>
          {building ? `Building Sparkflow Dev… ${build.percent ?? 0}%` : `Opening ${name} in Sparkflow Dev…`}
          <span className="max-w-[260px] text-center text-[11.5px] text-white/40">
            {building
              ? `${build.step}. The first build takes ${FIRST_BUILD[build.platform ?? open.platform]}, then apps open in seconds.`
              : `The first time, Sparkflow Dev is installed on the ${device}.`}
          </span>
          {time && <span className="font-mono text-[11px] text-white/35 tabular-nums">{time}</span>}
        </div>
      )}
    </div>
  );
}

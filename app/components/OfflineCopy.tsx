"use client";

import clsx from "clsx";
import { Moon, Sun, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "@/app/components/Logo";
import { SignIn } from "@/app/components/SignIn";
import { Capture } from "@/app/components/ide/Canvas";
import { deviceById, DeviceMockup } from "@/app/components/ide/ui";
import { loadCloudCopy } from "@/lib/web/cloud-copy";

type Copy = NonNullable<Awaited<ReturnType<typeof loadCloudCopy>>>;

const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60_000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 48 * 60 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
};

/**
 * A shared project while the owner's computer is offline: its last saved pages (the cloud copy), read
 * only. The live project comes back by itself when their computer does (SharedShell keeps watching).
 */
export function OfflineCopy({ copy }: { copy: Copy }) {
  const [dark, setDark] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const hasDark = copy.order.some((r) => copy.urls[r]?.dark);
  const url = (r: string) => (dark && copy.urls[r]?.dark) || copy.urls[r]?.shot;
  const from = (r: string) => copy.edges.filter((e) => e.to === r && e.from !== r).map((e) => copy.screens[e.from]?.title).filter(Boolean);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [open]);

  return (
    <div data-ide className="min-h-dvh bg-ink-950 text-ink-100">
      <header className="sticky top-0 z-20 flex h-12 items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--panel)] px-3">
        <div className="flex min-w-0 items-center gap-3">
          <Logo compact />
          <h1 className="truncate text-[14px] font-semibold">{copy.name}</h1>
          <span className="hidden shrink-0 rounded-full border border-[var(--line)] px-2 py-0.5 text-[11px] text-ink-400 sm:inline">{copy.order.length} pages</span>
        </div>
        <div className="flex items-center gap-2">
          {hasDark && (
            <button onClick={() => setDark((d) => !d)} title={dark ? "Light pages" : "Dark pages"} className="grid size-8 cursor-pointer place-items-center rounded-lg text-ink-400 hover:bg-ink-800 hover:text-ink-100">
              {dark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          )}
          <SignIn />
        </div>
      </header>
      <p className="bg-amber-500/90 px-4 py-1.5 text-center text-xs text-black">
        The owner&apos;s computer is offline: these are the app&apos;s pages as last saved{copy.updatedAt ? ` (${ago(copy.updatedAt)})` : ""}. The live project comes back when it does.
      </p>
      <div className="mx-auto grid max-w-6xl grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-8 px-6 py-10">
        {copy.order.map((r) => {
          const s = copy.screens[r];
          const u = url(r);
          const parents = from(r);
          return (
            <button key={r} onClick={() => u && setOpen(r)} className={clsx("flex flex-col items-center gap-2 text-center", u ? "cursor-zoom-in" : "cursor-default")}>
              <span className="flex items-baseline gap-1.5 text-[12.5px]">
                <span className="font-medium text-ink-100">{s.title}</span>
                <span className="font-mono text-[11px] text-ink-500">{r}</span>
              </span>
              <DeviceMockup device={deviceById()} width={200} dark={dark}>
                {u ? <Capture url={u} title={s.title} blurred={false} /> : <div className="grid h-full place-items-center bg-ink-800 text-[11px] text-ink-500">No screenshot yet</div>}
              </DeviceMockup>
              {parents.length > 0 && <span className="text-[11px] text-ink-500">Opened from {parents.join(", ")}</span>}
            </button>
          );
        })}
      </div>
      {open && url(open) && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-6" onClick={() => setOpen(null)}>
          <button aria-label="Close" className="absolute top-4 right-4 grid size-9 cursor-pointer place-items-center rounded-full bg-ink-800 text-ink-200 hover:bg-ink-700">
            <X size={16} />
          </button>
          <div onClick={(e) => e.stopPropagation()} className="flex flex-col items-center gap-3">
            <span className="text-[14px] font-medium">{copy.screens[open].title}</span>
            <DeviceMockup device={deviceById()} width={360} dark={dark}>
              <Capture url={url(open)!} title={copy.screens[open].title} blurred={false} />
            </DeviceMockup>
          </div>
        </div>
      )}
    </div>
  );
}

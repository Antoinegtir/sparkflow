"use client";

import clsx from "clsx";
import { ChevronDown, Command, PanelRight, Play, Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import type { ProjectState } from "@/lib/shared";
import type { AppScheme } from "@/lib/web/app-scheme";
import { Logo } from "../Logo";
import { DevicePicker } from "./DevicePicker";

function OpenOnPhone({ state }: { state: ProjectState }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const url = state.preview?.expoGoUrl;
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12.5px] text-ink-300 hover:bg-ink-800 hover:text-ink-100">
        <Smartphone size={14} /> <span className="hidden lg:inline">Open on phone</span> <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-64 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 shadow-2xl">
          {url ? (
            <>
              <div className="mx-auto w-fit rounded-lg bg-white p-2">
                <QRCodeSVG value={url} size={180} />
              </div>
              <p className="mt-3 text-[12px] text-ink-300">Scan with the camera to open the app in Expo Go (same Wi‑Fi).</p>
              <p className="mt-1 truncate font-mono text-[11px] text-ink-500">{url}</p>
            </>
          ) : (
            <p className="text-[12px] text-ink-400">No Expo Go tunnel for this preview.</p>
          )}
          {state.preview?.webUrl && (
            <a href={state.preview.webUrl} target="_blank" rel="noreferrer" className="mt-3 block text-[12px] text-spark-400 hover:underline">
              Open the web preview ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}

type Props = {
  state: ProjectState;
  connected: boolean;
  scheme: AppScheme;
  capturingDark: boolean;
  onScheme: (s: AppScheme) => void;
  onRename: (name: string) => void;
  onPlay: () => void;
  onPalette: () => void;
  panelOpen: boolean;
  onTogglePanel: () => void;
  onDeviceSwitching: (name: string | null) => void;
};

export function TopBar(p: Props) {
  const s = p.state;
  const [editing, setEditing] = useState(false);
  const verified = s.order.filter((r) => s.screens[r]?.status === "done").length;
  const native = !!s.native;
  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--panel)] px-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="shrink-0" title="All projects">
          <Logo compact />
        </span>
        {editing ? (
          <input
            autoFocus
            defaultValue={s.name}
            maxLength={60}
            onBlur={(e) => {
              setEditing(false);
              if (e.target.value.trim() && e.target.value !== s.name) p.onRename(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setEditing(false);
            }}
            className="w-48 rounded-md bg-ink-800 px-2 py-1 text-[14px] font-semibold text-ink-100 outline-none"
          />
        ) : (
          <h1 onDoubleClick={() => setEditing(true)} title="Double-click to rename" className="truncate text-[14px] font-semibold text-ink-100">
            {s.name}
          </h1>
        )}
        {s.order.length > 0 && (
          <span className="hidden shrink-0 rounded-full border border-[var(--line)] px-2 py-0.5 text-[11px] text-ink-400 sm:inline">
            {verified}/{s.order.length} pages verified
          </span>
        )}
        {!p.connected && <span className="animate-pulse-soft text-[11px] text-amber-400">reconnecting…</span>}
      </div>
      <div className="flex items-center gap-1.5">
        {(native || s.previewDevice === "simulator") && <DevicePicker bundleId={s.native?.bundleId} onSwitching={p.onDeviceSwitching} />}
        <button
          onClick={p.onPlay}
          disabled={!s.preview && !native}
          className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-spark-500 px-2.5 py-1.5 text-[12.5px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40">
          <Play size={12} className="fill-current" /> Play
        </button>
        {!native && <OpenOnPhone state={s} />}
        <button onClick={p.onPalette} className="hidden cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] text-ink-400 hover:bg-ink-800 hover:text-ink-100 lg:flex">
          <Command size={13} /> Commands <kbd className="rounded border border-[var(--line)] px-1 font-mono text-[10px]">⌘K</kbd>
        </button>
        <button onClick={p.onTogglePanel} aria-label={p.panelOpen ? "Hide the panel" : "Show the panel"} className={clsx("grid size-8 cursor-pointer place-items-center rounded-lg hover:bg-ink-800", p.panelOpen ? "text-ink-100" : "text-ink-500")}>
          <PanelRight size={15} />
        </button>
      </div>
    </header>
  );
}

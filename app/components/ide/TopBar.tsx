"use client";

import { isCloud, setBackend, setMode } from "@/lib/web/backend";
import clsx from "clsx";
import { Command, Play, Settings, Smartphone, UserPlus, UserRound } from "lucide-react";
import { useState } from "react";
import type { ProjectState } from "@/lib/shared";
import type { Person } from "@/lib/shared/share";
import { useAccess } from "@/lib/web/access";
import type { AppScheme } from "@/lib/web/app-scheme";
import { Logo } from "../Logo";
import { SignIn } from "../SignIn";
import { Avatar } from "./Avatar";
import { ReleaseMenu } from "./ReleaseMenu";
import { RunOn } from "./RunOn";

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
  onDevice: (id: string) => void;
  /** Opens the app's settings (name, icon, splash, bundle ID…), or its Account section; absent for imported native apps. */
  onSettings?: (section?: "account") => void;
  /** Width of the right panel when open: the device and Play end at its edge, over the canvas. */
  panelWidth: number;
  /** Opens the Share dialog; absent when the server can't share (old version) or for guests. */
  onShare?: () => void;
};

const ROLE_TEXT = { edit: "Can edit", comment: "Can comment", view: "Can view" } as const;

export function TopBar(p: Props) {
  const s = p.state;
  const [editing, setEditing] = useState(false);
  const verified = s.order.filter((r) => s.screens[r]?.status === "done").length;
  const native = !!s.native;
  const access = useAccess();
  const owner = access.role === "owner";
  // Sparkflow in the cloud: the web preview only (no Simulator, stores or sharing there).
  const cloud = isCloud();
  // The people the app is shared with (owner first), for the avatar stack.
  const others = Object.entries(access.people).filter(([k, x]) => k !== "owner" && !x.former) as [string, Person][];
  return (
    <header className="relative z-30 flex h-12 shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--panel)] px-3">
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
          <h1 onDoubleClick={() => owner && setEditing(true)} title={owner ? "Double-click to rename" : undefined} className="truncate text-[14px] font-semibold text-ink-100">
            {s.name}
          </h1>
        )}
        {s.order.length > 0 && (
          <span className="hidden shrink-0 rounded-full border border-[var(--line)] px-2 py-0.5 text-[11px] text-ink-400 sm:inline">
            {verified}/{s.order.length} pages verified
          </span>
        )}
        {!owner && access.people.owner && (
          <span className="hidden shrink-0 items-center gap-1.5 text-[11.5px] text-ink-400 sm:flex">
            Shared by <Avatar person={access.people.owner} seed="owner" size={16} /> <span className="text-ink-200">{access.people.owner.name}</span> · {ROLE_TEXT[access.role as keyof typeof ROLE_TEXT]}
          </span>
        )}
        {!p.connected && <span className="animate-pulse-soft text-[11px] text-amber-400">reconnecting…</span>}
      </div>
      {/* Over the canvas, ending at the right panel's edge rather than across its border. */}
      <div className="absolute top-1/2 flex -translate-y-1/2 items-center gap-1.5" style={{ right: p.panelWidth ? p.panelWidth + 12 : 180 }}>
        {owner && !cloud && <RunOn state={s} onDevice={p.onDevice} onSwitching={p.onDeviceSwitching} />}
        {/* In the cloud the app shows in a web preview: the real Simulator and emulator need the sparkflow CLI on a Mac. */}
        {owner && cloud && (
          <button
            onClick={() => {
              setMode("mac");
              setBackend(null);
              location.href = "/connect";
            }}
            title="Install the sparkflow CLI on your Mac to run your apps in the iOS Simulator and the Android emulator"
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[12.5px] text-ink-200 hover:bg-ink-800">
            <Smartphone size={13} /> Run on a real simulator
          </button>
        )}
        {owner && (
        <button
          onClick={p.onPlay}
          disabled={!s.preview && !native}
          className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-spark-500 px-2.5 py-1.5 text-[12.5px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40">
          <Play size={12} className="fill-current" /> Play
        </button>
        )}
        {owner && !native && !cloud && <ReleaseMenu projectId={s.id} onDevice={p.onDevice} onSwitching={p.onDeviceSwitching} />}
      </div>
      <div className="flex items-center gap-1.5">
        {/* Panel open: Commands starts just right of its edge, over the panel. */}
        <button
          onClick={p.onPalette}
          style={p.panelWidth ? { left: `calc(100% - ${p.panelWidth}px + 12px)` } : undefined}
          className={clsx("hidden cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] text-ink-400 hover:bg-ink-800 hover:text-ink-100 lg:flex", p.panelWidth && "absolute top-1/2 -translate-y-1/2")}>
          <Command size={13} /> Commands <kbd className="rounded border border-[var(--line)] px-1 font-mono text-[10px]">⌘K</kbd>
        </button>
        {/* At the right, before the account menu (which holds App settings). */}
        {owner && p.onShare && !cloud && (
          <button onClick={p.onShare} title="Share this app" className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-[12px] text-ink-300 hover:bg-ink-800 hover:text-ink-100">
            {others.length > 0 ? (
              <span className="flex -space-x-1.5">
                {others.slice(0, 3).map(([k, x]) => (
                  <Avatar key={k} person={x} seed={k} size={20} className="ring-2 ring-[var(--panel)]" />
                ))}
                {others.length > 3 && <span className="grid size-5 place-items-center rounded-full bg-ink-700 text-[9.5px] ring-2 ring-[var(--panel)]">+{others.length - 3}</span>}
              </span>
            ) : (
              <UserPlus size={14} />
            )}
            Share
          </button>
        )}
        {/* Mounted once in the IDE so requireSignIn (Share, joining) has a menu to open. */}
        <SignIn
          extra={
            owner && p.onSettings
              ? [
                  { label: "App settings", icon: <Settings size={15} />, onClick: () => p.onSettings!() },
                  { label: "Profile", icon: <UserRound size={15} />, onClick: () => p.onSettings!("account") },
                ]
              : undefined
          }
        />
      </div>
    </header>
  );
}

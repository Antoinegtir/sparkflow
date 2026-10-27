"use client";

import clsx from "clsx";
import { Smartphone } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectSummary } from "@/lib/shared";
import { timeAgo } from "@/lib/web/media";
import { InstallIcon } from "./InstallIcon";
import { ProjectCardMenu } from "./ProjectCardMenu";
import { deviceById, DeviceMockup } from "./ide/ui";

const COVER_W = 132;

const STATUS: Record<string, { label: string; className: string }> = {
  running: { label: "building", className: "text-spark-400" },
  done: { label: "ready", className: "text-emerald-400" },
  failed: { label: "failed", className: "text-red-400" },
  stopped: { label: "stopped", className: "text-amber-400" },
  idle: { label: "idle", className: "text-ink-500" },
};

/** "Your apps": the projects on this machine. Polls only while one is building and the tab is visible. */
export function ProjectGrid() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const draft = useRef("");
  const [installs, setInstalls] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch("/api/projects", { cache: "no-store" }).catch(() => null);
    if (res?.ok) setProjects(await res.json());
  }, []);

  useEffect(() => {
    void load();
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  const anyRunning = projects?.some((p) => p.status === "running");
  useEffect(() => {
    if (!anyRunning) return;
    const t = setInterval(() => document.visibilityState === "visible" && void load(), 5000);
    return () => clearInterval(t);
  }, [anyRunning, load]);

  async function rename(id: string) {
    const name = draft.current.trim().slice(0, 60);
    setRenaming(null);
    if (!name) return;
    setProjects((ps) => ps?.map((p) => (p.id === id ? { ...p, name } : p)) ?? null);
    await fetch(`/api/projects/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
  }

  return (
    <section className="relative mx-auto max-w-5xl px-6 pb-24">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="landing-head text-2xl font-semibold text-ink-100">Your apps</h2>
          <p className="mt-1 text-sm text-ink-500">{projects?.length ? `${projects.length} app${projects.length > 1 ? "s" : ""} on this machine` : "Built and verified on this machine"}</p>
        </div>
      </div>
      <div data-no-lens className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button
          onMouseEnter={() => setInstalls((n) => n + 1)}
          onClick={() => {
            scrollTo({ top: 0, behavior: "smooth" });
            setTimeout(() => document.querySelector<HTMLTextAreaElement>("textarea")?.focus(), 400);
          }}
          className="group relative grid aspect-[4/5] cursor-pointer place-items-center overflow-hidden rounded-2xl border border-dashed border-ink-700 bg-ink-900 text-ink-400 transition hover:-translate-y-1 hover:border-spark-500/60 hover:text-ink-100">
          {/* Blue glow like the app cards, over a dot grid like the magnifier's, fading toward the edges. */}
          <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,color-mix(in_oklab,var(--color-spark-500)_22%,transparent),transparent_70%)]" />
          <span
            className="pointer-events-none absolute inset-0 opacity-60 transition group-hover:opacity-100"
            style={{
              backgroundImage: "radial-gradient(circle, var(--color-ink-400) 1px, transparent 1.4px)",
              backgroundSize: "18px 18px",
              backgroundPosition: "center",
              maskImage: "radial-gradient(circle at 50% 40%, black 0%, transparent 75%)",
            }}
          />
          <span className="relative flex flex-col items-center gap-1 text-sm">
            <InstallIcon replay={installs} label="New app" />
            <span className="text-[11.5px] text-ink-500">Describe, sketch or talk</span>
          </span>
        </button>
        {projects?.map((p) => {
          const st = STATUS[p.status] ?? STATUS.idle;
          return (
            <Link key={p.id} href={`/${p.slug}`} className="group relative flex aspect-[4/5] flex-col overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 shadow-[0_20px_50px_-30px_rgba(0,0,0,.8)] transition hover:-translate-y-1 hover:border-ink-600 hover:shadow-[0_30px_60px_-30px_var(--landing-glow)]">
              <ProjectCardMenu
                id={p.id}
                native={p.native}
                onRename={() => {
                  draft.current = p.name;
                  setRenaming(p.id);
                }}
                onDeleted={() => setProjects((ps) => ps?.filter((x) => x.id !== p.id) ?? null)}
              />
              <div className="relative grid flex-1 place-items-center overflow-hidden bg-[radial-gradient(circle_at_50%_30%,color-mix(in_oklab,var(--color-spark-500)_22%,transparent),transparent_70%)] pt-4">
                {/* Same dot grid as the New app card, behind the device. */}
                <span
                  className="pointer-events-none absolute inset-0 opacity-60 transition group-hover:opacity-100"
                  style={{
                    backgroundImage: "radial-gradient(circle, var(--color-ink-400) 1px, transparent 1.4px)",
                    backgroundSize: "18px 18px",
                    backgroundPosition: "center",
                    maskImage: "radial-gradient(circle at 50% 40%, black 0%, transparent 75%)",
                  }}
                />
                {p.coverUrl ? (
                  // The project's preview device, as in the IDE, peeking out of the card.
                  <div className="relative translate-y-10 transition group-hover:translate-y-7">
                    <DeviceMockup device={deviceById(p.previewDevice)} width={deviceById(p.previewDevice).ipad ? COVER_W * 1.5 : COVER_W} dark={false} bare={p.native}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
                    </DeviceMockup>
                  </div>
                ) : (
                  <Smartphone size={44} strokeWidth={1.2} className="text-ink-300 transition group-hover:scale-105" />
                )}
              </div>
              <div className="relative border-t border-ink-800 bg-ink-900 px-3.5 py-3">
                {renaming === p.id ? (
                  <input
                    autoFocus
                    defaultValue={p.name}
                    maxLength={60}
                    onClick={(e) => e.preventDefault()}
                    onChange={(e) => (draft.current = e.target.value)}
                    onBlur={() => void rename(p.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void rename(p.id);
                      if (e.key === "Escape") setRenaming(null);
                    }}
                    className="w-full rounded bg-ink-800 px-1 text-sm font-medium text-ink-100 outline-none"
                  />
                ) : (
                  <p className="truncate text-sm font-medium text-ink-100">{p.name}</p>
                )}
                <div className="mt-1.5 flex items-center gap-2 text-xs text-ink-500">
                  <span className={clsx("flex items-center gap-1.5 rounded-full bg-ink-800 px-2 py-0.5", st.className)}>
                    <span className={clsx("size-1.5 rounded-full bg-current", p.status === "running" && "animate-pulse")} />
                    {st.label}
                  </span>
                  <span className="truncate">
                    {p.screenCount} screens · {timeAgo(p.createdAt)}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      {projects && !projects.length && <p className="mt-4 text-sm text-ink-500">Your apps will show up here once you build one.</p>}
    </section>
  );
}

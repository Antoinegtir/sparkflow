"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectSummary } from "@/lib/shared";
import { timeAgo } from "@/lib/web/media";
import { ImportNative } from "./ImportNative";
import { InstallIcon } from "./InstallIcon";
import { ProjectCardMenu } from "./ProjectCardMenu";
import { deviceById, DeviceMockup } from "./ide/ui";
import { SkinFrame } from "./ide/SkinFrame";
import { useDeviceSkin, type DeviceSkin } from "@/lib/web/device-skin";
import { useSimDevice } from "@/lib/web/sim-device";
import { useIsPhone } from "@/lib/web/phone";
import { DesktopNote } from "./DesktopNote";
import { requireSignIn, watchUser } from "@/lib/web/auth";
import { apiFetch, appHref, BACKEND_EVENT, backendUrl, getBackend, isCloud, openOnBackend, setBackend, setMode, STATIC_SITE } from "@/lib/web/backend";
import { ensureCloud } from "@/lib/web/cloud";
import { loadSavedApps, saveApps, type SavedApp } from "@/lib/web/cloud-apps";

const COVER_W = 132;

/** The demo app every user gets: its own capture stands in until theirs is taken. */
const isDemo = (p: { slug?: string; prompt?: string }) => p.slug === "wander" || !!p.prompt?.endsWith("(Sparkflow demo app)");

/**
 * A card's phone: the project's device peeking out of the card, always with an app on its screen.
 * Before the first capture (still building), a skeleton of an app screen that shimmers.
 */
function Cover({ src, device, native, building, faded, skin }: { src?: string; device?: string; native?: boolean; building?: boolean; faded?: boolean; skin?: DeviceSkin | null }) {
  const d = deviceById(device);
  // An app shown in the Android emulator: that emulator's own frame.
  if (skin && device === "simulator")
    return (
      <div className={clsx("relative translate-y-10 transition group-hover:translate-y-7 max-sm:translate-y-0 max-sm:group-hover:translate-y-0 max-sm:[zoom:.6]", faded && "opacity-80 group-hover:opacity-100")}>
        <SkinFrame skin={skin} style={{ width: COVER_W, height: Math.round((COVER_W * skin.height) / skin.width) }}>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
          ) : (
            <SkeletonScreen building={building} />
          )}
        </SkinFrame>
      </div>
    );
  return (
    <div className={clsx("relative translate-y-10 transition group-hover:translate-y-7 max-sm:translate-y-0 max-sm:group-hover:translate-y-0 max-sm:[zoom:.6]", faded && "opacity-80 group-hover:opacity-100")}>
      <DeviceMockup device={d} width={d.ipad ? COVER_W * 1.5 : COVER_W} dark={false} bare={native && !!src}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
        ) : (
          <SkeletonScreen building={building} />
        )}
      </DeviceMockup>
    </div>
  );
}

/** A light app screen drawn in blocks: a large title, a search field, cards, a tab bar. */
function SkeletonScreen({ building }: { building?: boolean }) {
  const block = clsx("rounded-[10px] bg-[#e9edf3]", building && "animate-pulse");
  return (
    <div className="absolute inset-0 flex flex-col gap-3 bg-white px-4 pb-0 pt-5">
      <div className={clsx(block, "h-7 w-2/5 rounded-[8px]")} />
      <div className={clsx(block, "h-9 w-full")} />
      <div className={clsx(block, "h-40 w-full rounded-[18px]")} />
      <div className="grid grid-cols-2 gap-3">
        <div className={clsx(block, "h-28 rounded-[16px]")} />
        <div className={clsx(block, "h-28 rounded-[16px]")} />
      </div>
      <div className={clsx(block, "h-16 w-full rounded-[14px]")} />
      <div className="mt-auto flex justify-around border-t border-[#eef1f5] pb-7 pt-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={clsx("size-6 rounded-full", i === 0 ? "bg-spark-500/70" : "bg-[#e3e7ee]")} />
        ))}
      </div>
    </div>
  );
}

const STATUS: Record<string, { label: string; className: string }> = {
  running: { label: "building", className: "text-spark-400" },
  done: { label: "ready", className: "text-emerald-400" },
  failed: { label: "failed", className: "text-red-400" },
  stopped: { label: "stopped", className: "text-amber-400" },
  idle: { label: "idle", className: "text-ink-500" },
};

/** At most one save of the apps to the account per this many ms (loads repeat every 5 s while building). */
const SAVE_EVERY = 15000;

/**
 * "Your apps": the projects on this machine. Polls only while one is building and the tab is visible.
 * Signed in, they are also saved to the account, and listed from there while `sparkflow` isn't running.
 */
export function ProjectGrid() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [saved, setSaved] = useState<SavedApp[] | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const draft = useRef("");
  const [installs, setInstalls] = useState(0);
  const lastSave = useRef(0);
  // The Android emulator in use (or last used, while sparkflow is off) frames the apps shown in it.
  const skin = useDeviceSkin(useSimDevice().device, true);
  const router = useRouter();
  // Apps open on a computer: on a phone the cards show but don't open, the note says where to go.
  const phone = useIsPhone();
  // Everyone sees the demo app, even signed out and without sparkflow: it invites them in. Hidden
  // once their own Wander (seeded by sparkflow) is listed.
  const hasDemo = [...(projects ?? []), ...(saved ?? [])].some((p) => p.slug === "wander");

  useEffect(() => watchUser((u) => setUid(u?.uid ?? null)), []);

  const load = useCallback(async () => {
    // Signed in, nothing linked: the cloud (the default), quietly.
    if (STATIC_SITE && uid && !getBackend()) await ensureCloud();
    const res = await apiFetch("/api/projects", { cache: "no-store" }).catch(() => null);
    if (res?.ok) {
      const list: ProjectSummary[] = await res.json();
      setProjects(list);
      setSaved(null);
      // The account mirrors your Mac's apps; the cloud's are kept there already (and are other ones).
      if (uid && !isCloud() && Date.now() - lastSave.current > SAVE_EVERY) {
        lastSave.current = Date.now();
        void saveApps(uid, list).catch(() => {});
      }
      return;
    }
    // The computer isn't reachable: the apps saved to the account, if signed in.
    setProjects(null);
    if (uid) setSaved(await loadSavedApps(uid).catch(() => null));
  }, [uid]);

  useEffect(() => {
    void load();
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    // Connecting (or disconnecting) the computer changes which apps there are.
    addEventListener(BACKEND_EVENT, load);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      removeEventListener(BACKEND_EVENT, load);
    };
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
    await apiFetch(`/api/projects/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
  }

  return (
    <section className="relative mx-auto max-w-5xl px-6 pb-24">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <h2 className="landing-head text-2xl font-semibold text-ink-100">Your apps</h2>
          <p className="mt-1 text-sm text-ink-500">
            {isCloud() ? (
              <>
                {projects?.length ?? 0} app{projects?.length === 1 ? "" : "s"} in the cloud ·{" "}
                <button
                  onClick={() => {
                    // The Mac chosen: forget the cloud session, the connect page links sparkflow.
                    setMode("mac");
                    setBackend(null);
                    location.href = "/connect";
                  }}
                  className="cursor-pointer text-spark-400 hover:text-spark-300">
                  Use my Mac instead
                </button>
              </>
            ) : saved?.length
              ? `${saved.length} app${saved.length > 1 ? "s" : ""} saved to your account · start sparkflow to open them`
              : projects?.length
                ? `${projects.length} app${projects.length > 1 ? "s" : ""} on this machine`
                : "Built and verified on this machine"}
          </p>
        </div>
        {/* Importing runs on the computer's sparkflow: on a phone it says so in a pop-up. */}
        <ImportNative phone={phone} />
      </div>
      {phone && (
        <div className="mb-6">
          <DesktopNote what="open and edit your apps" />
        </div>
      )}
      <div
        data-no-lens
        className="grid grid-cols-3 gap-2 sm:gap-4 lg:grid-cols-4"
        onClickCapture={
          phone
            ? (e) => {
                e.preventDefault();
                e.stopPropagation();
              }
            : undefined
        }>
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
          <span className="relative flex flex-col items-center gap-1 text-sm max-sm:scale-75">
            <InstallIcon replay={installs} label="New app" />
            <span className="text-[11.5px] text-ink-500 max-sm:hidden">Describe, sketch or talk</span>
          </span>
        </button>
        {projects?.map((p) => {
          const st = STATUS[p.status] ?? STATUS.idle;
          return (
            <Link key={p.id} href={appHref(`/${p.slug}`)} className="group relative flex aspect-[4/5] flex-col overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 shadow-[0_20px_50px_-30px_rgba(0,0,0,.8)] transition hover:-translate-y-1 hover:border-ink-600 hover:shadow-[0_30px_60px_-30px_var(--landing-glow)]">
              <ProjectCardMenu
                id={p.id}
                native={p.native}
                onRename={() => {
                  draft.current = p.name;
                  setRenaming(p.id);
                }}
                onDeleted={() => setProjects((ps) => ps?.filter((x) => x.id !== p.id) ?? null)}
              />
              <div className="relative grid flex-1 place-items-center overflow-hidden max-sm:items-start bg-[radial-gradient(circle_at_50%_30%,color-mix(in_oklab,var(--color-spark-500)_22%,transparent),transparent_70%)] pt-4">
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
                <Cover
                  src={p.coverUrl ? backendUrl(p.coverUrl) : isDemo(p) ? "/demo/wander-cover.jpg" : undefined}
                  device={p.previewDevice}
                  native={p.native}
                  building={p.status === "running"}
                  skin={skin}
                />
              </div>
              <div className="relative border-t border-ink-800 bg-ink-900 px-2 py-2 sm:px-3.5 sm:py-3">
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
                  <p className="truncate text-xs font-medium text-ink-100 sm:text-sm">{p.name}</p>
                )}
                <div className="mt-1 flex items-center gap-2 text-[10px] text-ink-500 sm:mt-1.5 sm:text-xs">
                  <span className={clsx("flex items-center gap-1.5 rounded-full bg-ink-800 px-2 py-0.5", st.className)}>
                    <span className={clsx("size-1.5 rounded-full bg-current", p.status === "running" && "animate-pulse")} />
                    {st.label}
                  </span>
                  <span className="truncate max-sm:hidden">
                    {p.screenCount} screens · {timeAgo(p.createdAt)}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
        {saved?.map((p) => (
          // Saved to the account: opening it shows how to start sparkflow, then the app.
          <Link key={p.id} href={appHref(`/${p.slug}`)} className="group relative flex aspect-[4/5] flex-col overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 shadow-[0_20px_50px_-30px_rgba(0,0,0,.8)] transition hover:-translate-y-1 hover:border-ink-600 hover:shadow-[0_30px_60px_-30px_var(--landing-glow)]">
            <div className="relative grid flex-1 place-items-center overflow-hidden max-sm:items-start bg-[radial-gradient(circle_at_50%_30%,color-mix(in_oklab,var(--color-spark-500)_22%,transparent),transparent_70%)] pt-4">
              <Cover src={p.cover ?? (isDemo(p) ? "/demo/wander-cover.jpg" : undefined)} device={p.previewDevice} native={p.native} faded skin={skin} />
            </div>
            <div className="relative border-t border-ink-800 bg-ink-900 px-2 py-2 sm:px-3.5 sm:py-3">
              <p className="truncate text-xs font-medium text-ink-100 sm:text-sm">{p.name}</p>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-ink-500 sm:mt-1.5 sm:text-xs">
                <span className="flex items-center gap-1.5 rounded-full bg-ink-800 px-2 py-0.5 text-ink-400">
                  <span className="size-1.5 rounded-full bg-current" />
                  saved
                </span>
                <span className="truncate max-sm:hidden">
                  {p.screenCount} screens · {timeAgo(p.createdAt)}
                </span>
              </div>
            </div>
          </Link>
        ))}
        {!hasDemo && (
          <button
            type="button"
            onClick={async (e) => {
              // Sign in first (GitHub or Google), then the demo opens: on this computer's sparkflow, or
              // the steps to start it.
              if (!(await requireSignIn("Sign in to open the Wander demo.", e.currentTarget))) return;
              openOnBackend("/wander", router.push);
            }}
            className="group relative flex aspect-[4/5] cursor-pointer flex-col overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 text-left shadow-[0_20px_50px_-30px_rgba(0,0,0,.8)] transition hover:-translate-y-1 hover:border-spark-500/60 hover:shadow-[0_30px_60px_-30px_var(--landing-glow)]">
            <div className="relative grid flex-1 place-items-center overflow-hidden max-sm:items-start bg-[radial-gradient(circle_at_50%_30%,color-mix(in_oklab,var(--color-spark-500)_22%,transparent),transparent_70%)] pt-4">
              <div className="relative translate-y-10 transition group-hover:translate-y-7 max-sm:translate-y-0 max-sm:group-hover:translate-y-0 max-sm:[zoom:.6]">
                <DeviceMockup device={deviceById("iphone")} width={COVER_W} dark={false}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/demo/wander-cover.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
                </DeviceMockup>
              </div>
            </div>
            <div className="relative border-t border-ink-800 bg-ink-900 px-2 py-2 sm:px-3.5 sm:py-3">
              <p className="truncate text-xs font-medium text-ink-100 sm:text-sm">Wander</p>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-ink-500 sm:mt-1.5 sm:text-xs">
                <span className="flex items-center gap-1.5 rounded-full bg-spark-500/15 px-2 py-0.5 text-spark-400">
                  <span className="size-1.5 rounded-full bg-current" />
                  demo
                </span>
                <span className="truncate max-sm:hidden">{uid ? "Open the demo app" : "Sign in to try it"}</span>
              </div>
            </div>
          </button>
        )}
      </div>
      {projects && !projects.length && <p className="mt-4 text-sm text-ink-500">Your apps will show up here once you build one.</p>}
    </section>
  );
}

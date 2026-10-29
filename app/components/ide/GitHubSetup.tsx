"use client";

import clsx from "clsx";
import { ArrowUpRight, Loader2, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAccount } from "@/lib/web/user-prefs";

type Status = { remote: string | null; url: string | null; ghUser: string | null; unpushed: number | null };

export const GitHubMark = ({ className = "size-3.5" }: { className?: string }) => (
  <svg viewBox="0 0 16 16" className={clsx(className, "fill-current")} aria-hidden>
    <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.05-.49.05-.49.8.06 1.23.83 1.23.83.72 1.22 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.66 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0Z" />
  </svg>
);

/** The GitHub button of the Code tab: the GitHub panel in a popover. */
export function GitHubSetup({ projectId, appName }: { projectId: string; appName: string }) {
  const [at, setAt] = useState<{ right: number; top: number } | null>(null);
  const { prefs } = useAccount();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!at) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && !(e.target as Element).closest?.('[aria-label="GitHub"]') && setAt(null);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [at]);
  return (
    <>
      <button
        onClick={(e) => {
          if (at) return setAt(null);
          const r = e.currentTarget.getBoundingClientRect();
          setAt({ right: innerWidth - r.right, top: r.bottom + 6 });
        }}
        title="GitHub"
        aria-label="GitHub"
        className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-md border border-[var(--line)] text-ink-200 hover:bg-ink-800">
        <GitHubMark />
      </button>
      {at &&
        createPortal(
          <div ref={box} data-ide className="fixed z-[90] w-80 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 text-left shadow-2xl" style={at}>
            <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-ink-100">
              <GitHubMark /> GitHub
            </p>
            <GitHubPanel projectId={projectId} appName={appName} defaultPrivate={prefs.repoPrivate} />
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * The project on GitHub: create a repository for it (with the GitHub CLI signed in on this computer)
 * or connect an existing one, then push. Every change Sparkflow makes is already a commit.
 */
export function GitHubPanel({ projectId, appName, defaultPrivate = true }: { projectId: string; appName: string; defaultPrivate?: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [name, setName] = useState(appName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "app");
  const [priv, setPriv] = useState(defaultPrivate);
  useEffect(() => setPriv(defaultPrivate), [defaultPrivate]);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/github`)
      .then((r) => r.json())
      .then((s: Status) => setStatus(s))
      .catch(() => setError("Couldn't reach sparkflow"));
  }, [projectId]);

  async function act(label: string, body: object) {
    setBusy(label);
    setError(null);
    try {
      const r = await fetch(`/api/projects/${projectId}/github`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) return setError(j.error ?? "Failed");
      setStatus(j);
    } catch {
      setError("Couldn't reach sparkflow");
    } finally {
      setBusy(null);
    }
  }

  const input = "w-full rounded-md border border-[var(--line)] bg-ink-950 px-2 py-1.5 text-[12.5px] text-ink-100 outline-none focus:border-spark-500/60";
  const primary = "flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md bg-spark-500 px-3 py-1.5 text-[12.5px] font-medium text-white disabled:opacity-50";
  return (
    <div>
            {!status ? (
              <p className="flex items-center gap-2 py-2 text-[12px] text-ink-500">
                <Loader2 size={12} className="animate-spin" /> Checking…
              </p>
            ) : status.remote ? (
              <div className="space-y-2.5">
                <a href={status.url ?? status.remote} target="_blank" rel="noreferrer" className="flex items-center gap-1 truncate text-[12.5px] text-spark-400 hover:underline">
                  {(status.url ?? status.remote).replace(/^https:\/\/github\.com\//, "")} <ArrowUpRight size={12} />
                </a>
                <p className="text-[11.5px] text-ink-500">
                  {status.unpushed ? `${status.unpushed} change${status.unpushed > 1 ? "s" : ""} not on GitHub yet.` : "Everything is on GitHub."}
                </p>
                <button disabled={!!busy || status.unpushed === 0} onClick={() => void act("push", { action: "push" })} className={primary}>
                  {busy === "push" ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />} Push to GitHub
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[11.5px] leading-snug text-ink-500">Every change Sparkflow makes is a commit: put the project's history on GitHub.</p>
                {status.ghUser ? (
                  <div className="space-y-2">
                    <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="repository-name" />
                    <label className="flex items-center gap-2 text-[12px] text-ink-300">
                      <input type="checkbox" checked={priv} onChange={(e) => setPriv(e.target.checked)} /> Private repository
                    </label>
                    <button disabled={!!busy || !name.trim()} onClick={() => void act("create", { action: "create", name: name.trim(), private: priv })} className={primary}>
                      {busy === "create" && <Loader2 size={13} className="animate-spin" />} Create on GitHub as {status.ghUser}
                    </button>
                  </div>
                ) : (
                  <p className="rounded-md border border-[var(--line)] p-2 text-[11.5px] leading-snug text-ink-400">
                    To create a repository from here, sign in to GitHub on this computer: <span className="font-mono text-ink-200">brew install gh && gh auth login</span>
                  </p>
                )}
                <div className="space-y-2 border-t border-[var(--line)] pt-3">
                  <p className="text-[11.5px] text-ink-400">Or connect an existing repository</p>
                  <input className={input} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com/you/app" />
                  <button
                    disabled={!!busy || !url.trim()}
                    onClick={() => void act("connect", { action: "connect", url: url.trim() })}
                    className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[var(--line)] px-3 py-1.5 text-[12.5px] text-ink-200 hover:bg-ink-800 disabled:opacity-50">
                    {busy === "connect" && <Loader2 size={13} className="animate-spin" />} Connect and push
                  </button>
                </div>
              </div>
            )}
            {error && <p className="mt-2 text-[11.5px] leading-snug text-red-400">{error}</p>}
    </div>
  );
}

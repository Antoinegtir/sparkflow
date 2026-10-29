"use client";

import clsx from "clsx";
import { Check, ChevronDown, KeyRound, Loader2, Rocket, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReleaseJob } from "@/lib/web/release";
import { AndroidLogo, AppleLogo } from "../BrandIcons";

/**
 * Ship: a native Release build of the app (its own name, icon and bundle ID) installed on the Simulator or
 * emulator, or a fastlane upload to TestFlight / Google Play's internal track, with its live log.
 */
export function ReleaseMenu({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [creds, setCreds] = useState(false);
  const [job, setJob] = useState<ReleaseJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const log = useRef<HTMLPreElement>(null);

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/projects/${projectId}/release`, { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    setJob(r?.job ?? null);
  }, [projectId]);
  useEffect(() => void refresh(), [refresh]);
  // While a build runs: its step and log every 2 s.
  useEffect(() => {
    if (job?.state !== "running") return;
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [job?.state, refresh]);
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [job?.log]);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    addEventListener("pointerdown", close);
    return () => removeEventListener("pointerdown", close);
  }, [open]);

  const start = async (action: "build" | "deploy", platform: "ios" | "android") => {
    setError(null);
    const r = await fetch(`/api/projects/${projectId}/release`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, platform }) }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (!r?.ok) return setError(j?.error ?? "Couldn't start");
    setJob(j.job);
  };

  const running = job?.state === "running";
  const item = "flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[12.5px] text-ink-200 hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div ref={root} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-2.5 py-1.5 text-[12.5px] font-medium text-ink-100 hover:bg-ink-800">
        {running ? <Loader2 size={12} className="animate-spin text-spark-400" /> : <Rocket size={12} />} Ship <ChevronDown size={12} className="text-ink-500" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[340px] rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1.5 shadow-2xl">
          <p className="px-2.5 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-500">Build and run natively</p>
          <button disabled={running} onClick={() => void start("build", "ios")} className={item}>
            <AppleLogo className="size-3.5 text-ink-200" /> iOS Simulator <span className="ml-auto text-[11px] text-ink-500">Release</span>
          </button>
          <button disabled={running} onClick={() => void start("build", "android")} className={item}>
            <AndroidLogo className="size-3.5" /> Android emulator <span className="ml-auto text-[11px] text-ink-500">Release</span>
          </button>
          <p className="px-2.5 pb-1 pt-2.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-500">Deploy with fastlane</p>
          <button disabled={running} onClick={() => void start("deploy", "ios")} className={item}>
            <AppleLogo className="size-3.5 text-ink-200" /> App Store <span className="ml-auto text-[11px] text-ink-500">TestFlight</span>
          </button>
          <button disabled={running} onClick={() => void start("deploy", "android")} className={item}>
            <AndroidLogo className="size-3.5" /> Google Play <span className="ml-auto text-[11px] text-ink-500">Internal testing</span>
          </button>
          <button onClick={() => setCreds(true)} className={clsx(item, "mt-1 border-t border-[var(--line)] pt-2 text-ink-400")}>
            <KeyRound size={13} /> Store credentials…
          </button>
          {error && <p className="px-2.5 py-1.5 text-[11.5px] text-red-400">{error}</p>}
          {job && (
            <div className="mt-1.5 border-t border-[var(--line)] px-1 pt-2">
              <div className="flex items-center gap-1.5 px-1.5 text-[12px]">
                {job.state === "running" ? <Loader2 size={12} className="animate-spin text-spark-400" /> : job.state === "done" ? <Check size={12} className="text-emerald-400" /> : <X size={12} className="text-red-400" />}
                <span className={clsx("truncate", job.state === "error" ? "text-red-400" : "text-ink-200")}>
                  {job.platform === "ios" ? "iOS" : "Android"} {job.action === "build" ? "build" : "upload"} · {job.state === "error" ? "failed" : job.step}
                </span>
                <span className="ml-auto shrink-0 font-mono text-[10.5px] text-ink-500">{Math.round(((job.ended ?? Date.now()) - job.started) / 1000)} s</span>
              </div>
              <pre ref={log} className="mt-1.5 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md bg-black/40 p-2 font-mono text-[10px] leading-snug text-ink-400">
                {job.log.trim() || "…"}
              </pre>
            </div>
          )}
        </div>
      )}
      {creds && <CredentialsDialog onClose={() => setCreds(false)} />}
    </div>
  );
}

type Masked = {
  apple: { keyId: string; issuerId: string; keyPath: string; teamId: string };
  google: { jsonKeyPath: string; keystorePath: string; keyAlias: string; storePasswordSet: boolean; keyPasswordSet: boolean };
};

/** Credentials for fastlane, saved on this computer (~/.sparkflow/release.json), never in your account. */
function CredentialsDialog({ onClose }: { onClose: () => void }) {
  const [saved, setSaved] = useState<Masked | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    void fetch("/api/release", { cache: "no-store" })
      .then((r) => r.json())
      .then(setSaved)
      .catch(() => setStatus("Couldn't read the saved settings"));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const f = new FormData(form.current!);
    const v = (k: string) => String(f.get(k) ?? "").trim();
    // Passwords left blank stay as saved.
    const opt = (k: string) => v(k) || undefined;
    const body = {
      apple: { keyId: v("keyId"), issuerId: v("issuerId"), keyPath: v("keyPath"), teamId: v("teamId") },
      google: { jsonKeyPath: v("jsonKeyPath"), keystorePath: v("keystorePath"), keyAlias: v("keyAlias"), storePassword: opt("storePassword"), keyPassword: opt("keyPassword") },
    };
    const r = await fetch("/api/release", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    if (!r?.ok) return setStatus("Couldn't save");
    setSaved(await r.json());
    setStatus("Saved on this computer");
  };

  const input = "w-full rounded-md border border-[var(--line)] bg-[var(--panel-2)] px-2 py-1.5 font-mono text-[11.5px] text-ink-100 outline-none focus:border-spark-500";
  const label = "mb-1 block text-[11.5px] text-ink-400";
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      {saved ? (
        <form ref={form} onSubmit={save} className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-ink-100">Store credentials</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="cursor-pointer text-ink-500 hover:text-ink-100">
              <X size={16} />
            </button>
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-500">Used by fastlane for every app. Saved on this computer only (~/.sparkflow/release.json, readable by you alone), never in your Sparkflow account.</p>

          <h3 className="mt-5 flex items-center gap-2 text-[12.5px] font-semibold text-ink-200">
            <AppleLogo className="size-3.5" /> App Store Connect
          </h3>
          <p className="mt-1 text-[11.5px] text-ink-500">An API key with the App Manager role (App Store Connect › Users and Access › Integrations). The app must already exist in App Store Connect with its bundle ID.</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label>
              <span className={label}>Key ID</span>
              <input name="keyId" defaultValue={saved.apple.keyId} className={input} autoComplete="off" />
            </label>
            <label>
              <span className={label}>Team ID</span>
              <input name="teamId" defaultValue={saved.apple.teamId} className={input} autoComplete="off" />
            </label>
            <label className="col-span-2">
              <span className={label}>Issuer ID</span>
              <input name="issuerId" defaultValue={saved.apple.issuerId} className={input} autoComplete="off" />
            </label>
            <label className="col-span-2">
              <span className={label}>.p8 key file (path on this computer)</span>
              <input name="keyPath" defaultValue={saved.apple.keyPath} placeholder="~/keys/AuthKey_XXXXXXXXXX.p8" className={input} autoComplete="off" />
            </label>
          </div>

          <h3 className="mt-6 flex items-center gap-2 text-[12.5px] font-semibold text-ink-200">
            <AndroidLogo className="size-3.5" /> Google Play
          </h3>
          <p className="mt-1 text-[11.5px] text-ink-500">A service account JSON key with release rights, and your upload keystore. Google Play takes the very first .aab of a new app from the Play Console; fastlane uploads every one after.</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="col-span-2">
              <span className={label}>Service account JSON key (path)</span>
              <input name="jsonKeyPath" defaultValue={saved.google.jsonKeyPath} placeholder="~/keys/play-service-account.json" className={input} autoComplete="off" />
            </label>
            <label className="col-span-2">
              <span className={label}>Upload keystore (path)</span>
              <input name="keystorePath" defaultValue={saved.google.keystorePath} placeholder="~/keys/upload.jks" className={input} autoComplete="off" />
            </label>
            <label>
              <span className={label}>Key alias</span>
              <input name="keyAlias" defaultValue={saved.google.keyAlias} className={input} autoComplete="off" />
            </label>
            <span />
            <label>
              <span className={label}>Keystore password</span>
              <input name="storePassword" type="password" placeholder={saved.google.storePasswordSet ? "saved · leave blank to keep" : ""} className={input} autoComplete="new-password" />
            </label>
            <label>
              <span className={label}>Key password</span>
              <input name="keyPassword" type="password" placeholder={saved.google.keyPasswordSet ? "saved · leave blank to keep" : "same as keystore"} className={input} autoComplete="new-password" />
            </label>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            {status && <span className="mr-auto text-[12px] text-ink-400">{status}</span>}
            <button type="button" onClick={onClose} className="cursor-pointer rounded-lg px-3 py-1.5 text-[12.5px] text-ink-300 hover:bg-ink-800">
              Close
            </button>
            <button type="submit" className="cursor-pointer rounded-lg bg-spark-500 px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-spark-400">
              Save
            </button>
          </div>
        </form>
      ) : (
        <p className="text-[13px] text-ink-300">{status ?? "Loading…"}</p>
      )}
    </div>
  );
}

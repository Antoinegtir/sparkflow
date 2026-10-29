"use client";

import clsx from "clsx";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { backendUrl } from "@/lib/web/backend";

type Settings = {
  name: string;
  version: string;
  bundleIdentifier: string;
  androidPackage: string;
  orientation: "portrait" | "landscape" | "default";
  appearance: "automatic" | "light" | "dark";
  splashBackground: string;
  iconBackground: string;
};

/**
 * The app's own settings (its app.json and images): name, icon, splash screen, bundle ID and package,
 * version, orientation, appearance. Saved as one commit in the project's history.
 */
export function AppSettings({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [s, setS] = useState<Settings | null>(null);
  const [icon, setIcon] = useState<File | null>(null);
  const [splash, setSplash] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped after a save, so the previews load the new images.
  const [version] = useState(() => Date.now());

  useEffect(() => {
    fetch(`/api/projects/${projectId}/settings`)
      .then(async (r) => (r.ok ? setS(await r.json()) : setError((await r.json()).error ?? "Couldn't read the settings")))
      .catch(() => setError("Couldn't reach sparkflow"));
  }, [projectId]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    if (!s) return;
    setSaving(true);
    setError(null);
    const form = new FormData();
    form.set("settings", JSON.stringify(s));
    if (icon) form.set("icon", icon);
    if (splash) form.set("splash", splash);
    try {
      const r = await fetch(`/api/projects/${projectId}/settings`, { method: "POST", body: form });
      if (!r.ok) return setError((await r.json().catch(() => ({}))).error ?? "Couldn't save");
      onClose();
    } catch {
      setError("Couldn't reach sparkflow");
    } finally {
      setSaving(false);
    }
  }

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((o) => (o ? { ...o, [k]: v } : o));
  const raw = (p: string) => backendUrl(`/api/projects/${projectId}/files?path=${encodeURIComponent(p)}&raw&v=${version}`);
  const input = "w-full rounded-lg border border-[var(--line)] bg-ink-950 px-2.5 py-1.5 text-[13px] text-ink-100 outline-none focus:border-spark-500/60";
  const label = "mb-1 block text-[11.5px] font-medium text-ink-400";

  return (
    <div data-ide className="fixed inset-0 z-[95] grid place-items-center bg-black/50 p-4 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3">
          <div>
            <h2 className="text-[15px] font-semibold text-ink-100">App settings</h2>
            <p className="text-[12px] text-ink-500">Saved in app.json and assets/, as one change in the history.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid size-8 cursor-pointer place-items-center rounded-lg text-ink-400 hover:bg-ink-800 hover:text-ink-100">
            <X size={16} />
          </button>
        </div>

        {!s ? (
          <div className="grid place-items-center p-10 text-[13px] text-ink-400">{error ?? <Loader2 size={18} className="animate-spin" />}</div>
        ) : (
          <div className="space-y-5 overflow-auto px-5 py-4">
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <div>
                <span className={label}>App name</span>
                <input className={input} value={s.name} maxLength={60} onChange={(e) => set("name", e.target.value)} />
              </div>
              <div>
                <span className={label}>Version</span>
                <input className={input} value={s.version} onChange={(e) => set("version", e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <ImageField
                title="App icon"
                hint="Square, 1024 px or more"
                src={icon ? URL.createObjectURL(icon) : raw("assets/icon.png")}
                rounded
                onPick={setIcon}
                background={s.iconBackground}
                onBackground={(c) => set("iconBackground", c)}
                backgroundLabel="Android icon background"
              />
              <ImageField
                title="Splash screen"
                hint="Shown while the app starts"
                src={splash ? URL.createObjectURL(splash) : raw("assets/splash-icon.png")}
                onPick={setSplash}
                background={s.splashBackground}
                onBackground={(c) => set("splashBackground", c)}
                backgroundLabel="Background"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className={label}>iOS bundle ID</span>
                <input className={clsx(input, "font-mono")} value={s.bundleIdentifier} onChange={(e) => set("bundleIdentifier", e.target.value)} placeholder="com.company.app" />
              </div>
              <div>
                <span className={label}>Android package</span>
                <input className={clsx(input, "font-mono")} value={s.androidPackage} onChange={(e) => set("androidPackage", e.target.value)} placeholder="com.company.app" />
              </div>
            </div>
            <p className="-mt-3 text-[11.5px] leading-snug text-ink-500">Used when you publish the app. In Sparkflow Dev and Expo Go the app keeps running as it does now.</p>

            <div className="grid grid-cols-2 gap-3">
              <Choice label="Orientation" value={s.orientation} options={[["portrait", "Portrait"], ["landscape", "Landscape"], ["default", "Both"]]} onChange={(v) => set("orientation", v)} />
              <Choice label="Appearance" value={s.appearance} options={[["automatic", "Auto"], ["light", "Light"], ["dark", "Dark"]]} onChange={(v) => set("appearance", v)} />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] px-5 py-3">
          <p className="truncate text-[12px] text-red-400">{s && error}</p>
          <div className="flex shrink-0 gap-2">
            <button onClick={onClose} className="cursor-pointer rounded-lg px-3 py-1.5 text-[12.5px] text-ink-300 hover:bg-ink-800">
              Cancel
            </button>
            <button onClick={() => void save()} disabled={!s || saving} className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-spark-500 px-3 py-1.5 text-[12.5px] font-medium text-white disabled:opacity-50">
              {saving && <Loader2 size={13} className="animate-spin" />} Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ImageField(p: {
  title: string;
  hint: string;
  src: string;
  rounded?: boolean;
  onPick: (f: File) => void;
  background: string;
  onBackground: (c: string) => void;
  backgroundLabel: string;
}) {
  const file = useRef<HTMLInputElement>(null);
  return (
    <div>
      <span className="mb-1 block text-[11.5px] font-medium text-ink-400">{p.title}</span>
      <button
        type="button"
        onClick={() => file.current?.click()}
        title="Choose an image"
        className="group relative grid aspect-square w-full cursor-pointer place-items-center overflow-hidden rounded-xl border border-[var(--line)]"
        style={{ background: p.background }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.src} alt="" className={clsx("max-h-[70%] max-w-[70%] object-contain", p.rounded && "rounded-[22%]")} onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-black/55 py-1.5 text-[11.5px] text-white opacity-0 transition group-hover:opacity-100">
          <ImagePlus size={13} /> Change
        </span>
      </button>
      <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => e.target.files?.[0] && p.onPick(e.target.files[0])} />
      <p className="mt-1 text-[11px] text-ink-500">{p.hint}</p>
      <label className="mt-2 flex items-center gap-2 text-[11.5px] text-ink-400">
        <input type="color" value={p.background} onChange={(e) => p.onBackground(e.target.value)} className="size-6 cursor-pointer rounded border border-[var(--line)] bg-transparent" />
        {p.backgroundLabel}
      </label>
    </div>
  );
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div>
      <span className="mb-1 block text-[11.5px] font-medium text-ink-400">{label}</span>
      <div className="flex rounded-lg border border-[var(--line)] p-0.5">
        {options.map(([v, l]) => (
          <button key={v} type="button" onClick={() => onChange(v)} className={clsx("flex-1 cursor-pointer rounded-md py-1 text-[12px]", value === v ? "bg-ink-800 text-ink-100" : "text-ink-400 hover:text-ink-200")}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

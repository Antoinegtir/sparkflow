"use client";

import clsx from "clsx";
import { Check, ImagePlus, Loader2, LogOut, SlidersHorizontal, Smartphone, User as UserIcon, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { requireSignIn, signOutUser } from "@/lib/web/auth";
import { backendUrl } from "@/lib/web/backend";
import { savePrefs, useAccount, type Prefs } from "@/lib/web/user-prefs";
import { GitHubMark, GitHubPanel } from "./GitHubSetup";

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
type Section = "app" | "github" | "account" | "preferences";

export function AppSettings({ projectId, appName, onClose }: { projectId: string; appName: string; onClose: () => void }) {
  const [section, setSection] = useState<Section>("app");
  const account = useAccount();
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
  // IDs still on Sparkflow's default prefix take the one set in Preferences (com.yourcompany.<app>).
  const prefix = account.prefs.idPrefix;
  useEffect(() => {
    if (!s || !prefix || prefix === "com.sparkflow") return;
    const swap = (id: string) => (id.startsWith("com.sparkflow.") ? `${prefix}.${id.slice("com.sparkflow.".length)}` : id);
    if (swap(s.bundleIdentifier) !== s.bundleIdentifier || swap(s.androidPackage) !== s.androidPackage)
      setS({ ...s, bundleIdentifier: swap(s.bundleIdentifier), androidPackage: swap(s.androidPackage) });
  }, [s, prefix]);
  const raw = (p: string) => backendUrl(`/api/projects/${projectId}/files?path=${encodeURIComponent(p)}&raw&v=${version}`);
  const input = "w-full rounded-lg border border-[var(--line)] bg-ink-950 px-2.5 py-1.5 text-[13px] text-ink-100 outline-none focus:border-spark-500/60";
  const label = "mb-1 block text-[11.5px] font-medium text-ink-400";

  return (
    <div data-ide className="fixed inset-0 z-[95] grid place-items-center bg-black/50 p-4 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex h-[min(760px,92vh)] w-full max-w-4xl overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-2xl">
        {/* Sections: this app, its GitHub repository, the account, preferences kept in the account. */}
        <nav className="flex w-52 shrink-0 flex-col gap-0.5 border-r border-[var(--line)] p-3">
          <p className="px-2 pb-2 text-[15px] font-semibold text-ink-100">Settings</p>
          <p className="px-2 pt-1 pb-1 text-[10.5px] font-semibold uppercase tracking-wide text-ink-500">{appName}</p>
          {navItem("app", <Smartphone size={14} />, "App")}
          {navItem("github", <GitHubMark />, "GitHub")}
          <p className="px-2 pt-3 pb-1 text-[10.5px] font-semibold uppercase tracking-wide text-ink-500">You</p>
          {navItem("account", <UserIcon size={14} />, "Account")}
          {navItem("preferences", <SlidersHorizontal size={14} />, "Preferences")}
        </nav>
        <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3">
          <div>
            <h2 className="text-[15px] font-semibold text-ink-100">{TITLES[section][0]}</h2>
            <p className="text-[12px] text-ink-500">{TITLES[section][1]}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid size-8 cursor-pointer place-items-center rounded-lg text-ink-400 hover:bg-ink-800 hover:text-ink-100">
            <X size={16} />
          </button>
        </div>

        {section === "github" ? (
          <div className="overflow-auto px-5 py-4">
            <div className="max-w-md">
              <GitHubPanel projectId={projectId} appName={appName} defaultPrivate={account.prefs.repoPrivate} />
            </div>
          </div>
        ) : section === "account" ? (
          <AccountSection user={account.user} projectId={projectId} />
        ) : section === "preferences" ? (
          <PreferencesSection user={account.user} prefs={account.prefs} onSaved={account.setPrefs} />
        ) : !s ? (
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
                <StoreCheck id={s.bundleIdentifier} store="ios" />
              </div>
              <div>
                <span className={label}>Android package</span>
                <input className={clsx(input, "font-mono")} value={s.androidPackage} onChange={(e) => set("androidPackage", e.target.value)} placeholder="com.company.app" />
                <StoreCheck id={s.androidPackage} store="android" />
              </div>
            </div>
            <p className="-mt-3 text-[11.5px] leading-snug text-ink-500">Used when you publish the app. In Sparkflow Dev and Expo Go the app keeps running as it does now.</p>

            <div className="grid grid-cols-2 gap-3">
              <Choice label="Orientation" value={s.orientation} options={[["portrait", "Portrait"], ["landscape", "Landscape"], ["default", "Both"]]} onChange={(v) => set("orientation", v)} />
            </div>
          </div>
        )}

        {section === "app" && (
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--line)] px-5 py-3">
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
        )}
        </div>
      </div>
    </div>
  );

  function navItem(id: Section, icon: React.ReactNode, text: string) {
    return (
      <button
        onClick={() => setSection(id)}
        className={clsx("flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px]", section === id ? "bg-ink-800 text-ink-100" : "text-ink-400 hover:bg-ink-800/60 hover:text-ink-200")}>
        <span className="grid size-4 place-items-center">{icon}</span>
        {text}
      </button>
    );
  }
}

const TITLES: Record<Section, [string, string]> = {
  app: ["App", "Saved in app.json and assets/, as one change in the history."],
  github: ["GitHub", "The app's code and history, in a repository of yours."],
  account: ["Account", "Who you are signed in as, here and on this computer."],
  preferences: ["Preferences", "Kept in your account: every computer you use Sparkflow on gets them."],
};

/** The signed-in account (GitHub or Google) and the GitHub CLI on this computer. */
function AccountSection({ user, projectId }: { user: ReturnType<typeof useAccount>["user"]; projectId: string }) {
  const [gh, setGh] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    fetch(`/api/projects/${projectId}/github`)
      .then((r) => r.json())
      .then((j) => setGh(j.ghUser ?? null))
      .catch(() => setGh(null));
  }, [projectId]);
  const provider = user?.providerData[0]?.providerId === "github.com" ? "GitHub" : user?.providerData[0]?.providerId === "google.com" ? "Google" : null;
  return (
    <div className="space-y-6 overflow-auto px-5 py-5">
      {user === undefined ? (
        <Loader2 size={16} className="animate-spin text-ink-500" />
      ) : user ? (
        <div className="flex items-center gap-4">
          {user.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.photoURL} alt="" className="size-16 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <span className="grid size-16 place-items-center rounded-full bg-spark-500 text-[22px] font-semibold text-white">{(user.displayName ?? user.email ?? "?")[0]?.toUpperCase()}</span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold text-ink-100">{user.displayName ?? user.email}</p>
            {user.email && <p className="truncate text-[13px] text-ink-400">{user.email}</p>}
            {provider && (
              <p className="mt-1 flex items-center gap-1.5 text-[12px] text-ink-500">
                {provider === "GitHub" && <GitHubMark className="size-3" />} Signed in with {provider}
              </p>
            )}
          </div>
          <button onClick={() => void signOutUser()} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12.5px] text-ink-300 hover:bg-ink-800">
            <LogOut size={13} /> Sign out
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--line)] p-4">
          <p className="text-[13px] text-ink-200">Not signed in</p>
          <p className="mt-1 text-[12px] text-ink-500">Sign in to keep your apps and preferences in your account.</p>
          <button onClick={(e) => void requireSignIn("Sign in to Sparkflow.", e.currentTarget)} className="mt-3 rounded-lg bg-spark-500 px-3 py-1.5 text-[12.5px] font-medium text-white">
            Sign in
          </button>
        </div>
      )}
      <div className="rounded-xl border border-[var(--line)] p-4">
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink-100">
          <GitHubMark /> GitHub on this computer
        </p>
        <p className="mt-1 text-[12px] text-ink-400">
          {gh === undefined ? "Checking…" : gh ? `The GitHub CLI is signed in as ${gh}: repositories are created in this account.` : "The GitHub CLI isn't signed in. Run gh auth login in a terminal to create repositories from Sparkflow."}
        </p>
      </div>
    </div>
  );
}

/** Preferences kept in Firestore, used by every app: the ID prefix, the developer name, defaults. */
function PreferencesSection({ user, prefs, onSaved }: { user: ReturnType<typeof useAccount>["user"]; prefs: Prefs; onSaved: (p: Prefs) => void }) {
  const [p, setP] = useState(prefs);
  useEffect(() => setP(prefs), [prefs]);
  const [state, setState] = useState<"idle" | "saving" | "saved" | string>("idle");
  const input = "w-full rounded-lg border border-[var(--line)] bg-ink-950 px-2.5 py-1.5 text-[13px] text-ink-100 outline-none focus:border-spark-500/60";
  const label = "mb-1 block text-[11.5px] font-medium text-ink-400";
  const validPrefix = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(p.idPrefix);
  if (user === null)
    return (
      <div className="px-5 py-5 text-[13px] text-ink-400">
        Sign in to keep preferences in your account.
        <button onClick={(e) => void requireSignIn("Sign in to keep your preferences.", e.currentTarget)} className="ml-2 text-spark-400 hover:underline">
          Sign in
        </button>
      </div>
    );
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-5 overflow-auto px-5 py-4">
        <div className="max-w-md space-y-5">
          <div>
            <span className={label}>App ID prefix</span>
            <input className={clsx(input, "font-mono")} value={p.idPrefix} onChange={(e) => setP({ ...p, idPrefix: e.target.value.trim() })} placeholder="com.yourcompany" />
            <p className="mt-1 text-[11.5px] text-ink-500">
              New bundle IDs and packages: <span className="font-mono text-ink-300">{p.idPrefix || "com.yourcompany"}.appname</span>
            </p>
            {!validPrefix && <p className="mt-1 text-[11.5px] text-amber-400">Lowercase, with dots: com.yourcompany</p>}
          </div>
          <div>
            <span className={label}>Developer name</span>
            <input className={input} value={p.developerName} maxLength={80} onChange={(e) => setP({ ...p, developerName: e.target.value })} placeholder="Your name or company" />
            <p className="mt-1 text-[11.5px] text-ink-500">Who publishes your apps on the stores.</p>
          </div>
          <div>
            <span className={label}>New GitHub repositories</span>
            <div className="flex rounded-lg border border-[var(--line)] p-0.5">
              {([true, false] as const).map((v) => (
                <button key={String(v)} onClick={() => setP({ ...p, repoPrivate: v })} className={clsx("flex-1 cursor-pointer rounded-md py-1 text-[12px]", p.repoPrivate === v ? "bg-ink-800 text-ink-100" : "text-ink-400")}>
                  {v ? "Private" : "Public"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--line)] px-5 py-3">
        <p className="truncate text-[12px] text-red-400">{state !== "idle" && state !== "saving" && state !== "saved" ? state : ""}</p>
        <button
          disabled={!user || !validPrefix || state === "saving"}
          onClick={async () => {
            if (!user) return;
            setState("saving");
            try {
              await savePrefs(user.uid, p);
              onSaved(p);
              setState("saved");
            } catch (e) {
              setState((e as Error).message || "Couldn't save");
            }
          }}
          className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-spark-500 px-3 py-1.5 text-[12.5px] font-medium text-white disabled:opacity-50">
          {state === "saving" ? <Loader2 size={13} className="animate-spin" /> : state === "saved" ? <Check size={13} /> : null} {state === "saved" ? "Saved" : "Save"}
        </button>
      </div>
    </div>
  );
}

/**
 * Whether the ID is already used on the App Store (bundle ID) or Google Play (package), looked up
 * on the stores a moment after typing stops.
 */
function StoreCheck({ id, store }: { id: string; store: "ios" | "android" }) {
  const [state, setState] = useState<"checking" | "taken" | "free" | "unknown" | null>(null);
  useEffect(() => {
    if (!/^[A-Za-z][\w-]*(\.[A-Za-z][\w-]*)+$/.test(id)) return setState(null);
    setState("checking");
    let alive = true;
    const t = setTimeout(() => {
      fetch(`/api/bundle-check?id=${encodeURIComponent(id)}`)
        .then((r) => r.json())
        .then((j) => alive && setState(j[store] ?? "unknown"))
        .catch(() => alive && setState("unknown"));
    }, 500);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [id, store]);
  if (!state) return null;
  const where = store === "ios" ? "the App Store" : "Google Play";
  return (
    <p className={clsx("mt-1 flex items-center gap-1 text-[11px]", state === "taken" ? "text-amber-400" : state === "free" ? "text-emerald-400" : "text-ink-500")}>
      {state === "checking" && <Loader2 size={11} className="animate-spin" />}
      {state === "checking" ? `Checking ${where}…` : state === "taken" ? `Already used on ${where}` : state === "free" ? `Not used on ${where}` : `Couldn't check ${where}`}
    </p>
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

"use client";

import type { User } from "firebase/auth";
import { ArrowLeft, Camera, Check, Loader2, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SignIn } from "@/app/components/SignIn";
import { requireSignIn, watchUser } from "@/lib/web/auth";
import { providerPhoto, saveProfile } from "@/lib/web/profile";

/**
 * Account settings: the name and picture shown to the people a project is shared with (on comments,
 * the Share list, invites). Saved on the Firebase account; servers pick them up from the next proof.
 */
export default function AccountSettings() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [reset, setReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The user object is changed in place by a save: this redraws with it.
  const [, redraw] = useState(0);
  const file = useRef<HTMLInputElement>(null);

  useEffect(
    () =>
      watchUser((u) => {
        setUser(u);
        setName(u?.displayName ?? "");
        if (!u) void requireSignIn("Sign in to edit your profile.");
      }),
    [],
  );
  useEffect(() => {
    if (!photo) return setPreview(null);
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const shown = preview ?? (reset && user ? providerPhoto(user) : user?.photoURL) ?? null;
  const original = user ? providerPhoto(user) : null;
  const dirty = !!user && (name.trim() !== (user.displayName ?? "") || !!photo || (reset && user.photoURL !== original));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await saveProfile({ name, photo, providerPhoto: reset && !photo });
      redraw((n) => n + 1);
      setPhoto(null);
      setReset(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh bg-ink-950 text-ink-100">
      <header className="flex h-12 items-center justify-between border-b border-[var(--line)] bg-[var(--panel)] px-3">
        <button type="button" onClick={() => (history.length > 1 ? history.back() : (location.href = "/"))} className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] text-ink-300 hover:bg-ink-800 hover:text-ink-100">
          <ArrowLeft size={15} /> Back
        </button>
        <SignIn />
      </header>
      <div className="mx-auto max-w-xl px-6 py-12">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <nav className="mt-6 flex gap-1 border-b border-[var(--line)] text-[13px]">
          <span className="-mb-px border-b-2 border-spark-500 px-3 pb-2 text-ink-100">Account</span>
        </nav>
        {user === undefined ? (
          <Loader2 size={18} className="mt-10 animate-spin text-ink-500" />
        ) : !user ? (
          <p className="mt-10 text-[14px] text-ink-400">Sign in to edit your profile.</p>
        ) : (
          <section className="mt-8 space-y-8">
            <div>
              <h2 className="text-[13px] font-medium text-ink-200">Profile picture</h2>
              <p className="mt-1 text-[12.5px] text-ink-500">Shown on your comments and to the people you share apps with.</p>
              <div className="mt-4 flex items-center gap-4">
                <button type="button" onClick={() => file.current?.click()} className="group relative size-20 cursor-pointer overflow-hidden rounded-full bg-ink-800" aria-label="Change your picture">
                  {shown ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={shown} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="grid size-full place-items-center text-2xl font-semibold">{(name || user.email || "?")[0]?.toUpperCase()}</span>
                  )}
                  <span className="absolute inset-0 grid place-items-center bg-black/50 opacity-0 transition group-hover:opacity-100">
                    <Camera size={20} />
                  </span>
                </button>
                <div className="flex flex-col items-start gap-2">
                  <button type="button" onClick={() => file.current?.click()} className="cursor-pointer rounded-lg border border-[var(--line)] px-3 py-1.5 text-[13px] text-ink-100 hover:bg-ink-800">
                    Upload a picture
                  </button>
                  {original && (preview || shown !== original) && (
                    <button
                      type="button"
                      onClick={() => {
                        setPhoto(null);
                        setReset(true);
                      }}
                      className="flex cursor-pointer items-center gap-1.5 text-[12.5px] text-ink-400 hover:text-ink-100">
                      <RotateCcw size={13} /> Use my {user.providerData.some((d) => d.providerId === "github.com") ? "GitHub" : "Google"} picture
                    </button>
                  )}
                </div>
                <input
                  ref={file}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    if (f.size > 15 * 1024 * 1024) return setError("This picture is too large (15 MB at most).");
                    setError(null);
                    setReset(false);
                    setPhoto(f);
                  }}
                />
              </div>
            </div>
            <label className="block">
              <span className="text-[13px] font-medium text-ink-200">Name</span>
              <input
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && dirty && !busy && void save()}
                placeholder={user.email?.split("@")[0] ?? "Your name"}
                className="mt-2 w-full rounded-lg border border-[var(--line)] bg-ink-900 px-3 py-2 text-[14px] text-ink-100 outline-none focus:border-spark-500"
              />
            </label>
            <div className="flex items-center gap-3">
              <button type="button" disabled={!dirty || busy} onClick={() => void save()} className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-spark-500 px-4 py-2 text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40">
                {busy && <Loader2 size={14} className="animate-spin" />} Save
              </button>
              {saved && (
                <span className="flex items-center gap-1 text-[12.5px] text-emerald-400">
                  <Check size={14} /> Saved
                </span>
              )}
              {error && <span className="text-[12.5px] text-red-400">{error}</span>}
            </div>
            <p className="text-[12px] text-ink-500">Signed in as {user.email}. Your projects show the new profile the next time you open them.</p>
          </section>
        )}
      </div>
    </main>
  );
}

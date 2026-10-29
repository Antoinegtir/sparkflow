"use client";

import { Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, openOnBackend } from "@/lib/web/backend";
import { DesktopNote } from "./DesktopNote";

/**
 * Beside "Your apps": start from an existing project. A click opens the computer's own folder picker
 * (through sparkflow, which knows the full path; a browser's picker never gives it) and imports the folder
 * chosen. Without a picker on that computer, a field for the path instead. On a phone, a pop-up: importing
 * runs on the computer where sparkflow is.
 */
export function ImportNative({ phone }: { phone?: boolean }) {
  const router = useRouter();
  const [popup, setPopup] = useState(false);
  const [manual, setManual] = useState(false);
  const [dir, setDir] = useState("~/Documents/");
  const [busy, setBusy] = useState<"picking" | "importing" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(path: string) {
    setBusy("importing");
    setError(null);
    try {
      const res = await apiFetch("/api/projects/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dir: path }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Import failed");
      openOnBackend(`/p/${json.id}`, router.push); // redirects to the app's URL name
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  async function pick() {
    if (phone) return setPopup(true);
    setBusy("picking");
    setError(null);
    try {
      const res = await apiFetch("/api/pick-folder", { method: "POST" });
      const json = (await res.json()) as { picker?: boolean; path?: string | null; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Couldn't open the folder picker");
      if (!json.picker) {
        setManual(true);
        return setBusy(null);
      }
      if (!json.path) return setBusy(null);
      await submit(json.path);
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  if (manual) {
    return (
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 rounded-xl border border-ink-700 bg-ink-900/80 p-1.5 pl-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/folder.png" alt="" width={18} height={18} draggable={false} className="size-[18px] shrink-0" />
          <input
            autoFocus
            value={dir}
            onChange={(e) => setDir(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit(dir);
              if (e.key === "Escape") setManual(false);
            }}
            placeholder="~/Documents/my-app"
            aria-label="Path of the Expo project"
            className="min-w-0 flex-1 bg-transparent font-mono text-[13px] text-ink-100 outline-none"
          />
          <button onClick={() => void submit(dir)} disabled={!!busy} className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-spark-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">
            {busy && <Loader2 size={12} className="animate-spin" />} Import
          </button>
        </div>
        {error && <p className="mt-2 text-right text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-col items-end">
      <button onClick={() => void pick()} disabled={!!busy} className="flex cursor-pointer items-center gap-2 text-sm text-ink-400 transition hover:text-ink-200 disabled:cursor-default">
        {busy ? (
          <Loader2 size={16} className="animate-spin text-spark-400" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/folder.png" alt="" width={18} height={18} draggable={false} className="size-[18px]" />
        )}
        {busy === "picking" ? "Choose the folder on your computer…" : busy === "importing" ? "Importing…" : "Import from a React Native project"}
      </button>
      {error && <p className="mt-1.5 text-right text-xs text-red-400">{error}</p>}
      {popup && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={(e) => e.target === e.currentTarget && setPopup(false)}>
          <div className="relative w-full max-w-md rounded-2xl bg-ink-950 shadow-2xl">
            <button onClick={() => setPopup(false)} aria-label="Close" className="absolute right-3 top-3 z-10 grid size-7 cursor-pointer place-items-center rounded-full text-ink-400 hover:bg-ink-800 hover:text-ink-100">
              <X size={15} />
            </button>
            <DesktopNote what="import a React Native project" />
          </div>
        </div>
      )}
    </div>
  );
}

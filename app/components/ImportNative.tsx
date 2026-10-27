"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, openOnBackend } from "@/lib/web/backend";

/** Lien discret sous la zone de saisie pour partir d'un projet existant. Un clic ouvre un champ de chemin. */
export function ImportNative() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dir, setDir] = useState("~/Documents/");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/projects/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dir }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Import failed");
      openOnBackend(`/p/${json.id}`, router.push); // redirects to the app's URL name
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mx-auto mt-4 flex cursor-pointer items-center gap-2 text-sm text-ink-400 transition hover:text-ink-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/folder.png" alt="" width={18} height={18} draggable={false} className="size-[18px]" />
        Import from a React Native project
      </button>
    );
  }
  return (
    <div className="mx-auto mt-4 w-full max-w-md">
      <div className="flex items-center gap-2 rounded-xl border border-ink-700 bg-ink-900/80 p-1.5 pl-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/folder.png" alt="" width={18} height={18} draggable={false} className="size-[18px] shrink-0" />
        <input
          autoFocus
          value={dir}
          onChange={(e) => setDir(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="~/Documents/my-app"
          aria-label="Path of the Expo project"
          className="min-w-0 flex-1 bg-transparent font-mono text-[13px] text-ink-100 outline-none"
        />
        <button onClick={() => void submit()} disabled={busy} className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-spark-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">
          {busy && <Loader2 size={12} className="animate-spin" />} Import
        </button>
      </div>
      {error && <p className="mt-2 text-center text-xs text-red-400">{error}</p>}
    </div>
  );
}

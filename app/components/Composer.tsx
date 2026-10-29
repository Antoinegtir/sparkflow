"use client";

import clsx from "clsx";
import { ArrowUp, ArrowUpRight, ImagePlus, Loader2, Mic, Square, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { MediaInput } from "@/lib/shared";
import { blobToWav, imageToInput, startRecording } from "@/lib/web/media";
import { requireSignIn } from "@/lib/web/auth";
import { apiFetch, getBackend, openOnBackend, STATIC_SITE } from "@/lib/web/backend";
import { useIsPhone } from "@/lib/web/phone";
import { patchPresence } from "@/lib/web/presence";
import { DesktopNote } from "./DesktopNote";

const PENDING = "sparkflow.pendingPrompt";

const EXAMPLES = [
  "A habit tracker: today's habits with checkboxes and streaks, a weekly stats chart, a habit detail page and reminders.",
  "A recipe app: browse recipes as photo cards, filter by category, a recipe detail page with ingredients and steps.",
  "A personal budget app: monthly balance, spending by category with a chart, a transaction list and add form.",
];

/** Zone de saisie de la landing : texte, croquis ou mémo vocal, plus des exemples cliquables. */
export function Composer() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [image, setImage] = useState<{ input: MediaInput; url: string } | null>(null);
  const [audio, setAudio] = useState<{ input: MediaInput; seconds: number } | null>(null);
  const [recording, setRecording] = useState<{ stop: () => Promise<Blob>; started: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  // On a phone nothing gets built (it needs a computer): the prompt stays to try, the note says where.
  const phone = useIsPhone();
  const ready = !phone && (value.trim().length > 0 || !!image || !!audio) && !busy && !recording;

  // A prompt kept while the hosted site walked you through connecting your computer.
  useEffect(() => {
    try {
      const kept = sessionStorage.getItem(PENDING);
      if (kept) {
        sessionStorage.removeItem(PENDING);
        setValue(kept);
      }
    } catch {}
  }, []);

  // The terminal shows what the prompt box is doing.
  useEffect(() => {
    const draft = value.trim();
    patchPresence({
      composer: recording ? "recording" : image ? "sketch" : draft ? "writing" : undefined,
      draft: draft ? draft.replace(/\s+/g, " ").slice(0, 80) : undefined,
    });
  }, [value, image, recording]);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - recording.started) / 1000)), 250);
    return () => clearInterval(t);
  }, [recording]);

  async function attach(f: File | Blob | null | undefined) {
    if (!f || !f.type.startsWith("image/")) return;
    setError(null);
    try {
      setImage({ input: await imageToInput(f), url: URL.createObjectURL(f) });
    } catch {
      setError("That image could not be read.");
    }
  }

  async function toggleVoice() {
    setError(null);
    if (recording) {
      const blob = await recording.stop();
      setRecording(null);
      try {
        setAudio({ input: await blobToWav(blob), seconds: Math.max(1, elapsed) });
      } catch {
        setError("The recording could not be encoded.");
      }
      return;
    }
    try {
      const rec = await startRecording();
      setElapsed(0);
      setRecording({ stop: rec.stop, started: Date.now() });
    } catch {
      setError("Microphone access was denied.");
    }
  }

  const buildButton = useRef<HTMLButtonElement>(null);

  async function submit() {
    if (!ready) return;
    // The hosted site builds on your computer for signed-in people only.
    if (STATIC_SITE && !(await requireSignIn("Sign in to build your app.", buildButton.current))) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: value, ...(image ? { image: image.input } : {}), ...(audio ? { audio: audio.input } : {}) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not start the build.");
      openOnBackend(`/p/${json.id}`, router.push); // redirects to the app's URL name
    } catch (err) {
      // Hosted site with no computer answering (never connected, or `sparkflow` stopped): keep the
      // prompt and show how to start it.
      if (STATIC_SITE && (err instanceof TypeError || !getBackend())) {
        try {
          sessionStorage.setItem(PENDING, value);
        } catch {}
        location.href = "/connect";
        return;
      }
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="text-left">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void attach(e.dataTransfer.files[0]);
        }}
        className={clsx(
          "rounded-3xl border bg-ink-900/80 p-4 pl-5 shadow-[0_30px_80px_-24px_var(--landing-glow)] backdrop-blur focus-within:border-[#3a4352]",
          dragging ? "border-spark-500" : "border-[#2a3240]",
        )}>
        <textarea
          id="composer"
          ref={input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void submit();
            }
          }}
          onPaste={(e) => {
            const img = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
            if (img) {
              e.preventDefault();
              void attach(img);
            }
          }}
          rows={3}
          placeholder="Describe the mobile app you want, drop a sketch or record a voice memo..."
          className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-ink-100 outline-none placeholder:text-ink-500"
        />
        {(image || audio) && (
          <div className="mb-1 flex flex-wrap gap-2">
            {image && (
              <span className="relative flex items-center gap-2 rounded-xl border border-ink-700 bg-ink-800/80 py-1 pl-1 pr-2 text-xs text-ink-300">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt="" className="h-9 w-9 rounded-lg object-cover" />
                sketch
                <button onClick={() => setImage(null)} aria-label="Remove the sketch" className="cursor-pointer text-ink-500 hover:text-ink-100">
                  <X size={13} />
                </button>
              </span>
            )}
            {audio && (
              <span className="flex items-center gap-2 rounded-xl border border-ink-700 bg-ink-800/80 px-2 py-1 text-xs text-ink-300">
                <Mic size={13} className="text-spark-400" /> Voice memo · {audio.seconds}s
                <button onClick={() => setAudio(null)} aria-label="Remove the voice memo" className="cursor-pointer text-ink-500 hover:text-ink-100">
                  <X size={13} />
                </button>
              </span>
            )}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex gap-4 text-sm text-ink-300">
            <input ref={file} type="file" accept="image/*" hidden onChange={(e) => void attach(e.target.files?.[0])} />
            <button onClick={() => file.current?.click()} className="flex cursor-pointer items-center gap-1.5 hover:text-ink-100">
              <ImagePlus size={17} /> Sketch
            </button>
            <button onClick={() => void toggleVoice()} className={clsx("flex cursor-pointer items-center gap-1.5 hover:text-ink-100", recording && "text-red-400")}>
              {recording ? <Square size={14} className="fill-current" /> : <Mic size={17} />} {recording ? `Stop · ${elapsed}s` : "Voice"}
            </button>
          </div>
          <button
            ref={buildButton}
            disabled={!ready}
            onClick={() => void submit()}
            className={clsx(
              "flex items-center gap-2 rounded-full py-1.5 pl-4 pr-1.5 text-sm transition",
              ready ? "cursor-pointer bg-spark-500 text-white" : "bg-ink-800 text-ink-500",
            )}>
            Build app
            <span className={clsx("grid size-6 place-items-center rounded-full", ready ? "bg-white/20" : "bg-ink-700")}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <ArrowUp size={14} />}
            </span>
          </button>
        </div>
      </div>
      {error && <p className="mt-3 text-center text-sm text-red-400">{error}</p>}
      {phone && (
        <div className="mt-5">
          <DesktopNote what="build your app" />
        </div>
      )}

      <ul data-no-lens className="mx-auto mt-6 max-w-[80%]">
        {EXAMPLES.map((ex) => (
          <li key={ex}>
            <button
              onClick={() => {
                setValue(ex);
                input.current?.focus();
              }}
              className="group flex w-full cursor-pointer items-center justify-between gap-4 border-b border-ink-800 py-2.5 text-left text-[13.5px] text-ink-400 hover:text-ink-100">
              <span className="truncate">{ex}</span>
              <ArrowUpRight size={14} className="shrink-0 text-ink-500 transition group-hover:text-spark-500" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

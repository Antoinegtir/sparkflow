"use client";

import { ensureCloud } from "@/lib/web/cloud";
import clsx from "clsx";
import { ArrowUp, ArrowUpRight, ImagePlus, Loader2, Mic } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ATTACH_ACCEPT } from "@/lib/web/media";
import { useDictation } from "@/lib/web/useDictation";
import { VoiceWave } from "./VoiceWave";
import { AttachedFiles, dropBorder, useAttachments } from "./ide/ImageAttach";
import { requireSignIn } from "@/lib/web/auth";
import { apiFetch, getBackend, setMode, openOnBackend, STATIC_SITE } from "@/lib/web/backend";
import { useIsPhone } from "@/lib/web/phone";
import { patchPresence } from "@/lib/web/presence";
import { DesktopNote } from "./DesktopNote";
import { askToNotify } from "@/lib/web/notify";

const PENDING = "sparkflow.pendingPrompt";

const EXAMPLES = [
  "A habit tracker: today's habits with checkboxes and streaks, a weekly stats chart, a habit detail page and reminders.",
  "A recipe app: browse recipes as photo cards, filter by category, a recipe detail page with ingredients and steps.",
  "A personal budget app: monthly balance, spending by category with a chart, a transaction list and add form.",
];

/** The landing's prompt box: text, a sketch or a voice memo, plus clickable examples. */
export function Composer() {
  const router = useRouter();
  const [value, setValue] = useState("");
  // Sketches, screenshots, a PDF or Markdown spec: dropped, picked or pasted.
  const files = useAttachments();
  const voice = useDictation(value, setValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  // On a phone nothing gets built (it needs a computer): the prompt stays to try, the note says where.
  const phone = useIsPhone();
  const ready = !phone && (value.trim().length > 0 || files.files.length > 0) && !busy && !voice.active;

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
      composer: voice.active ? "recording" : files.files.length ? "sketch" : draft ? "writing" : undefined,
      draft: draft ? draft.replace(/\s+/g, " ").slice(0, 80) : undefined,
    });
  }, [value, files.files.length, voice.active]);

  const toggleVoice = () => (voice.active ? voice.done() : voice.start());

  const buildButton = useRef<HTMLButtonElement>(null);

  async function submit() {
    if (!ready) return;
    // The hosted site builds on your computer for signed-in people only.
    if (STATIC_SITE && !(await requireSignIn("Sign in to build your app.", buildButton.current))) return;
    // Asked now, from the click: a build takes minutes, and it says when it's done.
    askToNotify();
    setBusy(true);
    setError(null);
    try {
      // Built in the cloud unless the Mac was chosen: connected now if it isn't yet.
      if (STATIC_SITE && !getBackend()) {
        setMode("cloud"); // a Mac chosen but not running: the cloud
        await ensureCloud(true, buildButton.current);
      }
      const res = await apiFetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: value, ...(files.files.length ? { attachments: files.inputs() } : {}) }),
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
        {...files.zone}
        className={clsx(
          "rounded-3xl border bg-ink-900/80 p-4 pl-5 shadow-[0_30px_80px_-24px_var(--landing-glow)] backdrop-blur focus-within:border-[#3a4352]",
          dropBorder(files.dragging, "border-[#2a3240]"),
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
          onPaste={files.paste}
          rows={3}
          placeholder="Describe the mobile app you want, drop a sketch or dictate it with your voice..."
          className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-ink-100 outline-none placeholder:text-ink-500"
        />
        <div className="mb-1 flex flex-col gap-1.5 empty:hidden">
          <AttachedFiles a={files} hint={false} />
        </div>
        {voice.active && (
          <div className="mt-2">
            <VoiceWave levels={voice.levels} seconds={voice.seconds} onCancel={() => void voice.cancel()} onDone={() => void voice.done()} />
          </div>
        )}
        <div className={clsx("mt-2 flex items-center justify-between", voice.active && "hidden")}>
          <div className="flex gap-4 text-sm text-ink-300">
            <input
              ref={file}
              type="file"
              accept={ATTACH_ACCEPT}
              multiple
              hidden
              onChange={(e) => {
                void files.add(e.target.files);
                e.target.value = "";
              }}
            />
            <button onClick={() => file.current?.click()} className="flex cursor-pointer items-center gap-1.5 hover:text-ink-100">
              <ImagePlus size={17} /> Sketch
            </button>
            <button onClick={() => void toggleVoice()} className="flex cursor-pointer items-center gap-1.5 hover:text-ink-100">
              <Mic size={17} /> Voice
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
      {(error ?? voice.error) && <p className="mt-3 text-center text-sm text-red-400">{error ?? voice.error}</p>}
      {phone && (
        <div className="mt-5">
          <DesktopNote what="build your app" />
        </div>
      )}

      <ul data-no-lens data-suggestions className="mx-auto mt-6 max-w-[80%]">
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

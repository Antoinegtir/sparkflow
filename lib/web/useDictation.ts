"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MediaInput } from "../shared";
import { apiFetch } from "./backend";
import { startDictation } from "./media";

/** Dictation into a text field: `text` is the current value, `setText` receives base + live transcript. */
export function useDictation(text: string, setText: (t: string) => void) {
  const [active, setActive] = useState(false);
  const [levels, setLevels] = useState<number[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const session = useRef<Awaited<ReturnType<typeof startDictation>> | null>(null);
  const base = useRef("");
  const setRef = useRef(setText);
  setRef.current = setText;

  useEffect(() => {
    if (!active) return;
    const started = Date.now();
    const t = setInterval(() => setSeconds(Math.round((Date.now() - started) / 1000)), 250);
    return () => clearInterval(t);
  }, [active]);

  useEffect(() => () => void session.current?.cancel(), []);

  const start = useCallback(async () => {
    setError(null);
    base.current = text.replace(/\s+$/, "");
    try {
      session.current = await startDictation({
        transcribe: async (audio: MediaInput) => {
          const res = await apiFetch("/api/transcribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ audio }) });
          if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Transcription failed");
          return ((await res.json()) as { text: string }).text;
        },
        onText: (t) => t && setRef.current(base.current ? `${base.current} ${t}` : t),
        onLevels: setLevels,
        onError: setError,
      });
      setSeconds(0);
      setActive(true);
    } catch {
      setError("Microphone access was denied.");
    }
  }, [text]);

  const done = useCallback(async () => {
    const s = session.current;
    session.current = null;
    setActive(false);
    await s?.stop();
  }, []);

  const cancel = useCallback(async () => {
    const s = session.current;
    session.current = null;
    setActive(false);
    setRef.current(base.current);
    await s?.cancel();
  }, []);

  return { active, levels, seconds, error, start, done, cancel };
}

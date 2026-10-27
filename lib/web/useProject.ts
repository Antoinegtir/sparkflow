"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { applyEvent, type ProjectState, type PromptRequest, type StoredEvent } from "../shared";
import { getBackend, isDirect } from "./backend";

async function post(url: string, body?: unknown, method = "POST") {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json;
}

/** Project state: initial GET, then the SSE stream folded with the shared reducer. */
export function useProject(id: string) {
  const [state, setState] = useState<ProjectState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [toast, setToastState] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const autoDone = useRef({ capture: false, preview: false });

  const setToast = useCallback((t: string | null) => {
    setToastState(t);
    clearTimeout(toastTimer.current);
    if (t) toastTimer.current = setTimeout(() => setToastState(null), 4000);
  }, []);

  useEffect(() => {
    let es: EventSource | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/projects/${id}`, { cache: "no-store" });
      const json = await res.json();
      if (cancelled) return;
      if (!res.ok) return setError(json.error ?? "Project not found");
      setState(json);
      // Through the tunnel (hosted site) a streamed body doesn't get through: poll every second.
      // Straight to this computer's `sparkflow`, the live stream works.
      if (getBackend() && !isDirect()) {
        let since: number = json.lastSeq;
        const poll = async () => {
          if (cancelled) return;
          try {
            const r = await fetch(`/api/projects/${id}/events?poll=1&since=${since}`, { cache: "no-store" });
            if (!r.ok) throw new Error();
            const events = (await r.json()) as StoredEvent[];
            setConnected(true);
            if (events.length) {
              since = events[events.length - 1].seq;
              setState((s) => (s ? events.reduce(applyEvent, s) : s));
            }
          } catch {
            setConnected(false);
          }
          timer = setTimeout(poll, 1000);
        };
        void poll();
        return;
      }
      es = new EventSource(`/api/projects/${id}/events?since=${json.lastSeq}`);
      es.onopen = () => setConnected(true);
      es.onerror = () => setConnected(false);
      es.addEventListener("agent", (m) => {
        const ev = JSON.parse((m as MessageEvent).data) as StoredEvent;
        setState((s) => (s ? applyEvent(s, ev) : s));
      });
    })().catch((err) => setError(String(err)));
    return () => {
      cancelled = true;
      es?.close();
      clearTimeout(timer);
    };
  }, [id]);

  // Auto-actions: capture a native project that has no pages; restart Metro for a web project reopened after a restart.
  useEffect(() => {
    if (!state) return;
    if (state.native && !state.order.length && !autoDone.current.capture) {
      autoDone.current.capture = true;
      post(`/api/projects/${id}/capture`).catch(() => {});
    }
    if (!state.native && state.plan && state.status !== "running" && !autoDone.current.preview) {
      autoDone.current.preview = true;
      post(`/api/projects/${id}/preview`).catch(() => {});
    }
  }, [state, id]);

  const act = useCallback(
    async (fn: () => Promise<unknown>) => {
      try {
        return await fn();
      } catch (err) {
        setToast((err as Error).message);
        return null;
      }
    },
    [setToast],
  );

  return {
    state,
    error,
    connected,
    toast,
    setToast,
    sendPrompt: (req: PromptRequest) => act(() => post(`/api/projects/${id}/prompt`, req)),
    stop: () => act(() => post(`/api/projects/${id}/stop`)),
    undo: (route: string) => act(() => post(`/api/projects/${id}/undo`, { route })),
    restore: (route: string, version: number) => act(() => post(`/api/projects/${id}/restore`, { route, version })),
    capture: (opts: { dark?: boolean; refresh?: boolean } = {}) =>
      act(() => post(`/api/projects/${id}/capture${opts.dark ? "?scheme=dark" : opts.refresh ? "?refresh=1" : ""}`)),
    captureDark: () => act(() => (state?.native ? post(`/api/projects/${id}/capture?scheme=dark`) : post(`/api/projects/${id}/dark`))),
    captureDevice: (device: string, scheme: "light" | "dark") => act(() => post(`/api/projects/${id}/device-shots`, { device, scheme })),
    captureSimulator: (scheme: "light" | "dark", refresh = false) => act(() => post(`/api/projects/${id}/sim-capture?scheme=${scheme}${refresh ? "&refresh" : ""}`)),
    rename: (name: string) => act(() => post(`/api/projects/${id}`, { name }, "PATCH")),
    setPreviewDevice: (device: string) => act(() => post(`/api/projects/${id}`, { previewDevice: device }, "PATCH")),
  };
}

export type ProjectApi = ReturnType<typeof useProject>;

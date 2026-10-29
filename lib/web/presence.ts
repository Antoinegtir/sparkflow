"use client";

import { useEffect } from "react";
import type { Presence } from "@/lib/shared";
import { apiFetch } from "./backend";

/**
 * Tells this computer's `sparkflow` where the open tab is, so its terminal screen follows along.
 * Sent when it changes (a little delayed, so typing and scrolling don't flood it), again every 10 s
 * while the tab is open, and when the tab is hidden or shown.
 */
let current: Presence | null = null;
let sent = "";
let sentAt = 0;
let pending: ReturnType<typeof setTimeout> | null = null;
let started = false;

function send(force = false) {
  if (!current) return;
  const body = JSON.stringify({ ...current, hidden: document.hidden });
  if (!force && body === sent && Date.now() - sentAt < 10000) return;
  sent = body;
  sentAt = Date.now();
  apiFetch("/api/presence", { method: "POST", headers: { "content-type": "application/json" }, body }).catch(() => {});
}

function schedule() {
  if (!started) {
    started = true;
    setInterval(() => send(), 10000);
    document.addEventListener("visibilitychange", () => send(true));
  }
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => send(), 250);
}

/** Replaces what the tab reports (a new page). */
export function setPresence(p: Presence) {
  current = p;
  schedule();
}

/** Changes part of it (the landing's section, the prompt box). */
export function patchPresence(p: Partial<Presence>) {
  current = { ...(current ?? { view: "home" }), ...p };
  schedule();
}

/** Reports `p` while the component is mounted and whenever it changes. */
export function usePresence(p: Presence | null) {
  const key = JSON.stringify(p);
  useEffect(() => {
    if (p) setPresence(p);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}

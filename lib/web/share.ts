"use client";

import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import type { JoinResult, PreviewResult, SharedEntry } from "@/lib/shared/share";
import { auth, db } from "./auth";

/**
 * Projects someone shared with you live on their computer, at /s/<serverUid>/<projectId>. Each one
 * keeps its own key and tunnel link here, apart from "sparkflow.backend" (your own computer), so a
 * shared page never talks to your server and yours never sends a guest key.
 */
const KEY = "sparkflow.shared";
const SHARE_PATH = /^\/s\/([A-Za-z0-9]{20,40})\/([a-z0-9-]+)/;

export const entryId = (serverUid: string, projectId: string) => `${serverUid}/${projectId}`;

export function loadShared(): Record<string, SharedEntry> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, SharedEntry>) : {};
  } catch {
    return {};
  }
}

/** Saves one entry, or removes it with `null`. */
export function saveShared(id: string, entry: SharedEntry | null) {
  try {
    const all = loadShared();
    if (entry) all[id] = entry;
    else delete all[id];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {}
}

export function updateShared(id: string, patch: Partial<SharedEntry>) {
  const cur = loadShared()[id];
  if (cur) saveShared(id, { ...cur, ...patch });
}

/** The share the current page shows, read from the address each time (the IDE navigates in place). */
export function activeShare(): { serverUid: string; projectId: string } | null {
  if (typeof location === "undefined") return null;
  const m = SHARE_PATH.exec(location.pathname);
  return m ? { serverUid: m[1], projectId: m[2] } : null;
}

export function activeEntry(): SharedEntry | null {
  const a = activeShare();
  return a ? (loadShared()[entryId(a.serverUid, a.projectId)] ?? null) : null;
}

/** Where the shared page's API calls go, with the guest key; null while the owner's computer is unknown or offline. */
export function activeShareBackend(): { url: string; token: string } | null {
  const e = activeEntry();
  const url = e?.devUrl ?? e?.url;
  return e?.key && url ? { url, token: e.key } : null;
}

/** "#<serverUid>.<inviteId>.<secret>[&b=<origin>]": the secret stays in the fragment, never sent to a server by the browser. */
export function parseInvite(hash: string): { serverUid: string; invite: string; b: string | null } | null {
  const [body, ...rest] = hash.replace(/^#/, "").split("&");
  const m = /^([A-Za-z0-9]{20,40})\.(i_[0-9a-f]{16}\.[A-Za-z0-9_-]{16,64})$/.exec(body ?? "");
  if (!m) return null;
  const b = new URLSearchParams(rest.join("&")).get("b");
  return { serverUid: m[1], invite: m[2], b };
}

/** The `&b=` backend of a dev invite, honored only on a page served from this computer (next dev). */
export function devHint(b: string | null): string | null {
  if (!b || typeof location === "undefined") return null;
  if (location.hostname !== "localhost" && location.hostname !== "127.0.0.1") return null;
  try {
    const u = new URL(b);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1" ? u.origin : null;
  } catch {
    return null;
  }
}

/** Follows the owner's server document: its current tunnel link, or null while it is offline. */
export function watchServer(serverUid: string, cb: (url: string | null) => void) {
  return onSnapshot(
    doc(db(), "servers", serverUid),
    (snap) => {
      const url = snap.get("url");
      cb(typeof url === "string" && /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(url) ? url : null);
    },
    () => cb(null),
  );
}

function randomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Proves who you are to the owner's server without handing it your ID token: a one-time document
 * the rules force to match your token's claims, which only that server can read (then deletes).
 */
export async function writeProof(serverUid: string): Promise<string> {
  const user = auth().currentUser;
  if (!user) throw new Error("Sign in first.");
  const write = async (refresh: boolean) => {
    const { claims } = await user.getIdTokenResult(refresh);
    const fb = claims.firebase as { identities?: Record<string, string[]> } | undefined;
    const proofId = randomId();
    await setDoc(doc(db(), "servers", serverUid, "proofs", proofId), {
      uid: user.uid,
      gh: fb?.identities?.["github.com"]?.[0] ?? "",
      email: typeof claims.email === "string" ? claims.email : "",
      at: serverTimestamp(),
    });
    return proofId;
  };
  try {
    return await write(false);
  } catch (err) {
    // A token minted before a provider was linked carries stale claims: refresh it once.
    if ((err as { code?: string }).code !== "permission-denied") throw err;
    return write(true);
  }
}

export class ShareError extends Error {
  constructor(
    readonly status: number,
    readonly body: Record<string, unknown>,
  ) {
    super(typeof body.error === "string" ? body.error : `Request failed (${status})`);
  }
}

/** Absolute URL, so the backend shim leaves these alone: no key exists yet. */
async function call<T>(url: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(url.replace(/\/+$/, "") + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    credentials: "omit",
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ShareError(res.status, json);
  return json as T;
}

export const previewInvite = (url: string, invite: string) => call<PreviewResult>(url, "/api/share/preview", { invite });
export const joinInvite = (url: string, invite: string, proof: string) => call<JoinResult>(url, "/api/share/join", { invite, proof });
export const openSession = (url: string, projectId: string, proof: string) => call<JoinResult>(url, "/api/share/session", { projectId, proof });

/**
 * Images and raw files load by URL, which can't carry the key header: they get a short-lived
 * ticket instead, kept in memory and renewed 10 minutes before it lapses.
 */
let ticket: { projectId: string; value: string; exp: number } | null = null;
let pendingTicket: Promise<string | null> | null = null;

export function getTicket(projectId: string): Promise<string | null> {
  if (ticket?.projectId === projectId && ticket.exp - Date.now() > 10 * 60_000) return Promise.resolve(ticket.value);
  pendingTicket ??= fetch(`/api/projects/${projectId}/ticket`, { method: "POST", cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<{ ticket: string; exp: number }>) : null))
    .then((j) => {
      if (!j?.ticket) return null;
      // Seconds or milliseconds, whichever the server sends.
      ticket = { projectId, value: j.ticket, exp: j.exp < 1e12 ? j.exp * 1000 : j.exp };
      return j.ticket;
    })
    .catch(() => null)
    .finally(() => {
      pendingTicket = null;
    });
  return pendingTicket;
}

/** A shared project's /api URL for the browser to load: the owner's server, with the ticket (never the key). */
export function guestSrc(path: string): string {
  const b = activeShareBackend();
  const a = activeShare();
  if (!b || !a) return "about:blank";
  if (!ticket || ticket.projectId !== a.projectId || ticket.exp - Date.now() < 10 * 60_000) void getTicket(a.projectId);
  const t = ticket?.projectId === a.projectId ? ticket.value : "";
  return `${b.url}${path}${path.includes("?") ? "&" : "?"}t=${encodeURIComponent(t)}`;
}

/** Leaves the shared project: tells the owner's server (best effort), forgets it here, back home. */
export async function leaveShare() {
  const a = activeShare();
  if (!a) return;
  await fetch(`/api/projects/${a.projectId}/access`, { method: "DELETE" }).catch(() => {});
  saveShared(entryId(a.serverUid, a.projectId), null);
  ticket = null;
  location.replace("/");
}

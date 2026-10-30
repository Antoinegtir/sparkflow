import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import type { Role } from "../shared/share";
import { sharingFile } from "./paths";
import { RANK, matchRule, ticketOk } from "./policy";
import { readTicket } from "./tickets";

export type GateResult = { ok: true; uid: string; projectId: string; role: Role } | { ok: false; status: 401 | 403 | 404; code?: string };

const KEY_TTL = 30 * 86_400_000;

type Sharing = {
  projects?: Record<string, { members?: { uid: string; role: Role; revokedAt: number | null }[]; invites?: { revokedAt: number | null; expiresAt: number | null; maxUses: number | null; uses: number }[] }>;
  keys?: Record<string, { projectId: string; uid: string; lastUsedAt: number }>;
};

let cache: { stamp: string; data: Sharing } | undefined;

/** sharing.json, re-read only when it changed: every guest request reads it, so revocation is immediate. */
function sharing(): Sharing {
  const file = sharingFile();
  let stamp: string;
  try {
    const s = statSync(file);
    stamp = `${file}:${s.mtimeMs}:${s.size}`;
  } catch {
    return {};
  }
  if (cache?.stamp === stamp) return cache.data;
  try {
    cache = { stamp, data: JSON.parse(readFileSync(file, "utf8")) };
  } catch {
    // Mid-write or broken: deny everyone rather than guess.
    return {};
  }
  return cache.data;
}

const deny = (status: 401 | 403 | 404, code?: string): GateResult => ({ ok: false, status, ...(code ? { code } : {}) });

/** Who a guest key or ticket belongs to, and whether that member may make this request. Read only. */
export function guestAccess(i: { key?: string; ticket?: string; method: string; pathname: string; search: string }): GateResult {
  const data = sharing();
  let uid: string;
  let projectId: string;
  if (i.key) {
    const entry = data.keys?.[createHash("sha256").update(i.key).digest("hex")];
    if (!entry) return deny(401, "key");
    if (Date.now() - entry.lastUsedAt > KEY_TTL) return deny(401, "expired");
    ({ uid, projectId } = entry);
  } else if (i.ticket) {
    const t = readTicket(i.ticket);
    if (!t) return deny(401, "key");
    if (!ticketOk(i.method, i.pathname, i.search)) return deny(404);
    ({ uid, projectId } = t);
  } else return deny(401, "key");

  const member = data.projects?.[projectId]?.members?.find((m) => m.uid === uid);
  if (!member || member.revokedAt) return deny(401, "revoked");

  const rule = matchRule(i.method, i.pathname, i.search);
  if (!rule) return deny(404);
  // Another project than the key's: as if it didn't exist.
  if (rule.projectId && rule.projectId !== projectId) return deny(404);
  if (RANK[member.role] === undefined || RANK[member.role] < RANK[rule.min]) return deny(403, "role");
  // Guests poll: an open stream would outlive a revocation.
  if (/\/events$/.test(i.pathname) && new URLSearchParams(i.search).get("poll") !== "1") return deny(403);
  return { ok: true, uid, projectId, role: member.role };
}

/**
 * Any project shared right now (a live member, key or open invite). Then guests' code may run on this
 * Mac, so the proxy stops trusting locality alone. A broken or mid-write file counts as shared.
 */
export function sharingActive(): boolean {
  const file = sharingFile();
  try {
    statSync(file);
  } catch {
    return false;
  }
  const d = sharing();
  if (!d.projects && !d.keys) return true;
  const now = Date.now();
  if (Object.keys(d.keys ?? {}).length) return true;
  return Object.values(d.projects ?? {}).some(
    (p) =>
      (p.members ?? []).some((m) => !m.revokedAt) ||
      (p.invites ?? []).some((i) => !i.revokedAt && (i.expiresAt == null || i.expiresAt > now) && (i.maxUses == null || i.uses < i.maxUses)),
  );
}

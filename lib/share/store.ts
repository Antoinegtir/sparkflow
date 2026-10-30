import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { CreateInviteBody, Person, Role, ShareListing } from "../shared/share";
import { avatarFor, currentTunnelUrl, nameFor, readOwner, serverUid, type ProofIdentity } from "./firebase";
import { sharingFile } from "./paths";

/** Invites, members and guest keys of every project, in <stateDir>/sharing.json (0600, atomic writes). */
export type Invite = { id: string; hash: string; role: Role; createdAt: number; expiresAt: number | null; maxUses: number | null; uses: number; revokedAt: number | null };
export type Member = { uid: string; gh: string; email: string; name: string; avatar: string | null; role: Role; joinedAt: number; via: string; revokedAt: number | null };
type KeyEntry = { projectId: string; uid: string; createdAt: number; lastUsedAt: number };
type Sharing = { v: 1; projects: Record<string, { invites: Invite[]; members: Member[] }>; keys: Record<string, KeyEntry> };

const MAX_KEYS = 10;
const HOUR = 3_600_000;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

async function load(): Promise<Sharing> {
  try {
    const d = JSON.parse(await readFile(sharingFile(), "utf8"));
    return { v: 1, projects: d.projects ?? {}, keys: d.keys ?? {} };
  } catch {
    return { v: 1, projects: {}, keys: {} };
  }
}

async function save(d: Sharing) {
  const file = sharingFile();
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(d, null, 2), { mode: 0o600 });
  await chmod(tmp, 0o600);
  await rename(tmp, file);
}

// One writer at a time in this process: every change is read, modify, write.
let chain: Promise<unknown> = Promise.resolve();
function locked<T>(fn: (d: Sharing) => T | Promise<T>, write = true): Promise<T> {
  const run = chain.then(async () => {
    const d = await load();
    const out = await fn(d);
    if (write) await save(d);
    return out;
  });
  chain = run.catch(() => {});
  return run;
}

const project = (d: Sharing, pid: string) => (d.projects[pid] ??= { invites: [], members: [] });

const inviteState = (i: Invite, now = Date.now()) =>
  i.revokedAt ? "revoked" : i.expiresAt !== null && i.expiresAt <= now ? "expired" : i.maxUses !== null && i.uses >= i.maxUses ? "used" : null;

/** "<inviteId>.<secret>" → the invite and its project, checking the secret in constant time. */
function findInvite(d: Sharing, invite: string, pid?: string) {
  const dot = invite.indexOf(".");
  if (dot < 1) return null;
  const id = invite.slice(0, dot);
  const secret = invite.slice(dot + 1);
  for (const [projectId, p] of Object.entries(d.projects)) {
    if (pid && projectId !== pid) continue;
    const inv = p.invites.find((i) => i.id === id);
    if (inv) return same(sha(secret), inv.hash) ? { projectId, inv } : null;
  }
  return null;
}

const person = (m: Member): Person => ({ name: m.name, avatar: m.avatar, ...(m.gh ? { gh: m.gh } : {}), role: m.role, ...(m.revokedAt ? { former: true as const } : {}) });

export const createInvite = (pid: string, body: CreateInviteBody) =>
  locked((d) => {
    const secret = randomBytes(24).toString("base64url");
    const now = Date.now();
    const inv: Invite = {
      id: `i_${randomBytes(8).toString("hex")}`,
      hash: sha(secret),
      role: body.role,
      createdAt: now,
      expiresAt: body.expiresInDays ? now + body.expiresInDays * 86_400_000 : null,
      maxUses: body.maxUses,
      uses: 0,
      revokedAt: null,
    };
    project(d, pid).invites.push(inv);
    return { inviteId: inv.id, secret };
  });

export const listShare = (pid: string) =>
  locked((d): ShareListing => {
    const p = d.projects[pid] ?? { invites: [], members: [] };
    const owner = readOwner();
    return {
      serverUid: serverUid(),
      online: !!currentTunnelUrl(),
      owner: owner ? { name: owner.name, avatar: owner.avatar, ...(owner.gh ? { gh: owner.gh } : {}), role: "owner" } : null,
      invites: p.invites.map(({ hash: _hash, ...i }) => i),
      members: p.members.map((m) => ({ ...person(m), uid: m.uid, email: m.email, joinedAt: m.joinedAt, via: m.via, revokedAt: m.revokedAt })),
    };
  }, false);

export const revokeInvite = (pid: string, id: string) =>
  locked((d) => {
    const inv = d.projects[pid]?.invites.find((i) => i.id === id);
    if (inv && !inv.revokedAt) inv.revokedAt = Date.now();
    return !!inv;
  });

export const previewInvite = (invite: string, pid?: string) =>
  locked((d) => {
    const f = findInvite(d, invite, pid);
    return f && !inviteState(f.inv) ? { projectId: f.projectId, role: f.inv.role } : null;
  }, false);

export type Redeemed = { projectId: string; role: Role } | { owner: true; projectId: string } | { error: "invalid" | "expired" | "revoked" | "used" };

/** Joins with an invite. An active member keeps their role (never raised); a removed one needs an invite made after the removal. */
export const redeemInvite = (invite: string, ident: ProofIdentity) =>
  locked((d): Redeemed => {
    const f = findInvite(d, invite);
    if (!f) return { error: "invalid" };
    const bad = inviteState(f.inv);
    if (bad) return { error: bad };
    if (readOwner()?.uid === ident.uid) return { owner: true, projectId: f.projectId };
    const p = project(d, f.projectId);
    const m = p.members.find((x) => x.uid === ident.uid);
    if (m && !m.revokedAt) return { projectId: f.projectId, role: m.role };
    if (m) {
      if (f.inv.createdAt <= m.revokedAt!) return { error: "revoked" };
      Object.assign(m, { role: f.inv.role, revokedAt: null, joinedAt: Date.now(), via: f.inv.id, gh: ident.gh, email: ident.email, avatar: avatarFor(ident.gh) });
    } else {
      p.members.push({ uid: ident.uid, gh: ident.gh, email: ident.email, name: nameFor(ident), avatar: avatarFor(ident.gh), role: f.inv.role, joinedAt: Date.now(), via: f.inv.id, revokedAt: null });
    }
    f.inv.uses++;
    return { projectId: f.projectId, role: f.inv.role };
  });

/** A new guest key; only its hash is kept. At most 10 per member, the oldest dropped. */
export const issueKey = (pid: string, uid: string) =>
  locked((d) => {
    const key = `sfg_${randomBytes(32).toString("base64url")}`;
    const now = Date.now();
    d.keys[sha(key)] = { projectId: pid, uid, createdAt: now, lastUsedAt: now };
    const mine = Object.entries(d.keys)
      .filter(([, k]) => k.projectId === pid && k.uid === uid)
      .sort((a, b) => b[1].createdAt - a[1].createdAt);
    for (const [h] of mine.slice(MAX_KEYS)) delete d.keys[h];
    return key;
  });

/** Slides the key's 30-day expiry, at most once an hour (the proxy only reads). */
export async function touchKey(hash: string) {
  const k = (await load()).keys[hash];
  if (!k || Date.now() - k.lastUsedAt < HOUR) return;
  await locked((d) => {
    if (d.keys[hash]) d.keys[hash].lastUsedAt = Date.now();
  });
}

export const findMember = (pid: string, uid: string) => locked((d) => d.projects[pid]?.members.find((m) => m.uid === uid) ?? null, false);

export const setRole = (pid: string, uid: string, role: Role) =>
  locked((d) => {
    const m = d.projects[pid]?.members.find((x) => x.uid === uid);
    if (m) m.role = role;
    return !!m;
  });

export const renameMember = (pid: string, uid: string, name: string) =>
  locked((d) => {
    const m = d.projects[pid]?.members.find((x) => x.uid === uid);
    const clean = name.trim().slice(0, 80);
    if (m && clean) m.name = clean;
    return !!m;
  });

/** Kept as a former member (their comments keep a face); their keys stop working at once. */
export const removeMember = (pid: string, uid: string) =>
  locked((d) => {
    const m = d.projects[pid]?.members.find((x) => x.uid === uid);
    if (m && !m.revokedAt) m.revokedAt = Date.now();
    for (const [h, k] of Object.entries(d.keys)) if (k.projectId === pid && k.uid === uid) delete d.keys[h];
    return !!m;
  });

export const leave = removeMember;

export const people = (pid: string) =>
  locked((d) => {
    const out: Record<string, Person> = {};
    const owner = readOwner();
    out.owner = owner ? { name: owner.name, avatar: owner.avatar, ...(owner.gh ? { gh: owner.gh } : {}), role: "owner" } : { name: "Owner", avatar: null, role: "owner" };
    for (const m of d.projects[pid]?.members ?? []) out[m.uid] = person(m);
    return out;
  }, false);

/** A deleted project takes its invites, members and keys with it. */
export const forgetProject = (pid: string) =>
  locked((d) => {
    delete d.projects[pid];
    for (const [h, k] of Object.entries(d.keys)) if (k.projectId === pid) delete d.keys[h];
  });

export const hasActiveSharing = () =>
  locked((d) => Object.values(d.projects).some((p) => p.members.some((m) => !m.revokedAt) || p.invites.some((i) => !inviteState(i))), false);

import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FIREBASE_CONFIG, FIREBASE_PROJECT } from "../shared/firebase-config";
import type { Person } from "../shared/share";
import { repoRoot } from "../sandbox/util";
import { shareHome } from "./paths";

/**
 * This Mac's own Firebase identity (an anonymous account), over plain REST: it reads the guests'
 * one-time identity proofs and publishes where its tunnel currently is. No firebase-admin.
 */
export interface ProofIdentity {
  uid: string;
  gh: string;
  email: string;
}

type Owner = { uid: string; gh: string; email: string; name: string; avatar: string | null };
type ServerFile = { v: 1; uid: string; refreshToken: string; owner: Owner | null; url: string | null };

const KEY = FIREBASE_CONFIG.apiKey;
const DOCS = `projects/${FIREBASE_PROJECT}/databases/(default)/documents`;
const FS = `https://firestore.googleapis.com/v1/${DOCS}`;
// The web key is restricted to the site's referrer.
const REFERER = { Referer: "https://sparkflow-ai.web.app/" };
const TUNNEL = /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/;
const GH = /^\d{1,15}$/;

const serverFile = () => join(shareHome(), "server.json");

function readServer(): ServerFile | null {
  try {
    const s = JSON.parse(readFileSync(serverFile(), "utf8"));
    return s?.uid && s.refreshToken ? s : null;
  } catch {
    return null;
  }
}

function writeServer(s: ServerFile) {
  mkdirSync(shareHome(), { recursive: true, mode: 0o700 });
  const tmp = `${serverFile()}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(s, null, 2), { mode: 0o600 });
  chmodSync(tmp, 0o600);
  renameSync(tmp, serverFile());
}

async function google(url: string, init: RequestInit = {}) {
  const res = await fetch(url, { ...init, headers: { ...REFERER, ...(init.headers as Record<string, string>) } });
  if (!res.ok) throw new Error(`Sparkflow sharing: ${new URL(url).host} answered ${res.status}`);
  return res.status === 204 ? null : res.json();
}

let token: { id: string; until: number } | undefined;
let creating: Promise<string> | undefined;

/** The server's uid, creating its anonymous account the first time. */
export function ensureServerIdentity(): Promise<string> {
  const s = readServer();
  if (s) return Promise.resolve(s.uid);
  creating ??= (async () => {
    const r = await google(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ returnSecureToken: true }),
    });
    writeServer({ v: 1, uid: r.localId, refreshToken: r.refreshToken, owner: null, url: null });
    token = { id: r.idToken, until: Date.now() + (Number(r.expiresIn) - 60) * 1000 };
    return r.localId as string;
  })().finally(() => (creating = undefined));
  return creating;
}

export const serverUid = () => readServer()?.uid ?? null;

/** A fresh ID token, cached until a minute before it expires. */
export async function serverIdToken(): Promise<string> {
  if (token && token.until > Date.now()) return token.id;
  await ensureServerIdentity();
  const s = readServer()!;
  const r = await google(`https://securetoken.googleapis.com/v1/token?key=${KEY}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: s.refreshToken }).toString(),
  });
  if (r.refresh_token && r.refresh_token !== s.refreshToken) writeServer({ ...s, refreshToken: r.refresh_token });
  token = { id: r.id_token, until: Date.now() + (Number(r.expires_in) - 60) * 1000 };
  return token.id;
}

const auth = async () => ({ Authorization: `Bearer ${await serverIdToken()}` });

export async function fsGet(path: string) {
  return google(`${FS}/${path}`, { headers: await auth() });
}

export async function fsDelete(path: string) {
  return google(`${FS}/${path}`, { method: "DELETE", headers: await auth() });
}

/** One write through documents:commit, the only way to stamp a field with the request time over REST. */
export async function fsCommit(writes: unknown[]) {
  return google(`${FS}:commit`, { method: "POST", headers: { ...(await auth()), "content-type": "application/json" }, body: JSON.stringify({ writes }) });
}

const str = (f: Record<string, { stringValue?: string }> | undefined, k: string) => f?.[k]?.stringValue ?? "";

/** Reads a guest's identity proof once: it must be under 5 minutes old, and it is deleted right away. */
export async function readProof(proofId: string): Promise<ProofIdentity> {
  if (!/^[A-Za-z0-9_-]{22,64}$/.test(proofId)) throw new Error("Sparkflow sharing: bad proof");
  const uid = await ensureServerIdentity();
  const path = `servers/${uid}/proofs/${proofId}`;
  const doc = await fsGet(path);
  await fsDelete(path).catch(() => {});
  const f = doc?.fields;
  const at = Date.parse(f?.at?.timestampValue ?? "");
  if (!Number.isFinite(at) || Date.now() - at > 5 * 60_000) throw new Error("Sparkflow sharing: proof expired");
  const id = { uid: str(f, "uid"), gh: str(f, "gh"), email: str(f, "email") };
  if (!id.uid || (id.gh && !GH.test(id.gh))) throw new Error("Sparkflow sharing: bad proof");
  return id;
}

let version: string | undefined;
const appVersion = () => {
  try {
    version ??= String(JSON.parse(readFileSync(join(repoRoot(), "package.json"), "utf8")).version ?? "");
  } catch {
    version = "";
  }
  return version.slice(0, 20);
};

/** The tunnel URL remote.mjs wrote, only when it is a Cloudflare quick tunnel (so nobody can make us publish another host). */
export function currentTunnelUrl(): string | null {
  const file = process.env.SPARKFLOW_CONNECTION;
  if (!file) return null;
  try {
    const url = JSON.parse(readFileSync(file, "utf8"))?.url;
    return typeof url === "string" && TUNNEL.test(url) ? url : null;
  } catch {
    return null;
  }
}

/** servers/{uid} = {url, seenAt, version}: where guests find this Mac. null when offline. */
export async function publishBeacon(url: string | null) {
  const s = readServer();
  if (!s) return;
  const safe = url && TUNNEL.test(url) ? url : null;
  await fsCommit([
    {
      update: { name: `${DOCS}/servers/${s.uid}`, fields: { url: safe ? { stringValue: safe } : { nullValue: null }, version: { stringValue: appVersion() } } },
      updateTransforms: [{ fieldPath: "seenAt", setToServerValue: "REQUEST_TIME" }],
    },
  ]);
  const now = readServer();
  if (now) writeServer({ ...now, url: safe });
}

export const avatarFor = (gh: string | undefined | null) => (gh && GH.test(gh) ? `https://avatars.githubusercontent.com/u/${gh}?v=4` : null);

/** Name without the GitHub API (v1): the email's local part, else "GitHub user <id>". */
export const nameFor = (id: ProofIdentity) => (id.email ? id.email.split("@")[0] : id.gh ? `GitHub user ${id.gh}` : "Guest").slice(0, 80);

export function readOwner(): (Person & { uid: string; email: string }) | null {
  const o = readServer()?.owner;
  return o ? { uid: o.uid, email: o.email, name: o.name, avatar: o.avatar, ...(o.gh ? { gh: o.gh } : {}), role: "owner" } : null;
}

/** The owner's profile, from their own proof (never from a request body). */
export async function setOwner(id: ProofIdentity): Promise<Person> {
  await ensureServerIdentity();
  const s = readServer()!;
  const owner: Owner = { uid: id.uid, gh: id.gh, email: id.email, name: nameFor(id), avatar: avatarFor(id.gh) };
  writeServer({ ...s, owner });
  return readOwner()!;
}

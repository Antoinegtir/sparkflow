import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dataDir } from "../sandbox/util";

/**
 * Sparkflow in the cloud (Cloud Run, sandboxes on Modal): anyone signed in on the site can build apps
 * without installing it. Each person gets a session key after proving who they are with their Firebase
 * sign-in, sees only the projects they made, and has a daily number of agent runs. Mac-only features
 * (the iOS Simulator, the stores, GitHub, sharing) are off: the app shows in the web preview.
 */
export const CLOUD = process.env.SPARKFLOW_CLOUD === "1";

/** Agent runs (new apps and changes) a person may start per day. */
export const DAILY_RUNS = Number(process.env.SPARKFLOW_CLOUD_DAILY_RUNS ?? 3);
/**
 * No daily limit until this date (the hackathon's judging, through the closing ceremony on Nov 9, ET),
 * then DAILY_RUNS a person. Both are Cloud Run env vars, changed without a rebuild.
 */
const UNLIMITED_UNTIL = Date.parse(process.env.SPARKFLOW_CLOUD_UNLIMITED_UNTIL ?? "2026-11-10T05:00:00Z");
const unlimited = () => Date.now() < UNLIMITED_UNTIL;
const SESSION_DAYS = 7;

type Session = { uid: string; email: string; name: string; exp: number };
/** A signed-in person's public face (for the people they share their apps with), from their sign-in. */
export type Profile = { name: string; email: string; avatar: string | null; gh: string };
type Store = { sessions: Record<string, Session>; owners: Record<string, string>; runs: Record<string, { day: string; n: number }>; profiles: Record<string, Profile> };

const file = () => path.join(dataDir(), "cloud", "state.json");
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const today = () => new Date().toISOString().slice(0, 10);

// Read on each call (the proxy and the routes are separate module instances); small file.
function load(): Store {
  try {
    const d = JSON.parse(readFileSync(file(), "utf8"));
    return { sessions: d.sessions ?? {}, owners: d.owners ?? {}, runs: d.runs ?? {}, profiles: d.profiles ?? {} };
  } catch {
    return { sessions: {}, owners: {}, runs: {}, profiles: {} };
  }
}
function save(d: Store) {
  mkdirSync(path.dirname(file()), { recursive: true });
  const tmp = `${file()}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(d), { mode: 0o600 });
  renameSync(tmp, file());
}

/** A new session key for a person who just proved their sign-in. Only its hash is kept. */
export function createSession(user: { uid: string; email: string; name: string }, profile?: Profile): string {
  const d = load();
  if (profile) d.profiles[user.uid] = profile;
  const now = Date.now();
  for (const [h, s] of Object.entries(d.sessions)) if (s.exp < now) delete d.sessions[h];
  const token = `sfc_${randomBytes(24).toString("base64url")}`;
  d.sessions[hash(token)] = { ...user, exp: now + SESSION_DAYS * 86_400_000 };
  save(d);
  return token;
}

export function sessionOf(token: string | null | undefined): Session | null {
  if (!token?.startsWith("sfc_")) return null;
  const s = load().sessions[hash(token)];
  return s && s.exp > Date.now() ? s : null;
}

export const ownerOf = (projectId: string) => load().owners[projectId] ?? null;

/** Who owns a project, as their friends see them: uid and profile. */
export function ownerProfile(projectId: string): (Profile & { uid: string }) | null {
  const d = load();
  const uid = d.owners[projectId];
  // Not known yet (a session from before profiles): null, so the owner's next session records it.
  return uid && d.profiles[uid] ? { uid, ...d.profiles[uid] } : null;
}

/** This cloud server as a sharing host: links and guests name it, like a Mac's server uid. */
export const CLOUD_HOST = `cloud-${process.env.SPARKFLOW_CLOUD_REGION ?? "eu"}`;

export function setProjectOwner(projectId: string, uid: string) {
  const d = load();
  d.owners[projectId] = uid;
  save(d);
}

export const projectsOf = (uid: string) => new Set(Object.entries(load().owners).filter(([, u]) => u === uid).map(([p]) => p));

/** Counts one agent run for today; false once the day's runs are used. */
export function takeRun(uid: string): boolean {
  const d = load();
  const r = d.runs[uid]?.day === today() ? d.runs[uid] : { day: today(), n: 0 };
  if (r.n >= DAILY_RUNS && !unlimited()) return false;
  d.runs[uid] = { day: r.day, n: r.n + 1 };
  save(d);
  return true;
}

export function runsLeft(uid: string) {
  const r = load().runs[uid];
  if (unlimited()) return 999;
  return Math.max(0, DAILY_RUNS - (r?.day === today() ? r.n : 0));
}

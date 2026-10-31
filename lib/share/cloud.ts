import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { CLOUD } from "@/lib/cloud/mode";
import { join } from "node:path";
import type { ProjectState } from "../shared";
import { FIREBASE_CONFIG, FIREBASE_PROJECT } from "../shared/firebase-config";
import { fsCommit, readOwner, serverIdToken, serverUid } from "./firebase";
import { shareHome } from "./paths";
import { activeMemberUids } from "./store";

/**
 * A read-only copy of each project in the cloud, so its owner and the people it is shared with still see its
 * pages when this Mac is offline: the page list, links and latest screenshots in Cloud Storage under
 * servers/{serverUid}/projects/{projectId}/, and a Firestore document there listing who may read them
 * (the rules check it). Refreshed a few seconds after anything changes; only screenshots not sent yet
 * are uploaded.
 */
export type CloudSnapshot = {
  name: string;
  order: string[];
  edges: { from: string; to: string }[];
  screens: Record<string, { title: string; status: string; version: number; shot: string | null; dark: string | null }>;
  at: number;
};

const BUCKET = FIREBASE_CONFIG.storageBucket;
const DOCS = `projects/${FIREBASE_PROJECT}/databases/(default)/documents`;
const REFERER = { Referer: "https://sparkflow-ai.web.app/" };
const base = (uid: string, pid: string) => `servers/${uid}/projects/${pid}`;
const manifestFile = (pid: string) => join(shareHome(), "cloud", `${pid.replace(/[^\w-]/g, "")}.json`);

type Manifest = { shots: string[]; members: string[] };
function readManifest(pid: string): Manifest | null {
  try {
    return JSON.parse(readFileSync(manifestFile(pid), "utf8"));
  } catch {
    return null;
  }
}
function writeManifest(pid: string, m: Manifest) {
  mkdirSync(join(shareHome(), "cloud"), { recursive: true, mode: 0o700 });
  writeFileSync(manifestFile(pid), JSON.stringify(m), { mode: 0o600 });
}

async function upload(path: string, body: Buffer | string, contentType: string, cache: string) {
  const res = await fetch(`https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o?uploadType=media&name=${encodeURIComponent(path)}`, {
    method: "POST",
    headers: { ...REFERER, Authorization: `Bearer ${await serverIdToken()}`, "content-type": contentType, "Cache-Control": cache },
    body: typeof body === "string" ? body : new Uint8Array(body),
  });
  if (!res.ok) throw new Error(`Sparkflow sharing: cloud copy upload answered ${res.status}`);
}

const shotName = (url?: string | null) => (url ? (url.split("/").pop()?.split("?")[0] ?? null) : null);

/** Sends the project's current pages to its cloud copy (readable by its owner and members). */
export async function publishSnapshot(pid: string, state: ProjectState, readShot: (name: string) => Promise<Buffer>) {
  // The cloud is the copy: always reachable, and it has no Firebase account of its own.
  if (CLOUD) return;
  const uid = serverUid();
  if (!uid) return;
  const members = [...new Set([...(await activeMemberUids(pid)), ...(readOwner()?.uid ? [readOwner()!.uid] : [])])];
  const prev = readManifest(pid);
  const sent = new Set(prev?.shots ?? []);
  const screens: CloudSnapshot["screens"] = {};
  for (const r of state.order) {
    const s = state.screens[r];
    if (!s) continue;
    const shot = shotName(s.screenshotUrl);
    const dark = shotName(s.dark?.url);
    for (const n of [shot, dark]) {
      if (!n || sent.has(n)) continue;
      const png = await readShot(n).catch(() => null);
      if (!png) continue;
      await upload(`${base(uid, pid)}/shots/${n}`, png, "image/png", "public, max-age=31536000, immutable");
      sent.add(n);
    }
    screens[r] = { title: s.title, status: s.status, version: s.version, shot: shot && sent.has(shot) ? shot : null, dark: dark && sent.has(dark) ? dark : null };
  }
  const snap: CloudSnapshot = { name: state.name, order: state.order.filter((r) => screens[r]), edges: state.edges.map(({ from, to }) => ({ from, to })), screens, at: Date.now() };
  await upload(`${base(uid, pid)}/snapshot.json`, JSON.stringify(snap), "application/json", "no-cache");
  await fsCommit([
    {
      update: {
        name: `${DOCS}/${base(uid, pid)}`,
        fields: { members: { arrayValue: { values: members.map((m) => ({ stringValue: m })) } }, name: { stringValue: state.name.slice(0, 80) } },
      },
      updateTransforms: [{ fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }],
    },
  ]);
  writeManifest(pid, { shots: [...sent], members });
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();
/** Publishes a few seconds after the last change (a run sends many events), one project at a time. */
export function scheduleSnapshot(pid: string, get: () => Promise<{ state: ProjectState; readShot: (name: string) => Promise<Buffer> }>, delay = 4000) {
  clearTimeout(timers.get(pid));
  timers.set(
    pid,
    setTimeout(() => {
      timers.delete(pid);
      void get()
        .then(({ state, readShot }) => publishSnapshot(pid, state, readShot))
        .catch((err) => console.error("[sparkflow] cloud copy failed", (err as Error).message));
    }, delay),
  );
}

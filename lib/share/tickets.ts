import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { shareHome } from "./paths";

/**
 * Short-lived signed URLs for images and raw files (<img src> can't send the guest key):
 * "t1." + b64url({u, p, e}) + "." + 16-byte HMAC. Membership is still checked live by the gate.
 */
let cached: { file: string; key: Buffer } | undefined;

function ticketKey() {
  const file = join(shareHome(), "ticket.key");
  if (cached?.file === file) return cached.key;
  let key: Buffer;
  try {
    key = readFileSync(file);
  } catch {
    mkdirSync(shareHome(), { recursive: true, mode: 0o700 });
    try {
      writeFileSync(file, randomBytes(32), { flag: "wx", mode: 0o600 });
    } catch (e) {
      // Another process created it first: use theirs.
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
    chmodSync(file, 0o600);
    key = readFileSync(file);
  }
  cached = { file, key };
  return key;
}

const sign = (payload: string) => createHmac("sha256", ticketKey()).update(`t1.${payload}`).digest().subarray(0, 16).toString("base64url");

/** Expires at the end of the next hour, so the same URL is reused (and cached) for at least an hour. */
export function mintTicket(uid: string, projectId: string): { ticket: string; exp: number } {
  const hour = 3_600_000;
  const exp = (Math.floor(Date.now() / hour) + 2) * hour;
  const payload = Buffer.from(JSON.stringify({ u: uid, p: projectId, e: exp })).toString("base64url");
  return { ticket: `t1.${payload}.${sign(payload)}`, exp };
}

export function readTicket(t: string): { uid: string; projectId: string } | null {
  const parts = t.split(".");
  if (parts.length !== 3 || parts[0] !== "t1") return null;
  const [, payload, sig] = parts;
  const want = Buffer.from(sign(payload));
  const got = Buffer.from(sig);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const { u, p, e } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof u !== "string" || typeof p !== "string" || typeof e !== "number" || e <= Date.now()) return null;
    return { uid: u, projectId: p };
  } catch {
    return null;
  }
}

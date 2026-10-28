import { execFile, spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { findFreePort } from "../sandbox/util";
import * as android from "./android";

const run = promisify(execFile);
const home = os.homedir();
export const companionPath = () => process.env.IDB_COMPANION_PATH ?? path.join(home, ".local/idb/idb_companion");
const protoPath = () => process.env.IDB_PROTO_PATH ?? path.join(home, ".local/idb/venv/proto/idb.proto");
export const idbAvailable = () => existsSync(companionPath()) && existsSync(protoPath());

type Client = grpc.Client & Record<string, any>;
type Companion = { proc: ChildProcess; client: Client; points: { width: number; height: number } | null };

const g = globalThis as unknown as { __sparkflowIdb?: Map<string, Promise<Companion>>; __sparkflowIdbExit?: boolean; __sparkflowAxEnabled?: Set<string> };
const companions: Map<string, Promise<Companion>> = (g.__sparkflowIdb ??= new Map());
const axEnabled: Set<string> = (g.__sparkflowAxEnabled ??= new Set());
if (!g.__sparkflowIdbExit) {
  g.__sparkflowIdbExit = true;
  process.on("exit", () => {
    for (const p of companions.values()) void p.then((c) => c.proc.kill("SIGKILL")).catch(() => {});
  });
}

let Service: grpc.ServiceClientConstructor | null = null;
function service() {
  if (Service) return Service;
  const def = protoLoader.loadSync(protoPath(), { keepCase: true, longs: Number, enums: String, oneofs: true, defaults: true });
  Service = (grpc.loadPackageDefinition(def).idb as any).CompanionService as grpc.ServiceClientConstructor;
  return Service;
}

const unary = <T>(client: Client, method: string, req: unknown, timeoutMs = 10000) =>
  new Promise<T>((resolve, reject) => client[method](req, { deadline: Date.now() + timeoutMs }, (err: Error | null, res: T) => (err ? reject(err) : resolve(res))));

/** One long-lived idb_companion per simulator, reached over gRPC. */
export function companion(udid: string): Promise<Companion> {
  let p = companions.get(udid);
  if (!p) {
    p = (async () => {
      // Companions left by earlier runs (a server stopped with Ctrl+C doesn't get to kill them) fight
      // this one for the touch input: only one may drive a simulator.
      await run("pkill", ["-f", `idb_companion --udid ${udid}`]).catch(() => {});
      const port = await findFreePort(10882);
      const proc = spawn(companionPath(), ["--udid", udid, "--grpc-port", String(port)], { stdio: "ignore" });
      const client = new (service())(`127.0.0.1:${port}`, grpc.credentials.createInsecure()) as Client;
      const deadline = Date.now() + 20000;
      for (;;) {
        try {
          const res = await unary<any>(client, "describe", { fetch_diagnostics: false }, 2000);
          const d = res.target_description?.screen_dimensions;
          return { proc, client, points: d?.width_points ? { width: d.width_points, height: d.height_points } : null };
        } catch (err) {
          if (proc.exitCode !== null || Date.now() > deadline) {
            proc.kill("SIGKILL");
            throw new Error(`idb_companion did not start: ${(err as Error).message}`);
          }
          await new Promise((r) => setTimeout(r, 250));
        }
      }
    })();
    companions.set(udid, p);
    p.catch(() => companions.delete(udid));
    void p.then((c) => c.proc.on("exit", () => companions.get(udid) === p && companions.delete(udid)));
  }
  return p;
}

export async function screenPoints(udid: string) {
  if (android.isAndroidId(udid)) return android.screenPoints(udid);
  return (await companion(udid)).points;
}

export type AxElement = {
  AXLabel?: string | null;
  AXUniqueId?: string | null;
  AXValue?: string | number | null;
  type?: string;
  role_description?: string;
  frame?: { x: number; y: number; width: number; height: number };
  traits?: string[];
  children?: AxElement[];
};

/**
 * Accessibility tree (or the element at a point). iOS resets its accessibility flags on every boot, which
 * makes the tree come back as one empty "Application": turn them on once per boot and retry.
 */
export async function accessibilityInfo(udid: string, point?: { x: number; y: number }): Promise<AxElement[]> {
  if (android.isAndroidId(udid)) return android.accessibilityInfo(udid, point);
  const c = await companion(udid);
  const read = async () => {
    // On the home screen or while booting no app is in front: that's an empty screen, not an error.
    const res = await unary<{ json: string }>(c.client, "accessibility_info", { ...(point ? { point } : {}), format: "LEGACY" }).catch((err: Error) => {
      if (/no frontmost application/i.test(err.message)) return { json: "[]" };
      throw err;
    });
    const parsed = JSON.parse(res.json || "null");
    return (Array.isArray(parsed) ? parsed : parsed ? [parsed] : []) as AxElement[];
  };
  let els = await read();
  const empty = !els.length || (els.length === 1 && els[0].type === "Application" && !point);
  if (empty) {
    axEnabled.delete(udid);
    for (const key of ["ApplicationAccessibilityEnabled", "AccessibilityEnabled"]) {
      await run("xcrun", ["simctl", "spawn", udid, "defaults", "write", "com.apple.Accessibility", key, "-bool", "true"]).catch(() => {});
    }
    await new Promise((r) => setTimeout(r, 800));
    els = await read();
    if (els.length > 1) axEnabled.add(udid);
  }
  return els;
}

type HidEvent = Record<string, unknown>;

/** Sends HID events on one client stream and ends it. */
export async function sendHid(udid: string, events: HidEvent[]) {
  const send = async () => {
    const c = await companion(udid);
    // The events' own delays plus a margin: a wedged companion must fail, not hang.
    const ms = 5000 + events.reduce((n, e) => n + (((e.delay as { duration?: number } | undefined)?.duration ?? 0) * 1000), 0);
    await new Promise<void>((resolve, reject) => {
      const call = c.client.hid({ deadline: Date.now() + ms }, (err: Error | null) => (err ? reject(err) : resolve()));
      for (const e of events) call.write(e);
      call.end();
    });
  };
  try {
    await send();
  } catch {
    // Start a fresh companion and try once more.
    await restartCompanion(udid);
    await send();
  }
}

/** Kills this simulator's companion; the next call starts a new one. */
export async function restartCompanion(udid: string) {
  const p = companions.get(udid);
  companions.delete(udid);
  await p?.then((c) => c.proc.kill("SIGKILL")).catch(() => {});
}

export const touch = (x: number, y: number, direction: "DOWN" | "UP"): HidEvent => ({ press: { action: { touch: { point: { x, y } } }, direction } });
export const delay = (seconds: number): HidEvent => ({ delay: { duration: seconds } });
export const button = (b: string, direction: "DOWN" | "UP"): HidEvent => ({ press: { action: { button: { button: b } }, direction } });
export const swipe = (x: number, y: number, x2: number, y2: number, duration: number): HidEvent => ({
  swipe: { start: { x, y }, end: { x: x2, y: y2 }, delta: 10, duration },
});

/** Opens a long-lived HID stream (one per live gesture). */
export async function openHidStream(udid: string) {
  const c = await companion(udid);
  const call = c.client.hid(() => {});
  return { write: (e: HidEvent) => call.write(e), end: () => call.end() };
}

/** Duplex video stream; returns the call so the caller can read payloads and stop it. */
export async function videoStream(udid: string) {
  const c = await companion(udid);
  const call = c.client.video_stream();
  // Light frames (~38 KB): through the Cloudflare tunnel the stream is bound by bandwidth, and at
  // quality 0.7 / scale 0.5 (~84 KB) a scroll came through at ~10 fps instead of ~24.
  call.write({ start: { file_path: "", fps: 0, format: "MJPEG", compression_quality: 0.5, scale_factor: 0.45 } });
  return call as grpc.ClientDuplexStream<unknown, { payload?: { data?: Buffer } }>;
}

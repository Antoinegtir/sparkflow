import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import os from "node:os";
import { isMac } from "@/lib/web/platform";
import path from "node:path";
import { promisify } from "node:util";
import { companionPath, idbAvailable, screenPoints, sendHid, swipe as hidSwipe, touch, delay } from "./idb";

const run = promisify(execFile);
const home = os.homedir();

export const assertUdid = (udid: string) => {
  if (!/^[0-9A-F-]{36}$/i.test(udid)) throw new Error("Invalid simulator id");
  return udid;
};

export async function simctl(...args: string[]) {
  const { stdout } = await run("xcrun", ["simctl", ...args], { maxBuffer: 64 * 1024 * 1024 });
  return stdout;
}

export type Booted = { udid: string; name: string; runtime: string };

export async function bootedDevices(): Promise<Booted[]> {
  if (!isMac()) return [];
  const json = JSON.parse(await simctl("list", "devices", "booted", "-j").catch(() => '{"devices":{}}'));
  return Object.entries(json.devices as Record<string, { udid: string; name: string; state: string }[]>).flatMap(([runtime, list]) =>
    list.filter((d) => d.state === "Booted").map((d) => ({ udid: d.udid, name: d.name, runtime: runtime.replace(/^.*SimRuntime\.iOS-/, "iOS ").replace(/-/g, ".") })),
  );
}

type Driver = { kind: "idb"; bin: string } | { kind: "axe"; bin: string } | null;
let cached: Driver | undefined;

/**
 * Input driver: idb first (AXe 1.8 reports success on the iOS 27 simulator but its touches never reach the
 * app), then AXe. A found driver is cached; "none" is re-checked so installing one needs no restart.
 */
export async function inputDriver(): Promise<Driver> {
  if (cached) return cached;
  const which = async (b: string) => run("which", [b]).then((r) => r.stdout.trim(), () => "");
  const venvIdb = path.join(home, ".local/idb/venv/bin/idb");
  let d: Driver = null;
  if (existsSync(venvIdb)) d = { kind: "idb", bin: venvIdb };
  else if (await which("idb")) d = { kind: "idb", bin: "idb" };
  else if (process.env.AXE_PATH && existsSync(process.env.AXE_PATH)) d = { kind: "axe", bin: process.env.AXE_PATH };
  else if (existsSync(path.join(home, ".local/axe/axe"))) d = { kind: "axe", bin: path.join(home, ".local/axe/axe") };
  else if (await which("axe")) d = { kind: "axe", bin: "axe" };
  if (d) cached = d;
  return d;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export type Input = { tap: { x: number; y: number; duration?: number } } | { swipe: { x: number; y: number; x2: number; y2: number; duration?: number } } | { text: string };

export async function sendInput(udid: string, input: Input) {
  // Fast path: gRPC straight to idb_companion.
  if (idbAvailable() && !("text" in input)) {
    if ("tap" in input) {
      const hold = clamp(input.tap.duration ?? 0.08, 0.05, 3);
      return sendHid(udid, [touch(input.tap.x, input.tap.y, "DOWN"), delay(hold), touch(input.tap.x, input.tap.y, "UP")]);
    }
    const s = input.swipe;
    return sendHid(udid, [hidSwipe(s.x, s.y, s.x2, s.y2, clamp(s.duration ?? 0.3, 0.1, 2))]);
  }
  const d = await inputDriver();
  if (!d) throw Object.assign(new Error("No input driver: install AXe or idb"), { status: 501 });
  const r = (n: number) => String(Math.round(n));
  let args: string[];
  if (d.kind === "axe") {
    if ("tap" in input) args = ["tap", "-x", r(input.tap.x), "-y", r(input.tap.y), "--udid", udid];
    else if ("swipe" in input) args = ["swipe", "--start-x", r(input.swipe.x), "--start-y", r(input.swipe.y), "--end-x", r(input.swipe.x2), "--end-y", r(input.swipe.y2), "--udid", udid];
    else args = ["type", input.text, "--udid", udid];
  } else {
    const base = ["--companion-path", companionPath()];
    // Some native controls ignore zero-length taps.
    if ("tap" in input) args = ["ui", "tap", r(input.tap.x), r(input.tap.y), "--duration", "0.1", "--udid", udid, ...base];
    else if ("swipe" in input) args = ["ui", "swipe", r(input.swipe.x), r(input.swipe.y), r(input.swipe.x2), r(input.swipe.y2), "--udid", udid, ...base];
    else args = ["ui", "text", input.text, "--udid", udid, ...base];
  }
  await run(d.bin, args);
}

export async function frame(udid: string, type: "jpeg" | "png" = "jpeg"): Promise<Buffer> {
  // simctl does not write images to stdout: go through a temp file.
  const file = path.join(os.tmpdir(), `sparkflow-frame-${udid}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${type === "png" ? "png" : "jpg"}`);
  try {
    await run("xcrun", ["simctl", "io", udid, "screenshot", `--type=${type}`, file]);
    return await readFile(file);
  } finally {
    await rm(file, { force: true });
  }
}

export async function launch(udid: string, opts: { bundleId?: string; url?: string }) {
  if (opts.url) return simctl("openurl", udid, opts.url);
  if (!opts.bundleId || !/^[A-Za-z0-9.-]+$/.test(opts.bundleId)) throw new Error("Invalid bundle id");
  return simctl("launch", "--terminate-running-process", udid, opts.bundleId);
}

export async function appearance(udid: string): Promise<"light" | "dark" | "unknown"> {
  const out = (await simctl("ui", udid, "appearance").catch(() => "")).trim();
  return out === "dark" || out === "light" ? out : "unknown";
}

export { screenPoints };

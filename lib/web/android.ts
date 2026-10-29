import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { AxElement } from "./idb";

/**
 * Android emulator through adb: the same operations as the iOS Simulator (simctl + idb), in points (dp).
 * Emulators are addressed by their adb serial ("emulator-5554").
 */
const run = promisify(execFile);
const home = os.homedir();

export const isAndroidId = (id: string) => /^emulator-\d{2,5}$/.test(id);

const sdkRoots = () =>
  [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, path.join(home, "Library/Android/sdk"), path.join(home, "Android/Sdk")].filter((p): p is string => !!p);

function tool(dir: string, bin: string) {
  for (const root of sdkRoots()) {
    const p = path.join(root, dir, bin);
    if (existsSync(p)) return p;
  }
  return bin;
}

let adbBin: string | null | undefined;
/** adb from the Android SDK, else the PATH; null when there is none. */
export async function adbPath() {
  if (adbBin !== undefined && adbBin !== null) return adbBin;
  const p = tool("platform-tools", "adb");
  adbBin = p !== "adb" ? p : await run("which", ["adb"]).then((r) => r.stdout.trim() || null, () => null);
  return adbBin;
}

export async function adb(serial: string | null, ...args: string[]) {
  const bin = await adbPath();
  if (!bin) throw new Error("adb not found: install the Android SDK platform-tools");
  const { stdout } = await run(bin, [...(serial ? ["-s", serial] : []), ...args], { maxBuffer: 64 * 1024 * 1024, encoding: "buffer" });
  return stdout;
}
const shell = async (serial: string, ...args: string[]) => (await adb(serial, "shell", ...args)).toString("utf8");

export type BootedAndroid = { udid: string; name: string; runtime: string };

export async function bootedEmulators(): Promise<BootedAndroid[]> {
  if (!(await adbPath())) return [];
  const out = (await adb(null, "devices").catch(() => Buffer.from(""))).toString("utf8");
  const serials = out.split("\n").flatMap((l) => {
    const m = /^(emulator-\d+)\s+device\b/.exec(l.trim());
    return m ? [m[1]] : [];
  });
  return Promise.all(
    serials.map(async (udid) => {
      const [avd, release] = await Promise.all([
        shell(udid, "getprop", "ro.boot.qemu.avd_name").catch(() => ""),
        shell(udid, "getprop", "ro.build.version.release").catch(() => ""),
      ]);
      return { udid, name: avd.trim().replace(/_/g, " ") || udid, runtime: `Android ${release.trim()}`.trim() };
    }),
  );
}

const densities = new Map<string, number>();
/** Pixels per dp. */
async function scale(serial: string) {
  let d = densities.get(serial);
  if (!d) {
    const out = await shell(serial, "wm", "density");
    const m = /Override density:\s*(\d+)/.exec(out) ?? /Physical density:\s*(\d+)/.exec(out);
    d = m ? Number(m[1]) / 160 : 1;
    densities.set(serial, d);
  }
  return d;
}

export async function screenPoints(serial: string) {
  const out = await shell(serial, "wm", "size");
  const m = /Override size:\s*(\d+)x(\d+)/.exec(out) ?? /Physical size:\s*(\d+)x(\d+)/.exec(out);
  if (!m) return null;
  const s = await scale(serial);
  return { width: Math.round(Number(m[1]) / s), height: Math.round(Number(m[2]) / s) };
}

export async function frame(serial: string, type: "jpeg" | "png" = "jpeg"): Promise<Buffer> {
  const png = await adb(serial, "exec-out", "screencap", "-p");
  if (type === "png") return png;
  const sharp = (await import("sharp")).default;
  return sharp(png).jpeg({ quality: 70 }).toBuffer();
}

const px = async (serial: string, ...v: number[]) => {
  const s = await scale(serial);
  return v.map((n) => String(Math.round(n * s)));
};

/** `input text` takes no spaces and the device shell parses the rest: spaces as %s, the rest escaped. */
const inputText = (t: string) => t.replace(/[\\'"`$&|;<>()*?~!#[\]{}%]/g, (c) => `\\${c}`).replace(/ /g, "%s");

export async function tap(serial: string, x: number, y: number, duration = 0) {
  const [a, b] = await px(serial, x, y);
  // A long press is a swipe that does not move.
  if (duration >= 0.4) await shell(serial, "input", "swipe", a, b, a, b, String(Math.round(duration * 1000)));
  else await shell(serial, "input", "tap", a, b);
}

export async function swipe(serial: string, x: number, y: number, x2: number, y2: number, duration = 0.3) {
  const [a, b, c, d] = await px(serial, x, y, x2, y2);
  await shell(serial, "input", "swipe", a, b, c, d, String(Math.round(duration * 1000)));
}

export async function type(serial: string, text: string) {
  await shell(serial, "input", "text", inputText(text));
}

const KEYS = { VOLUME_UP: "24", VOLUME_DOWN: "25", SIDE_BUTTON: "26", HOME: "3" } as const;
export async function button(serial: string, b: keyof typeof KEYS, hold = 0.1) {
  await shell(serial, "input", "keyevent", ...(hold >= 0.5 ? ["--longpress"] : []), KEYS[b]);
}

/** Ports of localhost URLs reach the host's (adb reverse): the emulator's own localhost is itself. */
async function reverse(serial: string, url: string) {
  const u = new URL(url);
  if (!/^(localhost|127\.0\.0\.1)$/.test(u.hostname)) return;
  const port = u.port || (u.protocol === "https:" ? "443" : "80");
  await adb(serial, "reverse", `tcp:${port}`, `tcp:${port}`).catch(() => {});
}

/**
 * The dev build loads its bundle from Metro at localhost:<port>, which only reaches this computer through
 * adb reverse. Reverses go away when adb restarts or Metro moves to another port (sparkflow restarted):
 * set them again for every running Metro whenever the emulator is opened or watched.
 */
export async function reverseMetros(serial: string) {
  const metros = (globalThis as unknown as { __sparkflowMetro?: Map<string, { port: number; proc: { exitCode: number | null } }> }).__sparkflowMetro;
  const ports = [...(metros?.values() ?? [])].filter((m) => m.proc.exitCode === null).map((m) => m.port);
  await Promise.all(ports.map((p) => adb(serial, "reverse", `tcp:${p}`, `tcp:${p}`).catch(() => {})));
}

export async function openUrl(serial: string, url: string, pkg?: string) {
  await Promise.all([reverse(serial, url), reverseMetros(serial)]);
  await shell(serial, "am", "start", "-a", "android.intent.action.VIEW", "-d", `'${url.replace(/'/g, "")}'`, ...(pkg ? [pkg] : []));
}

export async function launch(serial: string, opts: { bundleId?: string; url?: string }) {
  if (opts.url) return openUrl(serial, opts.url);
  if (!opts.bundleId || !/^[A-Za-z0-9._]+$/.test(opts.bundleId)) throw new Error("Invalid package name");
  await reverseMetros(serial);
  await shell(serial, "am", "force-stop", opts.bundleId);
  await shell(serial, "monkey", "-p", opts.bundleId, "-c", "android.intent.category.LAUNCHER", "1");
}

export async function appearance(serial: string): Promise<"light" | "dark" | "unknown"> {
  const out = await shell(serial, "cmd", "uimode", "night").catch(() => "");
  return /: yes/i.test(out) ? "dark" : /: no/i.test(out) ? "light" : "unknown";
}

export async function setAppearance(serial: string, look: "light" | "dark") {
  await shell(serial, "cmd", "uimode", "night", look === "dark" ? "yes" : "no");
}

/** UI hierarchy (uiautomator) as idb-shaped elements, in dp. */
export function parseHierarchy(xml: string, s: number): AxElement[] {
  const root: AxElement[] = [];
  const stack: AxElement[][] = [root];
  const attr = (tag: string, name: string) => {
    const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
    return m ? m[1].replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&") : "";
  };
  for (const m of xml.matchAll(/<node\b[^>]*?(\/?)>|<\/node>/g)) {
    if (m[0] === "</node>") {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const tag = m[0];
    const b = /\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]/.exec(attr(tag, "bounds"));
    const cls = attr(tag, "class");
    const label = attr(tag, "content-desc") || attr(tag, "text");
    const short = cls.split(".").pop() ?? "";
    const el: AxElement = {
      type: /Button/.test(short) || attr(tag, "clickable") === "true" ? "Button" : /Text/.test(short) ? "StaticText" : short || "Element",
      ...(label ? { AXLabel: label } : {}),
      ...(attr(tag, "resource-id") ? { AXUniqueId: attr(tag, "resource-id").replace(/^.*:id\//, "") } : {}),
      ...(attr(tag, "text") && attr(tag, "content-desc") ? { AXValue: attr(tag, "text") } : {}),
      traits: [...(attr(tag, "selected") === "true" ? ["selected"] : []), ...(attr(tag, "checked") === "true" ? ["selected"] : []), ...(attr(tag, "heading") === "true" ? ["Header"] : [])],
      ...(b ? { frame: { x: Number(b[1]) / s, y: Number(b[2]) / s, width: (Number(b[3]) - Number(b[1])) / s, height: (Number(b[4]) - Number(b[2])) / s } } : {}),
      children: [],
    } as AxElement;
    stack[stack.length - 1].push(el);
    if (!m[1]) stack.push(el.children!);
  }
  // A pressable row or tab is a View around its text: give it its text as label, as iOS does.
  const name = (e: AxElement): string | undefined => e.AXLabel ?? (e.children ?? []).map(name).find(Boolean);
  for (const e of flatten(root)) if (e.type === "Button" && !e.AXLabel) e.AXLabel = name(e) ?? undefined;
  return root;
}

/**
 * Tabs of a bottom bar: two or more labelled buttons on one row in the bottom 20 % of the screen
 * (Android exposes no tab bar role for JS tab bars).
 */
export function bottomTabs(els: AxElement[], screenHeight: number) {
  const all = flatten(els);
  // Material bottom navigation (react-native-bottom-tabs): each item holds navigation_bar_item_* views.
  // The selected one isn't clickable, and a badge joins its label ("Favoris, 4").
  const material = all.filter((e) => e.AXLabel && e.frame && (e.children ?? []).some((c) => /^navigation_bar_item_/.test(c.AXUniqueId ?? "")));
  if (material.length >= 2)
    return material
      .sort((a, b) => a.frame!.x - b.frame!.x)
      .map((e, i) => ({
        label: e.AXLabel!.replace(/,\s*\d+\+?$/, ""),
        x: e.frame!.x + e.frame!.width / 2,
        y: e.frame!.y + e.frame!.height / 2,
        selected: (e.traits ?? []).includes("selected"),
        index: i + 1,
      }));
  const low = all.filter((e) => e.type === "Button" && e.AXLabel && e.frame && e.frame.y > screenHeight * 0.8 && e.frame.width < 300);
  const rows = new Map<number, AxElement[]>();
  for (const e of low) {
    const k = Math.round(e.frame!.y / 8);
    rows.set(k, [...(rows.get(k) ?? []), e]);
  }
  const row = [...rows.values()].filter((r) => r.length >= 2).sort((a, b) => b.length - a.length)[0] ?? [];
  return row
    .sort((a, b) => a.frame!.x - b.frame!.x)
    .map((e, i) => ({
      label: e.AXLabel!.replace(/, tab, \d+ of \d+$/, ""),
      x: e.frame!.x + e.frame!.width / 2,
      y: e.frame!.y + e.frame!.height / 2,
      selected: (e.traits ?? []).includes("selected") || flatten(e.children ?? []).some((c) => (c.traits ?? []).includes("selected")),
      index: i + 1,
    }));
}

const flatten = (els: AxElement[]): AxElement[] => els.flatMap((e) => [e, ...flatten(e.children ?? [])]);

/** The tree, or the smallest labelled element under a point (like idb's describe-point). */
/** The last tree read per device: pointing around (one request every 120 ms) reuses it for a moment. */
const recentTree = new Map<string, { at: number; tree: Promise<AxElement[]> }>();

/** The tree, reused for 3 s after it arrives (a read takes about 2 s): for pointing and outlining, not for page sync. */
export function recentAccessibility(serial: string): Promise<AxElement[]> {
  const kept = recentTree.get(serial);
  let tree = kept && Date.now() - kept.at < 3000 ? kept.tree : null;
  if (!tree) {
    const entry = { at: Infinity, tree: readTree(serial) };
    recentTree.set(serial, entry);
    void entry.tree.then(
      () => (entry.at = Date.now()),
      () => recentTree.delete(serial),
    );
    tree = entry.tree;
  }
  return tree;
}

export async function accessibilityInfo(serial: string, point?: { x: number; y: number }): Promise<AxElement[]> {
  if (!point) return readTree(serial);
  const all = flatten(await recentAccessibility(serial));
  const screen = Math.max(...all.map((e) => (e.frame ? e.frame.width * e.frame.height : 0)), 1);
  const area = (e: AxElement) => (e.frame!.width || 1) * (e.frame!.height || 1);
  const hits = all.filter((e) => {
    const f = e.frame;
    return f && point.x >= f.x && point.x <= f.x + f.width && point.y >= f.y && point.y <= f.y + f.height && area(e) < screen * 0.98;
  });
  // React Native views rarely carry a label on Android: the smallest thing that means something is
  // what the pointer is on (a text, a button, an image, a card), not the nearest labelled container.
  const meaningful = (e: AxElement) => !!e.AXLabel || e.type === "Button" || /Image/.test(e.type ?? "");
  const best = hits.filter(meaningful).sort((a, b) => area(a) - area(b))[0] ?? hits.filter((e) => area(e) < screen * 0.35).sort((a, b) => area(a) - area(b))[0];
  if (!best) return [];
  // An image says so, rather than its Android class.
  return [/Image/.test(best.type ?? "") && !best.AXLabel ? { ...best, type: "Image" } : best];
}

async function readTree(serial: string): Promise<AxElement[]> {
  let xml = (await adb(serial, "exec-out", "uiautomator", "dump", "/dev/tty").catch(() => Buffer.from(""))).toString("utf8");
  // Recent Android images kill a dump to /dev/tty ("Killed"): dump to a file and read it back.
  if (!xml.includes("<hierarchy")) {
    await adb(serial, "shell", "uiautomator", "dump", "/sdcard/sparkflow-ui.xml").catch(() => null);
    xml = (await adb(serial, "exec-out", "cat", "/sdcard/sparkflow-ui.xml").catch(() => Buffer.from(""))).toString("utf8");
  }
  const end = xml.lastIndexOf("</hierarchy>");
  return parseHierarchy(end >= 0 ? xml.slice(0, end) : xml, await scale(serial));
}

/** Live finger without a HID stream: the gesture is replayed on lift, as a tap or a swipe at its real speed. */
const fingers = new Map<string, { x: number; y: number; t: number; last: { x: number; y: number } }>();
export async function gesture(serial: string, phase: "down" | "move" | "up", x: number, y: number, id = serial) {
  const key = `${serial}:${id}`;
  if (phase === "down") return void fingers.set(key, { x, y, t: performance.now(), last: { x, y } });
  const f = fingers.get(key);
  if (!f) return;
  f.last = { x, y };
  if (phase === "move") return;
  fingers.delete(key);
  const secs = (performance.now() - f.t) / 1000;
  if (Math.hypot(x - f.x, y - f.y) < 8) return tap(serial, x, y, secs);
  await swipe(serial, f.x, f.y, x, y, Math.min(2, Math.max(0.08, secs)));
}

// ---- Emulators (AVDs) ----

export async function listAvds(): Promise<string[]> {
  const bin = tool("emulator", "emulator");
  const out = await run(bin, ["-list-avds"]).then((r) => r.stdout, () => "");
  return out.split("\n").map((l) => l.trim()).filter((l) => l && !/^(INFO|WARNING|ERROR)\b/.test(l));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Starts an AVD (detached) and waits for Android to finish booting. Returns its serial. */
export async function bootAvd(avd: string) {
  if (!/^[\w.-]+$/.test(avd)) throw new Error("Invalid emulator name");
  const before = new Set((await bootedEmulators()).map((d) => d.udid));
  spawn(tool("emulator", "emulator"), ["-avd", avd, "-no-snapshot-save", "-no-boot-anim"], { detached: true, stdio: "ignore" }).unref();
  for (let i = 0; i < 180; i++) {
    await sleep(1000);
    const fresh = (await bootedEmulators()).find((d) => !before.has(d.udid));
    if (fresh && (await shell(fresh.udid, "getprop", "sys.boot_completed").catch(() => "")).trim() === "1") return fresh.udid;
  }
  throw new Error(`${avd} did not boot in 3 minutes`);
}

export async function shutdown(serial: string) {
  await adb(serial, "emu", "kill").catch(() => {});
  densities.delete(serial);
}

/** The AVD a running emulator was started from. */
export async function avdOf(serial: string) {
  return (await shell(serial, "getprop", "ro.boot.qemu.avd_name").catch(() => "")).trim();
}

let ffmpegBin: string | null | undefined;
/** ffmpeg from Homebrew or the PATH; null when there is none. */
async function ffmpegPath() {
  if (ffmpegBin !== undefined) return ffmpegBin;
  const known = ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg"].find((p) => existsSync(p));
  ffmpegBin = known ?? (await run("which", ["ffmpeg"]).then((r) => r.stdout.trim() || null, () => null));
  return ffmpegBin;
}

/**
 * Live screen like the iOS Simulator's: the emulator's H.264 screen recording (frames only when the screen
 * changes, ~30 fps while it moves) decoded to JPEGs by ffmpeg, at half the device resolution. screenrecord
 * stops after 3 minutes: it starts again while someone watches. Resolves null without ffmpeg.
 */
export async function videoFrames(serial: string, onFrame: (jpeg: Buffer) => void): Promise<(() => void) | null> {
  void reverseMetros(serial);
  const [adbBin, ff] = await Promise.all([adbPath(), ffmpegPath()]);
  if (!adbBin || !ff) return null;
  const m = /Physical size:\s*(\d+)x(\d+)/.exec(await shell(serial, "wm", "size"));
  const even = (n: number) => Math.max(2, Math.round(n / 4) * 2);
  const size = m ? `${even(Number(m[1]))}x${even(Number(m[2]))}` : "540x1200";
  const SOI = Buffer.from([0xff, 0xd8]);
  const EOI = Buffer.from([0xff, 0xd9]);
  let stopped = false;
  let kill = () => {};
  const once = () => {
    if (stopped) return;
    const rec = spawn(adbBin, ["-s", serial, "exec-out", "screenrecord", "--output-format=h264", "--size", size, "--bit-rate", "8000000", "-"]);
    // No probing: each frame goes out as soon as it's decoded. Not `-fflags nobuffer`: it drops the packets
    // read while probing, the first keyframe among them, and every frame after decodes to grey garbage.
    // The raw stream has no timestamps: the clock gives them.
    const dec = spawn(ff, [
      ...["-loglevel", "error", "-probesize", "32", "-analyzeduration", "0", "-flags", "low_delay"],
      ...["-use_wallclock_as_timestamps", "1", "-f", "h264", "-i", "-"],
      ...["-vf", "format=yuvj420p", "-fps_mode", "passthrough", "-enc_time_base", "1/1000000", "-f", "mjpeg", "-q:v", "4", "-flush_packets", "1", "-"],
    ]);
    rec.stdout.pipe(dec.stdin);
    dec.stdin.on("error", () => {});
    let buf = Buffer.alloc(0);
    dec.stdout.on("data", (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      for (;;) {
        const s = buf.indexOf(SOI);
        if (s < 0) break;
        const e = buf.indexOf(EOI, s + 2);
        if (e < 0) {
          buf = buf.subarray(s);
          break;
        }
        onFrame(Buffer.from(buf.subarray(s, e + 2)));
        buf = buf.subarray(e + 2);
      }
    });
    kill = () => {
      rec.kill();
      dec.kill();
    };
    rec.on("exit", () => {
      dec.stdin.end();
      if (!stopped) setTimeout(once, 300);
    });
  };
  once();
  return () => {
    stopped = true;
    kill();
    // screenrecord keeps running on the device when adb goes away.
    void adb(serial, "shell", "pkill", "-INT", "screenrecord").catch(() => {});
  };
}

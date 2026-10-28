import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { accessibilityInfo, type AxElement } from "./idb";
import * as android from "./android";
import { sendInput, simctl } from "./simulator";

const run = promisify(execFile);
const BUNDLE = "host.exp.Exponent";
const CACHE = path.join(os.homedir(), ".sparkflow", "cache", "expo-go");

/** The Expo SDK of the template the apps are built from (Expo Go must match it). */
async function templateSdk() {
  const pkg = JSON.parse(await readFile(path.join(process.cwd(), "templates", "expo-base", "package.json"), "utf8"));
  const major = /(\d+)\./.exec(pkg.dependencies?.expo ?? "")?.[1];
  if (!major) throw new Error("Unknown Expo SDK");
  return `${major}.0.0`;
}

async function installedVersion(udid: string) {
  const container = (await simctl("get_app_container", udid, BUNDLE).catch(() => "")).trim();
  if (!container) return null;
  const { stdout } = await run("plutil", ["-extract", "CFBundleShortVersionString", "raw", path.join(container, "Info.plist")]).catch(() => ({ stdout: "" }));
  return stdout.trim() || "unknown";
}

/**
 * Makes sure the Simulator has the Expo Go that runs this template's SDK: downloads the official
 * Simulator build once (cached in ~/.sparkflow/cache) and installs it. Returns its version.
 */
export async function ensureExpoGo(udid: string) {
  if (android.isAndroidId(udid)) return android.ensureExpoGo(udid, await templateSdk());
  // The app opens straight away: no developer menu at launch, no one-time menu walkthrough.
  for (const [key, value] of [["EXDevMenuShowsAtLaunch", "NO"], ["EXDevMenuIsOnboardingFinished", "YES"]]) {
    await simctl("spawn", udid, "defaults", "write", BUNDLE, key, "-bool", value).catch(() => {});
  }
  const sdk = await templateSdk();
  const major = sdk.split(".")[0];
  const current = await installedVersion(udid);
  if (current?.startsWith(`${major}.`)) return current;

  const res = await fetch("https://api.expo.dev/v2/versions/latest");
  if (!res.ok) throw new Error(`Expo versions: HTTP ${res.status}`);
  const info = (await res.json()).data?.sdkVersions?.[sdk];
  const url: string | undefined = info?.iosClientUrl;
  const version: string = info?.iosClientVersion ?? major;
  if (!url) throw new Error(`No Expo Go for SDK ${sdk}`);

  const app = path.join(CACHE, `Exponent-${version}.app`);
  if (!existsSync(path.join(app, "Info.plist"))) {
    await rm(app, { recursive: true, force: true });
    await mkdir(app, { recursive: true });
    const tar = path.join(CACHE, `Exponent-${version}.tar.gz`);
    // curl rather than fetch: the archive is large and fetch drops long downloads.
    await run("curl", ["-fsSL", "--retry", "2", "-o", tar, url], { timeout: 10 * 60_000 });
    await run("tar", ["-xzf", tar, "-C", app]);
    await rm(tar, { force: true });
  }
  if (current) await simctl("uninstall", udid, BUNDLE).catch(() => {});
  await simctl("install", udid, app);
  return version;
}

const flatten = (els: AxElement[]): AxElement[] => els.flatMap((e) => [e, ...flatten(e.children ?? [])]);

/**
 * Opens an app URL in Expo Go. iOS asks "Open in Expo Go?" for links sent by simctl: that
 * dialog's Open button is tapped for the user.
 */
export async function openInExpoGo(udid: string, url: string, opts: { watch?: number } = {}) {
  // Android opens exp:// links in Expo Go without asking.
  if (android.isAndroidId(udid)) {
    await android.openInExpoGo(udid, url);
    return 0;
  }
  await simctl("openurl", udid, url);
  // iOS can ask twice (once to leave the current app, once more as Expo Go starts): keep watching
  // for a few seconds after each tap (less when Expo Go is already in front).
  const watch = opts.watch ?? 10;
  let taps = 0;
  for (let quiet = 0; quiet < watch; quiet++) {
    await new Promise((r) => setTimeout(r, 400));
    const all = flatten(await accessibilityInfo(udid).catch(() => []));
    const label = (e: AxElement) => (e.AXLabel ?? "").trim();
    // Expo Go's one-time "This is the developer menu" sheet goes too (its Continue button).
    const devMenu = all.some((e) => /developer menu/i.test(label(e)));
    const b = all.find((e) => e.type === "Button" && e.frame && (/^(Open|Ouvrir|Öffnen|Abrir|Apri|Openen|開く|打开|열기)$/i.test(label(e)) || (devMenu && /^Continue$/i.test(label(e)))))?.frame;
    if (b) {
      await sendInput(udid, { tap: { x: b.x + b.width / 2, y: b.y + b.height / 2 } });
      taps++;
      quiet = 0;
    }
  }
  return taps;
}

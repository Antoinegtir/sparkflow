import { execFile, execFileSync, spawn } from "node:child_process";
import { createWriteStream, existsSync, type WriteStream } from "node:fs";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { childEnv, LineBuffer, templateDir } from "../sandbox/util";
import { accessibilityInfo, type AxElement } from "./idb";
import { isMac } from "./platform";
import * as android from "./android";
import { sendInput, simctl } from "./simulator";
import { appScheme, devClientLink, metroUrlFor, pageLink, SLUG, templateHash, type DevPlatform } from "./dev-client-links";

export { splitExpUrl } from "./dev-client-links";

/**
 * "Sparkflow Dev": one development client (expo-dev-client + every native module of the template),
 * built on this machine once per template native setup, that loads each generated app's JS from its
 * own Metro. It replaces Expo Go, which lacks the template's native modules (liquid glass, native tabs).
 */
const run = promisify(execFile);
export const BUNDLE = "dev.sparkflow.app";
const CACHE = path.join(os.homedir(), ".sparkflow", "cache", "dev-client");
/** Free disk a build needs (Pods + DerivedData peak around 8 GB). */
const MIN_FREE_GB = 10;

export type DevClientStatus = {
  state: "idle" | "building" | "ready" | "error";
  platform: DevPlatform | null;
  step: string;
  percent?: number;
  error?: string;
  log: string;
};

// ---- Build ----

const g = globalThis as unknown as {
  __sparkflowDevClient?: { status: DevClientStatus; buffer: LineBuffer; job: Promise<string> | null; jobPlatform: DevPlatform | null };
};
function store() {
  return (g.__sparkflowDevClient ??= { status: { state: "idle", platform: null, step: "", log: "" }, buffer: new LineBuffer(400), job: null, jobPlatform: null });
}

const artifact = (hash: string, platform: DevPlatform) => path.join(CACHE, hash, platform === "ios" ? "SparkflowDev.app" : "SparkflowDev.apk");
const built = (hash: string, platform: DevPlatform) => existsSync(platform === "ios" ? path.join(artifact(hash, platform), "Info.plist") : artifact(hash, platform));

export function devClientStatus(): DevClientStatus {
  const s = store();
  return { ...s.status, log: s.buffer.tail(40) };
}

/** Whether the dev client for this platform is already built (no ~5 min wait ahead). */
export async function devClientBuilt(platform: DevPlatform) {
  return built(await templateHash(), platform);
}

/**
 * Builds Sparkflow Dev for a platform if this template's build isn't cached yet; returns the .app / .apk.
 * One build at a time: a call during a build waits for it.
 */
export async function ensureDevClient(platform: DevPlatform): Promise<string> {
  const s = store();
  let hash = "";
  // Checked again after hashing: another call may have started a build during that await.
  while (s.job || !(hash = await templateHash()) || s.job) {
    if (!s.job) continue;
    const same = s.jobPlatform === platform;
    const r = await s.job.catch(() => null);
    if (same && r) return r;
  }
  if (built(hash, platform)) return artifact(hash, platform);
  s.jobPlatform = platform;
  s.job = build(hash, platform);
  try {
    return await s.job;
  } finally {
    s.job = null;
    s.jobPlatform = null;
  }
}

async function build(hash: string, platform: DevPlatform) {
  const s = store();
  const root = path.join(CACHE, hash);
  const src = path.join(root, "src");
  await mkdir(root, { recursive: true });
  const logFile = createWriteStream(path.join(root, `build-${platform}.log`), { flags: "w" });
  s.buffer = new LineBuffer(400);
  const step = (name: string, percent: number) => {
    s.status = { state: "building", platform, step: name, percent, log: "" };
    s.buffer.push(`\n▸ ${name}\n`);
    logFile.write(`\n▸ ${name}\n`);
  };
  try {
    step("Checking disk space", 1);
    await checkDisk();
    // No Android SDK: fail now with a clear message rather than deep in Gradle.
    if (platform === "android") androidEnv();
    step("Copying the template", 3);
    await rm(src, { recursive: true, force: true });
    await copyTemplate(src);
    const appJson = path.join(src, "app.json");
    const app = JSON.parse(await readFile(appJson, "utf8"));
    app.expo.name = "Sparkflow Dev";
    app.expo.slug = SLUG;
    await writeFile(appJson, JSON.stringify(app, null, 2));
    const out = artifact(hash, platform);
    if (platform === "ios") {
      step("Generating the iOS project", 8);
      await sh(src, "npx expo prebuild -p ios --clean --no-install", logFile, { CI: "1" });
      step("Installing CocoaPods", 15);
      await sh(path.join(src, "ios"), "pod install", logFile, { LANG: "en_US.UTF-8", LC_ALL: "en_US.UTF-8" });
      step("Compiling the app (about 6 minutes)", 30);
      const ws = (await readdir(path.join(src, "ios"))).find((f) => f.endsWith(".xcworkspace"));
      if (!ws) throw new Error("No Xcode workspace after prebuild");
      const scheme = ws.replace(/\.xcworkspace$/, "");
      const dd = path.join(root, "DerivedData");
      await sh(
        src,
        `xcodebuild -workspace ios/${q(ws)} -scheme ${q(scheme)} -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath ${q(dd)} ONLY_ACTIVE_ARCH=YES COMPILER_INDEX_STORE_ENABLE=NO build -quiet`,
        logFile,
        {},
        { from: 30, to: 95, seconds: 330 },
      );
      const products = path.join(dd, "Build", "Products", "Debug-iphonesimulator");
      const app = (await readdir(products)).find((f) => f.endsWith(".app"));
      if (!app) throw new Error("xcodebuild produced no .app");
      step("Saving the app", 96);
      await rm(out, { recursive: true, force: true });
      await cp(path.join(products, app), out, { recursive: true, verbatimSymlinks: true });
      await rm(dd, { recursive: true, force: true });
    } else {
      step("Generating the Android project", 8);
      await sh(src, "npx expo prebuild -p android --clean --no-install", logFile, { CI: "1" });
      step("Compiling the app (about 15 minutes)", 15);
      // Only the emulator's ABI: building all four takes several times longer.
      const abi = process.arch === "arm64" ? "arm64-v8a" : "x86_64";
      await sh(path.join(src, "android"), `./gradlew assembleDebug -PreactNativeArchitectures=${abi} --console=plain`, logFile, androidEnv(), { from: 15, to: 95, seconds: 900 });
      step("Saving the app", 96);
      await cp(path.join(src, "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk"), out);
    }
    s.status = { state: "ready", platform, step: "Ready", percent: 100, log: "" };
    // Builds for older template setups are never used again (~400 MB each).
    for (const d of await readdir(CACHE).catch(() => [] as string[])) {
      if (d !== hash && /^[0-9a-f]{16}$/.test(d)) await rm(path.join(CACHE, d), { recursive: true, force: true }).catch(() => {});
    }
    return out;
  } catch (e) {
    const message = String((e as Error)?.message ?? e);
    s.status = { state: "error", platform, step: s.status.step, error: message.slice(-2000), log: "" };
    throw e;
  } finally {
    // Gradle leaves a daemon (~1 GB of RAM) running after a build, failed ones included.
    if (platform === "android" && existsSync(path.join(src, "android", "gradlew"))) await Promise.resolve().then(() => sh(path.join(src, "android"), "./gradlew --stop", logFile, androidEnv())).catch(() => {});
    // Pods, the native projects and node_modules are only needed for the build: free the disk.
    await rm(src, { recursive: true, force: true }).catch(() => {});
    await rm(path.join(root, "DerivedData"), { recursive: true, force: true }).catch(() => {});
    logFile.end();
  }
}

const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

/**
 * A Java for Gradle: JAVA_HOME, else the one Android Studio ships with, else the system's. macOS has
 * none of its own, and a shell profile that sets JAVA_HOME isn't always what started the server.
 */
function javaHome() {
  const studio = (root: string) => path.join(root, "Android Studio.app", "Contents", "jbr", "Contents", "Home");
  const found = [process.env.JAVA_HOME, studio("/Applications"), studio(path.join(os.homedir(), "Applications")), "/opt/android-studio/jbr", path.join(os.homedir(), "android-studio", "jbr")].find(
    (d) => d && existsSync(path.join(d, "bin", "java")),
  );
  if (found) return found;
  try {
    return execFileSync("/usr/libexec/java_home", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || undefined;
  } catch {
    return undefined;
  }
}

/** The Android SDK and a Java for Gradle; throws before anything is built when one is missing. */
function androidEnv(): Record<string, string> {
  const sdk = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, path.join(os.homedir(), "Library", "Android", "sdk")].find((d) => d && existsSync(d));
  if (!sdk) throw new Error("Android SDK not found: install Android Studio (SDK in ~/Library/Android/sdk) or set ANDROID_HOME");
  const java = javaHome();
  if (!java) throw new Error("Java not found: Android builds need a JDK 17 or newer. Install Android Studio (it ships one) or set JAVA_HOME");
  return { ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk, JAVA_HOME: java };
}

async function checkDisk() {
  const { stdout } = await run("df", ["-k", existsSync("/System/Volumes/Data") ? "/System/Volumes/Data" : os.homedir()]);
  const kb = Number(stdout.trim().split("\n").pop()?.split(/\s+/)[3]);
  if (kb && kb / 1024 / 1024 < MIN_FREE_GB) throw new Error(`Building Sparkflow Dev needs ${MIN_FREE_GB} GB free on disk (${(kb / 1024 / 1024).toFixed(1)} GB left)`);
}

/** The template with its node_modules, cloned (APFS copy-on-write) when the disk allows it. */
async function copyTemplate(dest: string) {
  const from = templateDir();
  if (!existsSync(path.join(from, "node_modules", "expo"))) throw new Error("The template's node_modules are not installed yet");
  await mkdir(path.dirname(dest), { recursive: true });
  // isMac(), read at run time: the build would inline process.platform (releases are built on Linux).
  const cmd = isMac() ? `cp -cR ${q(from)} ${q(dest)} || cp -R ${q(from)} ${q(dest)}` : `cp -R --reflink=auto ${q(from)} ${q(dest)}`;
  await run("bash", ["-c", cmd], { maxBuffer: 16 * 1024 * 1024 });
  for (const d of ["ios", "android", ".expo", "dist"]) await rm(path.join(dest, d), { recursive: true, force: true });
}

/** Runs a build command, its output into the log; `progress` moves the percent along with time. */
function sh(cwd: string, command: string, logFile: WriteStream, env: Record<string, string> = {}, progress?: { from: number; to: number; seconds: number }) {
  const s = store();
  return new Promise<void>((resolve, reject) => {
    const child = spawn("bash", ["-c", command], {
      cwd,
      env: childEnv({ PATH: `${path.join(cwd, "node_modules", ".bin")}:${process.env.PATH}`, EXPO_NO_TELEMETRY: "1", ...env }),
    });
    const onData = (d: Buffer) => {
      s.buffer.push(String(d));
      logFile.write(d);
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    const started = Date.now();
    const timer = progress
      ? setInterval(() => {
          const t = Math.min(1, (Date.now() - started) / 1000 / progress.seconds);
          if (s.status.state === "building") s.status.percent = Math.round(progress.from + (progress.to - progress.from) * t);
        }, 2000)
      : null;
    child.on("error", (e) => {
      if (timer) clearInterval(timer);
      reject(e);
    });
    child.on("close", (code) => {
      if (timer) clearInterval(timer);
      if (code === 0) resolve();
      else reject(new Error(`${command.split(" ").slice(0, 3).join(" ")} failed (exit ${code}):\n${s.buffer.tail(25)}`));
    });
  });
}

// ---- Install and open ----

const installedFile = path.join(CACHE, "installed.json");
async function installedHashes(): Promise<Record<string, string>> {
  return JSON.parse(await readFile(installedFile, "utf8").catch(() => "{}"));
}

async function isInstalled(device: string) {
  // `pm path` prints only for an installed package (dumpsys still lists one just uninstalled).
  if (android.isAndroidId(device)) return /^package:/m.test((await android.adb(device, "shell", "pm", "path", BUNDLE).catch(() => Buffer.from(""))).toString("utf8"));
  return !!(await simctl("get_app_container", device, BUNDLE).catch(() => "")).trim();
}

/**
 * Builds (the first time) and installs Sparkflow Dev on a Simulator or emulator; skipped when this
 * template's build is already there. Returns the template hash installed.
 */
export async function installDevClient(device: string) {
  const platform: DevPlatform = android.isAndroidId(device) ? "android" : "ios";
  // An emulator just started (switched to from the device menu) can't install anything yet.
  if (platform === "android") await android.waitReady(device);
  const file = await ensureDevClient(platform);
  const hash = await templateHash();
  const record = await installedHashes();
  if (record[device] === hash && (await isInstalled(device))) return hash;
  // -g grants the runtime permissions up front: no "nearby devices" prompt over the first launch.
  if (platform === "android") {
    await android.adb(device, "install", "-r", "-g", file);
    // Same as the iOS defaults below, written before the first launch (a debug build allows run-as).
    const prefs = `<map><boolean name="showsAtLaunch" value="false" /><boolean name="isOnboardingFinished" value="true" /><boolean name="showFab" value="false" /></map>`;
    await android
      .adb(device, "shell", `run-as ${BUNDLE} sh -c 'mkdir -p shared_prefs && echo "${prefs.replace(/"/g, '\\"')}" > shared_prefs/expo.modules.devmenu.sharedpreferences.xml'`)
      .catch(() => {});
  } else {
    await simctl("install", device, file);
    // The app opens straight away and alone on screen: no developer menu at launch, no one-time menu
    // walkthrough, no floating dev tools button over it (expo-dev-menu reads these when it starts).
    for (const [key, value] of [["EXDevMenuShowsAtLaunch", "NO"], ["EXDevMenuIsOnboardingFinished", "YES"], ["EXDevMenuShowFloatingActionButton", "NO"]]) {
      await simctl("spawn", device, "defaults", "write", BUNDLE, key, "-bool", value).catch(() => {});
    }
  }
  record[device] = hash;
  await mkdir(CACHE, { recursive: true });
  await writeFile(installedFile, JSON.stringify(record, null, 2));
  return hash;
}

const flatten = (els: AxElement[]): AxElement[] => els.flatMap((e) => [e, ...flatten(e.children ?? [])]);

/** Taps the "Open in Sparkflow Dev?" dialog iOS shows for links sent by simctl, and the dev menu sheet. */
async function tapDialogs(udid: string, watch: number) {
  let taps = 0;
  for (let quiet = 0; quiet < watch; quiet++) {
    await new Promise((r) => setTimeout(r, 400));
    const all = flatten(await accessibilityInfo(udid).catch(() => []));
    const label = (e: AxElement) => (e.AXLabel ?? "").trim();
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

/**
 * simctl openurl waits until the link is handled, which the "Open in Sparkflow Dev?" dialog holds up:
 * the dialog is tapped while it waits, and a time-out after that (the app still opened) isn't an error.
 */
async function openUrl(device: string, url: string, watch: number) {
  const opening = simctl("openurl", device, url).then(
    () => null,
    (e: Error) => e,
  );
  const taps = await tapDialogs(device, watch);
  const err = await opening;
  if (err && !/timed out|code=60/i.test(err.message)) throw err;
  return taps;
}

async function isRunning(device: string) {
  if (android.isAndroidId(device)) return !!(await android.adb(device, "shell", "pidof", BUNDLE).catch(() => Buffer.from(""))).toString("utf8").trim();
  return (await simctl("spawn", device, "launchctl", "list").catch(() => "")).includes(`UIKitApplication:${BUNDLE}`);
}

/** The Metro each device last loaded: a page change on the same app only sends the page link. */
const loaded = ((globalThis as unknown as { __sparkflowDevLoaded?: Map<string, string> }).__sparkflowDevLoaded ??= new Map());

/**
 * Opens an app in Sparkflow Dev at `appPath`: loads its Metro (`url`, an exp:// or http:// link) when the
 * app isn't already running from it, then opens the page through the app's scheme. expo-dev-launcher keeps
 * a link that arrives while the bundle loads and hands it to the app once started.
 */
export async function openInDevClient(device: string, url: string, appPath = "/", opts: { watch?: number } = {}) {
  const platform: DevPlatform = android.isAndroidId(device) ? "android" : "ios";
  const metro = metroUrlFor(platform, url);
  const fresh = loaded.get(device) !== metro || !(await isRunning(device));
  // The home page needs a link too on Android when the app is already up on another page (iOS gets
  // there by its tab, see HeroFocus).
  const page = appPath !== "/" || (platform === "android" && !fresh) ? pageLink(await appScheme(), appPath) : null;
  const watch = opts.watch ?? 10;
  if (platform === "android") {
    if (fresh) {
      await android.adb(device, "shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", `'${devClientLink(metro)}'`, BUNDLE);
      // A page link sent while the bundle still loads is dropped: give the app time to mount first.
      if (page) await new Promise((r) => setTimeout(r, watch * 1000));
    }
    if (page) await android.adb(device, "shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", `'${page.replace(/'/g, "")}'`, BUNDLE);
    loaded.set(device, metro);
    return 0;
  }
  let taps = 0;
  if (fresh) taps += await openUrl(device, devClientLink(metro), watch);
  if (page) taps += await openUrl(device, page, fresh ? watch : Math.min(watch, 3));
  loaded.set(device, metro);
  return taps;
}

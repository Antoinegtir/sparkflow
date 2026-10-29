import { execFile, spawn } from "node:child_process";
import { createWriteStream, existsSync, type WriteStream } from "node:fs";
import { chmod, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { childEnv, LineBuffer } from "@/lib/sandbox/util";
import { isMac } from "./platform";
import * as android from "./android";

/**
 * An app made with Sparkflow, built for real: a Release build with its own name, icon and bundle ID,
 * installed on the Simulator or emulator next to Sparkflow Dev; or archived and uploaded by fastlane
 * to TestFlight / Google Play's internal track. Builds run in a copy of the project
 * (~/.sparkflow/cache/release/<id>): the app's folder gets no ios/ or android/ and its Metro keeps going.
 */
const run = promisify(execFile);
const ROOT = path.join(os.homedir(), ".sparkflow", "cache", "release");
const CREDENTIALS = path.join(os.homedir(), ".sparkflow", "release.json");

export type ReleasePlatform = "ios" | "android";
export type ReleaseAction = "build" | "deploy";
export type ReleaseTarget = { id: string; dir: string; name: string; bundleId: string; androidPackage: string; version: string };
export type ReleaseJob = {
  action: ReleaseAction;
  platform: ReleasePlatform;
  state: "running" | "done" | "error";
  step: string;
  started: number;
  ended?: number;
  error?: string;
  log: string;
};

/** What fastlane needs, kept on this computer only (~/.sparkflow/release.json, readable by you alone). */
export type ReleaseCredentials = {
  apple?: { keyId?: string; issuerId?: string; keyPath?: string; teamId?: string };
  google?: { jsonKeyPath?: string; keystorePath?: string; keyAlias?: string; storePassword?: string; keyPassword?: string };
};

// ---- Jobs: one per app at a time ----

type Entry = { job: ReleaseJob; buffer: LineBuffer; running?: Promise<void> };
const g = globalThis as unknown as { __sparkflowRelease?: Map<string, Entry> };
const jobs = (g.__sparkflowRelease ??= new Map());

export function releaseJob(id: string): ReleaseJob | null {
  const e = jobs.get(id);
  return e ? { ...e.job, log: e.buffer.tail(60) } : null;
}

export async function startRelease(target: ReleaseTarget, action: ReleaseAction, platform: ReleasePlatform, device?: string) {
  if (action === "deploy") {
    const r = (await storeReadiness())[platform];
    if (!r.ready) throw new NotReadyError(platform, r.missing);
  }
  const cur = jobs.get(target.id);
  if (cur?.job.state === "running") throw new Error(`A ${cur.job.action} for ${cur.job.platform === "ios" ? "iOS" : "Android"} is already running`);
  const e: Entry = { job: { action, platform, state: "running", step: "Starting", started: Date.now(), log: "" }, buffer: new LineBuffer(600) };
  jobs.set(target.id, e);
  e.running = (async () => {
    const work = path.join(ROOT, target.id);
    await mkdir(work, { recursive: true });
    const logFile = createWriteStream(path.join(work, `${action}-${platform}.log`), { flags: "w" });
    const step = (name: string) => {
      e.job.step = name;
      e.buffer.push(`\n▸ ${name}\n`);
      logFile.write(`\n▸ ${name}\n`);
    };
    const sh = (cwd: string, command: string, env: Record<string, string> = {}) => shell(cwd, command, e.buffer, logFile, env);
    try {
      if (platform === "android") androidEnv();
      if (platform === "ios" && !isMac()) throw new Error("iOS builds need a Mac with Xcode");
      step("Copying the project");
      const src = await copyProject(target, work);
      step("Setting its name, bundle ID and link scheme");
      await ownIdentity(src, target);
      if (action === "build") await build(target, platform, src, step, sh, device);
      else await deploy(target, platform, src, step, sh);
      e.job.state = "done";
      e.job.step = action === "build" ? "Installed and opened" : platform === "ios" ? "Uploaded to TestFlight" : "Uploaded to Google Play (internal testing)";
    } catch (err) {
      e.job.state = "error";
      e.job.error = String((err as Error)?.message ?? err).slice(0, 4000);
      e.buffer.push(`\n✗ ${e.job.error}\n`);
    } finally {
      e.job.ended = Date.now();
      logFile.end();
    }
  })();
  return releaseJob(target.id)!;
}

type Sh = (cwd: string, command: string, env?: Record<string, string>) => Promise<void>;

async function build(target: ReleaseTarget, platform: ReleasePlatform, src: string, step: (s: string) => void, sh: Sh, device?: string) {
  if (platform === "ios") {
    step("Generating the iOS project (CocoaPods)");
    await sh(src, "npx expo prebuild -p ios --clean", { CI: "1" });
    const ws = await only(path.join(src, "ios"), ".xcworkspace");
    const scheme = ws.replace(/\.xcworkspace$/, "");
    step("Compiling with Xcode (Release, a few minutes)");
    const dd = path.join(src, "build");
    await sh(src, `xcodebuild -workspace ios/${q(ws)} -scheme ${q(scheme)} -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath ${q(dd)} COMPILER_INDEX_STORE_ENABLE=NO build -quiet`);
    const products = path.join(dd, "Build", "Products", "Release-iphonesimulator");
    const app = path.join(products, await only(products, ".app"));
    const udid = device && !android.isAndroidId(device) ? device : await bootedSimulator();
    if (!udid) throw new Error("No booted iOS Simulator: boot one from the device menu, then build again");
    step("Installing on the Simulator");
    await run("xcrun", ["simctl", "install", udid, app]);
    await run("xcrun", ["simctl", "launch", udid, target.bundleId]);
    return;
  }
  const serial = device && android.isAndroidId(device) ? device : (await android.bootedEmulators())[0]?.udid;
  if (!serial) throw new Error("No Android emulator running: boot one from the device menu, then build again");
  // Only the emulator's CPU: the native code of all four takes several times longer.
  const abi = (await android.adb(serial, "shell", "getprop", "ro.product.cpu.abi")).toString("utf8").trim() || "arm64-v8a";
  step("Generating the Android project");
  await sh(src, "npx expo prebuild -p android --clean --no-install", { CI: "1" });
  step("Compiling with Gradle (Release, a few minutes)");
  // Release signed with the debug key (installable on an emulator, not for the stores).
  await sh(path.join(src, "android"), `./gradlew assembleRelease -PreactNativeArchitectures=${abi} --console=plain`, androidEnv());
  const apk = path.join(src, "android", "app", "build", "outputs", "apk", "release", "app-release.apk");
  step("Installing on the emulator");
  await android.waitReady(serial);
  await android.adb(serial, "install", "-r", apk);
  await android.adb(serial, "shell", "monkey", "-p", target.androidPackage, "-c", "android.intent.category.LAUNCHER", "1");
}

async function deploy(target: ReleaseTarget, platform: ReleasePlatform, src: string, step: (s: string) => void, sh: Sh) {
  // storeReadiness() checked everything before the job started.
  const c = await readCredentials();
  const fastlane = (await which("fastlane"))!;
  if (platform === "ios") {
    const a = c.apple as Required<NonNullable<ReleaseCredentials["apple"]>>;
    step("Generating the iOS project (CocoaPods)");
    await sh(src, "npx expo prebuild -p ios --clean", { CI: "1" });
    await writeFastlane(src, target);
    step("Archiving, signing and uploading to TestFlight (fastlane)");
    await sh(src, `${q(fastlane)} ios release`, {
      SPARKFLOW_ASC_KEY_ID: a.keyId,
      SPARKFLOW_ASC_ISSUER_ID: a.issuerId,
      SPARKFLOW_ASC_KEY_PATH: a.keyPath,
      SPARKFLOW_TEAM_ID: a.teamId,
      SPARKFLOW_BUNDLE_ID: target.bundleId,
      FASTLANE_SKIP_UPDATE_CHECK: "1",
      FASTLANE_HIDE_CHANGELOG: "1",
    });
    return;
  }
  const gl = c.google as Required<NonNullable<ReleaseCredentials["google"]>>;
  step("Generating the Android project");
  await sh(src, "npx expo prebuild -p android --clean --no-install", { CI: "1" });
  await writeFastlane(src, target);
  step("Building the signed bundle and uploading to Google Play (fastlane)");
  await sh(src, `${q(fastlane)} android release`, {
    ...androidEnv(),
    SPARKFLOW_PLAY_JSON_KEY: gl.jsonKeyPath,
    SPARKFLOW_KEYSTORE: gl.keystorePath,
    SPARKFLOW_KEY_ALIAS: gl.keyAlias,
    SPARKFLOW_STORE_PASSWORD: gl.storePassword,
    SPARKFLOW_KEY_PASSWORD: gl.keyPassword || gl.storePassword,
    SPARKFLOW_PACKAGE: target.androidPackage,
    FASTLANE_SKIP_UPDATE_CHECK: "1",
    FASTLANE_HIDE_CHANGELOG: "1",
  });
}

/**
 * The pipeline, written into the build copy: credentials come from the environment, never from the file.
 * iOS: next build number after TestFlight's latest, archive with automatic signing through the API key, upload.
 * Android: next version code after Play's highest, signed .aab, upload to the internal testing track.
 */
async function writeFastlane(src: string, target: ReleaseTarget) {
  const dir = path.join(src, "fastlane");
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "Fastfile"),
    `# Written by Sparkflow for ${target.name}. Credentials come from the environment (~/.sparkflow/release.json).
default_platform(:ios)

platform :ios do
  lane :release do
    api_key = app_store_connect_api_key(
      key_id: ENV["SPARKFLOW_ASC_KEY_ID"],
      issuer_id: ENV["SPARKFLOW_ASC_ISSUER_ID"],
      key_filepath: ENV["SPARKFLOW_ASC_KEY_PATH"],
    )
    workspace = Dir["../ios/*.xcworkspace"].first
    project = Dir["../ios/*.xcodeproj"].first
    scheme = File.basename(workspace, ".xcworkspace")
    latest = latest_testflight_build_number(api_key: api_key, app_identifier: ENV["SPARKFLOW_BUNDLE_ID"], initial_build_number: 0)
    increment_build_number(xcodeproj: project, build_number: latest + 1)
    build_app(
      workspace: workspace,
      scheme: scheme,
      configuration: "Release",
      export_method: "app-store",
      output_directory: "../build",
      xcargs: "-allowProvisioningUpdates -authenticationKeyPath #{ENV['SPARKFLOW_ASC_KEY_PATH']} -authenticationKeyID #{ENV['SPARKFLOW_ASC_KEY_ID']} -authenticationKeyIssuerID #{ENV['SPARKFLOW_ASC_ISSUER_ID']} DEVELOPMENT_TEAM=#{ENV['SPARKFLOW_TEAM_ID']} CODE_SIGN_STYLE=Automatic",
    )
    upload_to_testflight(api_key: api_key, skip_waiting_for_build_processing: true)
  end
end

platform :android do
  lane :release do
    codes = %w[internal alpha beta production].flat_map do |track|
      google_play_track_version_codes(track: track, package_name: ENV["SPARKFLOW_PACKAGE"], json_key: ENV["SPARKFLOW_PLAY_JSON_KEY"]) rescue []
    end
    next_code = (codes.map(&:to_i).max || 0) + 1
    gradle_file = "../android/app/build.gradle"
    File.write(gradle_file, File.read(gradle_file).sub(/versionCode \\d+/, "versionCode #{next_code}"))
    gradle(
      task: "bundle",
      build_type: "Release",
      project_dir: "android",
      properties: {
        "android.injected.signing.store.file" => ENV["SPARKFLOW_KEYSTORE"],
        "android.injected.signing.store.password" => ENV["SPARKFLOW_STORE_PASSWORD"],
        "android.injected.signing.key.alias" => ENV["SPARKFLOW_KEY_ALIAS"],
        "android.injected.signing.key.password" => ENV["SPARKFLOW_KEY_PASSWORD"],
      },
    )
    upload_to_play_store(
      package_name: ENV["SPARKFLOW_PACKAGE"],
      json_key: ENV["SPARKFLOW_PLAY_JSON_KEY"],
      track: "internal",
      release_status: "draft",
      aab: lane_context[SharedValues::GRADLE_AAB_OUTPUT_PATH],
      skip_upload_metadata: true,
      skip_upload_images: true,
      skip_upload_screenshots: true,
    )
  end
end
`,
  );
}

// ---- The build copy ----

/** The project cloned (APFS copy-on-write, node_modules included), without ios/, android/ or caches. */
async function copyProject(target: ReleaseTarget, work: string) {
  const src = path.join(work, "src");
  await rm(src, { recursive: true, force: true });
  const cmd = isMac() ? `cp -cR ${q(target.dir)} ${q(src)} || cp -R ${q(target.dir)} ${q(src)}` : `cp -R --reflink=auto ${q(target.dir)} ${q(src)}`;
  await run("bash", ["-c", cmd], { maxBuffer: 16 * 1024 * 1024 });
  for (const d of ["ios", "android", ".expo", "dist", "build", ".git"]) await rm(path.join(src, d), { recursive: true, force: true });
  return src;
}

/**
 * The app as itself, not Sparkflow Dev: its bundle ID and package (dev.sparkflow.app is Sparkflow Dev's,
 * which this would replace), and a link scheme of its own (sparkflow:// would open either app).
 */
async function ownIdentity(src: string, target: ReleaseTarget) {
  const file = path.join(src, "app.json");
  const app = JSON.parse(await readFile(file, "utf8"));
  const expo = (app.expo ??= {});
  expo.name = target.name;
  expo.version = target.version;
  expo.ios = { ...expo.ios, bundleIdentifier: target.bundleId };
  expo.android = { ...expo.android, package: target.androidPackage };
  const scheme = target.bundleId.split(".").pop()!.replace(/[^a-z0-9]/gi, "").toLowerCase() || "app";
  if (!expo.scheme || expo.scheme === "sparkflow") expo.scheme = scheme;
  // A Release build has no dev menu: expo-dev-client only belongs in Sparkflow Dev.
  expo.plugins = (expo.plugins ?? []).filter((p: unknown) => (Array.isArray(p) ? p[0] : p) !== "expo-dev-client");
  await writeFile(file, JSON.stringify(app, null, 2));
}

// ---- Credentials ----

export async function readCredentials(): Promise<ReleaseCredentials> {
  return JSON.parse(await readFile(CREDENTIALS, "utf8").catch(() => "{}"));
}

/** Saved for this computer only (mode 600); empty fields are left as they were, blank strings clear them. */
export async function saveCredentials(patch: ReleaseCredentials) {
  const cur = await readCredentials();
  const merge = <T extends Record<string, string | undefined>>(a: T | undefined, b: T | undefined) => {
    const out: Record<string, string> = { ...(a as Record<string, string>) };
    for (const [k, v] of Object.entries(b ?? {})) {
      if (v === undefined) continue;
      if (v === "") delete out[k];
      else out[k] = v.replace(/^~(?=\/)/, os.homedir());
    }
    return out as T;
  };
  const next: ReleaseCredentials = { apple: merge(cur.apple, patch.apple), google: merge(cur.google, patch.google) };
  await mkdir(path.dirname(CREDENTIALS), { recursive: true });
  await writeFile(CREDENTIALS, JSON.stringify(next, null, 2), { mode: 0o600 });
  await chmod(CREDENTIALS, 0o600);
  return maskedCredentials(next);
}

/** What the settings form shows: paths and IDs, passwords only as set or not. */
export function maskedCredentials(c: ReleaseCredentials) {
  return {
    apple: { keyId: c.apple?.keyId ?? "", issuerId: c.apple?.issuerId ?? "", keyPath: c.apple?.keyPath ?? "", teamId: c.apple?.teamId ?? "" },
    google: {
      jsonKeyPath: c.google?.jsonKeyPath ?? "",
      keystorePath: c.google?.keystorePath ?? "",
      keyAlias: c.google?.keyAlias ?? "",
      storePasswordSet: !!c.google?.storePassword,
      keyPasswordSet: !!c.google?.keyPassword,
    },
  };
}

// ---- Store readiness ----

export type StoreReadiness = { ready: boolean; missing: string[] };

/**
 * What an upload to a store still needs, said before anything starts: tools on this computer, then each
 * credential, then the files they point to.
 */
export async function storeReadiness(): Promise<Record<ReleasePlatform, StoreReadiness>> {
  const c = await readCredentials();
  const fastlane = await which("fastlane");
  const tool = fastlane ? [] : ["fastlane on this computer (brew install fastlane)"];
  const file = (p: string | undefined, what: string) => (p && !existsSync(p) ? [`${what}: no file at ${p}`] : []);
  const a = c.apple ?? {};
  const ios = [
    ...(isMac() ? [] : ["a Mac with Xcode"]),
    ...tool,
    ...(a.keyId ? [] : ["App Store Connect key ID"]),
    ...(a.issuerId ? [] : ["App Store Connect issuer ID"]),
    ...(a.keyPath ? [] : ["App Store Connect .p8 key file"]),
    ...(a.teamId ? [] : ["Apple Team ID"]),
    ...file(a.keyPath, ".p8 key"),
  ];
  const gl = c.google ?? {};
  const androidMissing = [
    ...tool,
    ...(gl.jsonKeyPath ? [] : ["Google Play service account key"]),
    ...(gl.keystorePath ? [] : ["upload keystore"]),
    ...(gl.keyAlias ? [] : ["keystore key alias"]),
    ...(gl.storePassword ? [] : ["keystore password"]),
    ...file(gl.jsonKeyPath, "Service account key"),
    ...file(gl.keystorePath, "Keystore"),
  ];
  return { ios: { ready: !ios.length, missing: ios }, android: { ready: !androidMissing.length, missing: androidMissing } };
}

/** Thrown before an upload starts when something it needs is missing: no job, no log, a clear list. */
export class NotReadyError extends Error {
  constructor(public platform: ReleasePlatform, public missing: string[]) {
    super(`${platform === "ios" ? "App Store" : "Google Play"} needs: ${missing.join(", ")}`);
  }
}

// ---- Helpers ----

const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

async function only(dir: string, ext: string) {
  const f = (await readdir(dir)).find((x) => x.endsWith(ext));
  if (!f) throw new Error(`No ${ext} in ${dir}`);
  return f;
}

async function which(bin: string) {
  const known = [`/opt/homebrew/bin/${bin}`, `/usr/local/bin/${bin}`].find((p) => existsSync(p));
  return known ?? (await run("which", [bin]).then((r) => r.stdout.trim() || null, () => null));
}

async function bootedSimulator() {
  const { stdout } = await run("xcrun", ["simctl", "list", "devices", "booted", "-j"]);
  const devices = Object.values(JSON.parse(stdout).devices as Record<string, { udid: string; state: string }[]>).flat();
  return devices.find((d) => d.state === "Booted")?.udid ?? null;
}

/** The Android SDK and a Java for Gradle (Android Studio's own when JAVA_HOME isn't set). */
function androidEnv(): Record<string, string> {
  const sdk = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, path.join(os.homedir(), "Library", "Android", "sdk")].find((d) => d && existsSync(d));
  if (!sdk) throw new Error("Android SDK not found: install Android Studio or set ANDROID_HOME");
  const java = [process.env.JAVA_HOME, "/Applications/Android Studio.app/Contents/jbr/Contents/Home", path.join(os.homedir(), "Applications/Android Studio.app/Contents/jbr/Contents/Home")].find(
    (d) => d && existsSync(path.join(d, "bin", "java")),
  );
  if (!java) throw new Error("Java not found: Android builds need a JDK 17 or newer (Android Studio ships one)");
  return { ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk, JAVA_HOME: java };
}

function shell(cwd: string, command: string, buffer: LineBuffer, logFile: WriteStream, env: Record<string, string>) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("bash", ["-c", command], {
      cwd,
      env: childEnv({ PATH: `${path.join(cwd, "node_modules", ".bin")}:/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}`, EXPO_NO_TELEMETRY: "1", LANG: "en_US.UTF-8", LC_ALL: "en_US.UTF-8", ...env }),
    });
    const onData = (d: Buffer) => {
      buffer.push(String(d));
      logFile.write(d);
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${command.split(" ").slice(0, 3).join(" ")} failed (exit ${code}):\n${buffer.tail(25)}`))));
  });
}

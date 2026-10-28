import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { templateDir } from "../sandbox/util";

/** Links and hashes for Sparkflow Dev (see dev-client.ts), free of device code so they can be unit tested. */
export const SLUG = "sparkflow-dev";
export type DevPlatform = "ios" | "android";

/** Hash of what the native build depends on: package.json, the lockfile, app.json and the config plugins. */
export async function templateHash(dir = templateDir()) {
  const h = createHash("sha256");
  for (const f of ["package.json", "package-lock.json", "app.json"]) h.update(f).update(await readFile(path.join(dir, f)).catch(() => Buffer.from("")));
  const plugins = path.join(dir, "plugins");
  for (const f of (await readdir(plugins).catch(() => [] as string[])).sort()) h.update(f).update(await readFile(path.join(plugins, f)));
  return h.digest("hex").slice(0, 16);
}

/** Splits an Expo link ("exp://host:port/--/path") into its Metro address and app path. */
export function splitExpUrl(url: string) {
  const m = /^(?:exps?|https?):\/\/([^/?#]+)(?:\/--)?(\/[^?#]*)?/.exec(url);
  if (!m) throw new Error("Invalid app URL");
  const secure = /^(exps|https):/.test(url);
  return { host: m[1], secure, path: m[2] || "/" };
}

const PRIVATE_HOST = /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;

/** The Metro URL as the device reaches it: the Android emulator sees this machine at 10.0.2.2. */
export function metroUrlFor(platform: DevPlatform, url: string) {
  const { host, secure } = splitExpUrl(url);
  const port = /:(\d+)$/.exec(host)?.[1];
  const h = platform === "android" && PRIVATE_HOST.test(host) && port ? `10.0.2.2:${port}` : host;
  return `${secure ? "https" : "http"}://${h}`;
}

/** The link that makes the dev client load an app from a Metro. */
export const devClientLink = (metroUrl: string) => `exp+${SLUG}://expo-development-client/?url=${encodeURIComponent(metroUrl)}`;

/** The template's own scheme, which the dev client registers: expo-router opens a page from "sparkflow://<path>". */
export async function appScheme() {
  const app = JSON.parse(await readFile(path.join(templateDir(), "app.json"), "utf8"));
  return String(app.expo?.scheme ?? "sparkflow");
}
export const pageLink = (scheme: string, p: string) => `${scheme}://${p.replace(/^\/+/, "")}`;

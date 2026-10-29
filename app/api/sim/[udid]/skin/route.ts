import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { avdOf, isAndroidId } from "@/lib/web/android";
import { handle, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

/** The number after `key` from position `from` on, in an emulator skin's layout file. */
const num = (text: string, from: number, key: string) => Number(text.slice(from).match(new RegExp(`\\b${key}\\s+(\\d+)`))?.[1] ?? NaN);

/**
 * An Android emulator's own device frame: the skin its AVD uses in the Android SDK (Android Studio
 * draws the same one). The images come as data URLs so the browser can keep them while sparkflow
 * isn't running. null for an iOS Simulator or an AVD without a skin.
 */
export const GET = handle(async (_req: Request, { params }: RouteCtx<{ udid: string }>) => {
  const { udid } = await params;
  if (!isAndroidId(udid)) return Response.json(null);
  const avd = await avdOf(udid);
  if (!/^[\w.-]+$/.test(avd)) return Response.json(null);
  const home = os.homedir();
  const config = await readFile(path.join(home, ".android", "avd", `${avd}.avd`, "config.ini"), "utf8").catch(() => "");
  const get = (k: string) => config.match(new RegExp(`^${k.replace(".", "\\.")}\\s*=\\s*(.+)$`, "m"))?.[1]?.trim();
  const sdk = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, path.join(home, "Library", "Android", "sdk")].find(Boolean)!;
  const skinPath = get("skin.path");
  const dir = skinPath && path.isAbsolute(skinPath) ? skinPath : get("skin.name") ? path.join(sdk, "skins", get("skin.name")!) : null;
  if (!dir) return Response.json(null);
  const layout = await readFile(path.join(dir, "layout"), "utf8").catch(() => "");
  // Portrait only: the frame image, the overlay that rounds the screen's corners, and where the screen sits.
  const back = layout.match(/portrait\s*\{[^}]*background\s*\{\s*image\s+(\S+)/)?.[1];
  const mask = layout.match(/foreground\s*\{\s*mask\s+(\S+)/)?.[1];
  const display = layout.indexOf("display");
  const portrait = layout.indexOf("portrait", layout.indexOf("layouts"));
  const device = layout.indexOf("name device", portrait);
  if (!back || display < 0 || portrait < 0 || device < 0) return Response.json(null);
  const skin = {
    name: path.basename(dir),
    width: num(layout, portrait, "width"),
    height: num(layout, portrait, "height"),
    screen: { x: num(layout, device, "x"), y: num(layout, device, "y"), width: num(layout, display, "width"), height: num(layout, display, "height") },
  };
  if ([skin.width, skin.height, ...Object.values(skin.screen)].some((n) => !Number.isFinite(n))) return Response.json(null);
  const dataUrl = async (file: string) => {
    const buf = await readFile(path.join(dir, file)).catch(() => null);
    return buf ? `data:image/${path.extname(file) === ".png" ? "png" : "webp"};base64,${buf.toString("base64")}` : null;
  };
  return Response.json({ ...skin, back: await dataUrl(back), mask: mask ? await dataUrl(mask) : null });
});

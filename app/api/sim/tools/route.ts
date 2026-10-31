import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { requireOwner } from "@/lib/share/actor";
import { isMac } from "@/lib/web/platform";
import { handle } from "@/lib/web/server";

export const dynamic = "force-dynamic";

const APPS = { xcode: "/Applications/Xcode.app", androidStudio: "/Applications/Android Studio.app" };
const sdk = () => [process.env.ANDROID_HOME, path.join(os.homedir(), "Library/Android/sdk")].some((p) => !!p && existsSync(p));

/** Which of Xcode and Android Studio this Mac has: installed but without a device, the menu says how to add one. */
export const GET = handle(async (req: Request) => {
  requireOwner(req);
  return Response.json({ xcode: isMac() && existsSync(APPS.xcode), androidStudio: existsSync(APPS.androidStudio) || sdk() });
});

/** Opens Xcode or Android Studio on this Mac (to create a first Simulator or emulator). */
export const POST = handle(async (req: Request) => {
  requireOwner(req);
  const { app } = z.object({ app: z.enum(["xcode", "androidStudio"]) }).parse(await req.json());
  if (!isMac() || !existsSync(APPS[app])) return Response.json({ error: "Not installed" }, { status: 404 });
  await new Promise<void>((res, rej) => execFile("open", [APPS[app]], (e) => (e ? rej(e) : res())));
  return Response.json({ ok: true });
});

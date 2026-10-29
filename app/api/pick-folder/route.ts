import { execFile } from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";
import { isMac } from "@/lib/web/platform";
import { handle } from "@/lib/web/server";

export const dynamic = "force-dynamic";
const run = promisify(execFile);

/**
 * Opens this computer's folder picker (Finder on macOS, zenity on Linux) and returns the folder chosen:
 * a browser's own picker never gives a folder's full path. `path` is null when cancelled; `picker` is
 * false when this computer has none (the site then asks for the path).
 */
export const POST = handle(async () => {
  try {
    if (isMac()) {
      // Asked through System Events, brought to the front: the server is a background process.
      const script = ['tell application "System Events"', "activate", 'set p to POSIX path of (choose folder with prompt "Choose your React Native project" default location (path to home folder))', "end tell", "return p"];
      const { stdout } = await run("osascript", script.flatMap((l) => ["-e", l]), { timeout: 10 * 60 * 1000 });
      return Response.json({ picker: true, path: stdout.trim().replace(/\/$/, "") || null });
    }
    const { stdout } = await run("zenity", ["--file-selection", "--directory", "--title=Choose your React Native project", `--filename=${os.homedir()}/`], { timeout: 10 * 60 * 1000 });
    return Response.json({ picker: true, path: stdout.trim() || null });
  } catch (err) {
    const e = err as { code?: number | string; stderr?: string };
    // Cancelled: osascript says "User canceled" (-128), zenity exits with 1.
    if (/-128|User cancel/i.test(e.stderr ?? "") || e.code === 1) return Response.json({ picker: true, path: null });
    if (e.code === "ENOENT") return Response.json({ picker: false, path: null });
    throw err;
  }
});

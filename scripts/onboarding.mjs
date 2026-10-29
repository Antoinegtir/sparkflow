// First-run onboarding of `sparkflow`: asks for the Muse Spark API key and keeps it in the local
// .env (the installed version links it to ~/.sparkflow/.env), readable by this user only. The key
// never goes to the hosted site: the server on this computer calls the Meta Model API itself.
// Then asks where the apps live (SPARKFLOW_DATA_DIR in the same .env).
import { accessSync, chmodSync, constants, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";

const ENV = ".env";
const tty = process.stdin.isTTY && process.stdout.isTTY;
const c = (code) => (s) => `\x1b[${code}m${s}\x1b[0m`;
const dim = c("2"), bold = c("1"), green = c("32"), red = c("31"), blue = c("38;5;75");

const readEnv = () => (existsSync(ENV) ? readFileSync(ENV, "utf8") : "");
const get = (text, key) => text.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1]?.trim() ?? "";

/** Sets KEY=value in .env, keeping every other line (and the symlink to ~/.sparkflow/.env). */
function set(key, value) {
  let text = readEnv();
  const line = `${key}=${value}`;
  text = new RegExp(`^#?\\s*${key}=.*$`, "m").test(text) ? text.replace(new RegExp(`^#?\\s*${key}=.*$`, "m"), line) : `${text.replace(/\n?$/, "\n")}${line}\n`;
  writeFileSync(ENV, text);
  chmodSync(realpathSync(ENV), 0o600);
}

/** Reads a line without echoing it: one dot per character. */
function askSecret(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    let value = "";
    const onData = (buf) => {
      // Pasting wraps the text in bracketed-paste markers (ESC[200~ … ESC[201~): not part of the key.
      const text = buf.toString("utf8").replace(/\x1b\[20[01]~/g, "").replace(/\x1b\[[0-9;]*[A-Za-z~]/g, "");
      for (const ch of text) {
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          return resolve(value.trim());
        }
        if (ch === "\u0003" || ch === "\u0004") {
          // Ctrl+C / Ctrl+D: leave without saving anything.
          stdin.setRawMode(false);
          process.stdout.write(`\n  ${dim("Cancelled, nothing saved.")}\n`);
          process.exit(130);
        }
        if (ch === "\u007f") {
          if (value) {
            value = value.slice(0, -1);
            process.stdout.write("\b \b");
          }
        } else if (ch >= " ") {
          value += ch;
          process.stdout.write(dim("•"));
        }
      }
    };
    stdin.on("data", onData);
  });
}

/** Asks the Meta Model API whether the key works (lists the models). null: couldn't tell (offline). */
async function check(key) {
  const base = get(readEnv(), "MUSE_BASE_URL") || "https://api.meta.ai/v1";
  try {
    const res = await fetch(`${base}/models`, { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000) });
    if (res.status === 401 || res.status === 403) return false;
    return res.ok ? true : null;
  } catch {
    return null;
  }
}

/**
 * Runs before the status screen. Asks for the key only when there is none yet and the user hasn't
 * chosen demo mode, or always with `key` (`sparkflow key`); for the apps folder the first time, or
 * always with `folder` (`sparkflow folder`).
 */
export async function onboarding({ key = false, folder = false } = {}) {
  if (!existsSync(ENV) && existsSync(".env.example")) writeFileSync(ENV, readFileSync(".env.example", "utf8"));
  const text = readEnv();
  const needKey = key || (!folder && !get(text, "MODEL_API_KEY") && get(text, "SPARKFLOW_DEMO") !== "1");
  const needFolder = folder || (!key && !get(text, "SPARKFLOW_DATA_DIR"));
  if (!tty || (!needKey && !needFolder)) return;
  console.log(`\n  ${blue("✦")} ${bold("Sparkflow")} ${dim(needKey && needFolder ? "— first setup" : "— setup")}\n`);
  if (needKey) await askKey();
  if (needFolder) await askFolder();
}

async function askKey() {
  console.log(`  Paste your ${bold("Muse Spark")} API key ${dim("(Meta Model API, dev.meta.ai)")}.`);
  console.log(`  ${dim("It stays on this computer, in")} ${dim(realpathSafe(ENV))}${dim(", readable by you only.")}`);
  console.log(`  ${dim("Sparkflow calls the Meta API from here: the key never goes to the hosted site.")}`);
  console.log(`  ${dim("Press Enter without a key for demo mode (a scripted agent).")}\n`);

  for (;;) {
    const key = await askSecret(`  ${blue("›")} API key: `);
    if (!key) {
      set("SPARKFLOW_DEMO", "1");
      console.log(`  ${dim("Demo mode. Add a key later with")} sparkflow key\n`);
      return;
    }
    process.stdout.write(`  ${dim("Checking the key…")}`);
    const ok = await check(key);
    process.stdout.write("\r\x1b[2K");
    if (ok === false) {
      console.log(`  ${red("✗")} Meta refused this key. Try again, or Enter for demo mode.`);
      continue;
    }
    set("MODEL_API_KEY", key);
    set("SPARKFLOW_DEMO", "");
    console.log(`  ${green("✓")} ${ok ? "Key works" : "Key saved (couldn't reach Meta to check it)"} ${dim(`— saved in ${realpathSafe(ENV)}`)}\n`);
    return;
  }
}

const home = homedir();
const tilde = (p) => (p === home || p.startsWith(home + path.sep) ? "~" + p.slice(home.length) : p);
const expand = (p) => path.resolve(p.replace(/^~(?=$|\/)/, home));
/** The apps folder now: what `sparkflow` exported (the .env value, else ~/.sparkflow/data). */
const currentFolder = () => process.env.SPARKFLOW_DATA_DIR || path.join(process.env.SPARKFLOW_HOME || path.join(home, ".sparkflow"), "data");

/** Tab completes folder names, like a shell. */
function completeFolder(line) {
  const full = line.replace(/^~(?=$|\/)/, home);
  const dir = full.endsWith("/") ? full : path.dirname(full || ".");
  const base = full.endsWith("/") ? "" : path.basename(full);
  let names = [];
  try {
    names = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith(".") && d.name.startsWith(base))
      .map((d) => d.name);
  } catch {}
  return [names.map((n) => line.slice(0, line.length - base.length) + n + "/"), line];
}

/**
 * Reads a line. `hint`: a suggestion shown dimmed in the empty field; Tab or → takes it, typing
 * anything else clears it.
 */
function ask(prompt, completer, hint) {
  return new Promise((resolve) => {
    // On an empty line Tab gives the hint instead of listing folders.
    const complete = hint ? (line) => (line ? completer(line) : [[hint], line]) : completer;
    const rl = createInterface({ input: process.stdin, output: process.stdout, completer: complete, terminal: true });
    let ghost = false;
    const onKey = (_s, key) => {
      if (key?.name === "right" && !rl.line) rl.write(hint);
      if (ghost) {
        ghost = false;
        process.stdout.write("\x1b[K");
      }
    };
    rl.on("SIGINT", () => {
      rl.close();
      process.stdout.write(`\n  ${dim("Cancelled, nothing saved.")}\n`);
      process.exit(130);
    });
    rl.question(prompt, (answer) => {
      process.stdin.off("keypress", onKey);
      rl.close();
      // A Tab with nothing to complete lands in the answer as a tab character.
      resolve(answer.replace(/\t/g, "").trim());
    });
    if (hint) {
      process.stdout.write(`${dim(hint)}\x1b[${hint.length}D`);
      ghost = true;
      process.stdin.on("keypress", onKey);
    }
  });
}

/** Where the apps live: any folder you can write to. Apps already saved can move along. */
async function askFolder() {
  const before = currentFolder();
  const suggestion = "~/Documents/apps";
  console.log(`  Where should your ${bold("apps")} live? ${dim(`Tab takes ${suggestion}, Enter keeps ${tilde(before)}`)}`);
  for (;;) {
    const answer = await ask(`  ${blue("›")} Folder: `, completeFolder, suggestion);
    const dir = answer ? expand(answer) : before;
    try {
      mkdirSync(dir, { recursive: true });
      accessSync(dir, constants.W_OK);
    } catch {
      console.log(`  ${red("✗")} Can't write to ${tilde(dir)}. Pick another folder.`);
      continue;
    }
    // Apps saved in the old folder: offer to bring them (a rename on the same disk, else a copy).
    const apps = (p) => (existsSync(path.join(p, "projects")) ? readdirSync(path.join(p, "projects")).filter((n) => !n.startsWith(".")).length : 0);
    const old = dir !== before && existsSync(before) ? apps(before) : 0;
    if (old && !apps(dir)) {
      const move = await ask(`  ${blue("›")} Move your ${old} app${old === 1 ? "" : "s"} from ${tilde(before)}? ${dim("(Y/n)")} `);
      if (!/^n/i.test(move)) {
        process.stdout.write(`  ${dim("Moving…")}`);
        for (const name of readdirSync(before)) {
          const from = path.join(before, name), to = path.join(dir, name);
          if (existsSync(to)) continue;
          try {
            renameSync(from, to);
          } catch {
            cpSync(from, to, { recursive: true, verbatimSymlinks: true });
            rmSync(from, { recursive: true, force: true });
          }
        }
        process.stdout.write("\r\x1b[2K");
      }
    }
    set("SPARKFLOW_DATA_DIR", dir);
    process.env.SPARKFLOW_DATA_DIR = dir;
    console.log(`  ${green("✓")} Apps in ${tilde(dir)} ${dim("— change it with")} sparkflow folder\n`);
    return;
  }
}

function realpathSafe(p) {
  try {
    return realpathSync(p).replace(process.env.HOME ?? "\0", "~");
  } catch {
    return p;
  }
}

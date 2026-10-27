// First-run onboarding of `sparkflow`: asks for the Muse Spark API key and keeps it in the local
// .env (the installed version links it to ~/.sparkflow/.env), readable by this user only. The key
// never goes to the hosted site: the server on this computer calls the Meta Model API itself.
import { chmodSync, existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";

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
      for (const ch of buf.toString("utf8")) {
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          return resolve(value.trim());
        }
        if (ch === "\u0003") process.exit(130); // Ctrl+C
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
 * Runs before the status screen. Asks only when there is no key yet and the user hasn't chosen
 * demo mode, or always with `force` (`sparkflow key`).
 */
export async function onboarding({ force = false } = {}) {
  if (!existsSync(ENV) && existsSync(".env.example")) writeFileSync(ENV, readFileSync(".env.example", "utf8"));
  const text = readEnv();
  if (!force && (get(text, "MODEL_API_KEY") || get(text, "LLM_API_KEY") || get(text, "SPARKFLOW_DEMO") === "1")) return;
  if (!tty) return;

  console.log(`\n  ${blue("✦")} ${bold("Sparkflow")} ${dim("— first setup")}\n`);
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

function realpathSafe(p) {
  try {
    return realpathSync(p).replace(process.env.HOME ?? "\0", "~");
  } catch {
    return p;
  }
}

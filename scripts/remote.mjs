// Runs Sparkflow on this computer and opens it to the hosted site (Firebase Hosting) through a
// Cloudflare quick tunnel. The site gets the tunnel URL and a one-time token in its link; anyone
// without the token is refused (see proxy.ts). Ctrl+C stops the server and closes the tunnel.
// The terminal shows a small status screen; the server's own output goes to a log file.
//
//   npm run remote            build if needed, then serve on port 3002
//   npm run remote -- --build force a fresh build first
//   npm run remote -- --key   change the Muse Spark API key, then exit
import { execSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { Resolver } from "node:dns/promises";
import { accessSync, constants, createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, statfsSync, writeFileSync } from "node:fs";
import { request } from "node:https";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { onboarding } from "./onboarding.mjs";

const SITE = process.env.SPARKFLOW_SITE ?? "https://sparkflow-ai.web.app";
const PORT = process.env.PORT ?? "3002";
const token = randomBytes(24).toString("base64url");
// Own build folder: `npm run build:static` and `next dev` both write to .next.
const env = { ...process.env, NEXT_DIST_DIR: ".next-server" };
/** Before the status screen exists: one clear line and out. */
function early(message) {
  console.error(`\n  \x1b[31m✗\x1b[0m ${message}\n`);
  process.exit(1);
}
let version = "";
try {
  version = JSON.parse(readFileSync("package.json", "utf8")).version;
} catch {
  early("This Sparkflow install is incomplete. Reinstall it: sparkflow update");
}
const sparkHome = process.env.SPARKFLOW_HOME ?? join(homedir(), ".sparkflow");
const logDir = join(sparkHome, "logs");
// The tunnel address and token of this run, for /api/connect: the hosted site, open in a browser on
// this computer, asks localhost for them and connects by itself.
const connection = join(sparkHome, "connection.json");
try {
  mkdirSync(logDir, { recursive: true });
  accessSync(logDir, constants.W_OK);
} catch {
  early(`Sparkflow can't write to ${logDir}. Check its permissions (or free some disk space).`);
}
const logPath = join(logDir, "server.log");
const log = createWriteStream(logPath, { flags: "w" });
// A full disk must not crash the screen: the log just stops growing.
log.on("error", () => {});

// First run (or `--key`): the Muse Spark API key, before the status screen takes the terminal.
const setup = { key: process.argv.includes("--key"), folder: process.argv.includes("--folder") };
await onboarding(setup);
if (setup.key || setup.folder) process.exit(0);
// The apps folder the onboarding may just have picked.
if (process.env.SPARKFLOW_DATA_DIR) env.SPARKFLOW_DATA_DIR = process.env.SPARKFLOW_DATA_DIR;

// ---------- Terminal screen ----------
// The Sparkflow spark on the left, the run's state on the right. The screen follows the open
// Sparkflow tab (GET /api/presence): its colors, the spark's shimmer, the window title and, in
// terminals that allow it, a tint of the background change with the page you are on.
const tty = process.stdout.isTTY;
const c = (code) => (s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const dim = c("2"), bold = c("1"), green = c("32"), red = c("31"), yellow = c("33"), blue = c("38;5;75");
/** Clickable text in terminals that support it (iTerm2, Terminal, VS Code, Ghostty…). */
const linkTo = (url, text) => (tty ? `\x1b]8;;${url}\x07${text}\x1b]8;;\x07` : url);
const FRAMES = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";
const home = homedir();
const short = (p) => (p.startsWith(home) ? "~" + p.slice(home.length) : p);

const LOGO = (() => {
  const raw = `
              -%-.
             :=%@:.
            .:*@@+.
           :..=+%#-
          :. ..:-+**:.
       ::.    ...:*#%@#-.
   -=-:..  ::....-++##+=---:
.-+##*+-::      .:=:.....
     :=-.       ......
        :-.    :.:::
          :. .====.
          ...+%*+.
           :-#+=
           .++-
            *=
            :`.split("\n").slice(1);
  const width = Math.max(...raw.map((l) => l.length));
  return raw.map((l) => l.padEnd(width));
})();
const LOGO_W = LOGO[0].length;
// How bright each character of the spark is drawn.
const WEIGHT = { ".": 0.2, ":": 0.32, "-": 0.42, "=": 0.55, "+": 0.66, "*": 0.76, "#": 0.86, "%": 0.94, "@": 1 };

const truecolor = /truecolor|24bit/i.test(process.env.COLORTERM ?? "");
function fg([r, g, b]) {
  if (truecolor) return `\x1b[38;2;${r};${g};${b}m`;
  const q = (v) => Math.round((v / 255) * 5);
  return `\x1b[38;5;${16 + 36 * q(r) + 6 * q(g) + q(b)}m`;
}
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const hex = (rgb) => "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");

/** One look per place: the spark's dark and bright colors, its glint, its speed, the background tint. */
const THEMES = {
  idle: { dim: [38, 46, 64], hi: [110, 130, 175], glow: [200, 215, 255], speed: 0.35, bg: [11, 13, 18] },
  hero: { dim: [18, 48, 110], hi: [55, 140, 255], glow: [195, 228, 255], speed: 0.6, bg: [10, 16, 32] },
  how: { dim: [52, 30, 110], hi: [150, 105, 255], glow: [228, 210, 255], speed: 0.6, bg: [17, 12, 30] },
  apps: { dim: [12, 66, 78], hi: [40, 200, 200], glow: [205, 255, 250], speed: 0.6, bg: [8, 22, 26] },
  write: { dim: [26, 58, 120], hi: [90, 175, 255], glow: [255, 255, 255], speed: 1.5, bg: [10, 18, 36] },
  record: { dim: [110, 24, 40], hi: [255, 82, 104], glow: [255, 214, 220], speed: 1.2, bg: [26, 10, 14] },
  build: { dim: [110, 68, 10], hi: [255, 182, 40], glow: [255, 242, 205], speed: 1.7, bg: [23, 18, 10] },
  done: { dim: [14, 78, 40], hi: [60, 212, 122], glow: [212, 255, 226], speed: 0.5, bg: [10, 22, 14] },
  failed: { dim: [110, 24, 30], hi: [240, 82, 82], glow: [255, 204, 204], speed: 0.4, bg: [26, 10, 12] },
  play: { dim: [98, 20, 90], hi: [240, 92, 212], glow: [255, 216, 246], speed: 1.1, bg: [24, 10, 23] },
  away: { dim: [34, 37, 45], hi: [84, 92, 110], glow: [140, 150, 170], speed: 0.2, bg: [12, 13, 16] },
};
// The colors on screen glide toward the current theme instead of jumping.
let look = { ...THEMES.idle };
function glide(target) {
  for (const k of ["dim", "hi", "glow", "bg"]) look[k] = mix(look[k], target[k], 0.18);
  look.speed += (target.speed - look.speed) * 0.18;
}

// Background tint and title: only where the terminal supports setting them (and SPARKFLOW_TINT=0 turns the tint off).
const tintable =
  tty && process.env.SPARKFLOW_TINT !== "0" && (/^(iTerm\.app|ghostty|WezTerm)$/.test(process.env.TERM_PROGRAM ?? "") || /kitty|ghostty/.test(process.env.TERM ?? ""));
let tinted = "";
let titled = "";

const steps = [
  { label: "Server", state: "wait", detail: "" },
  { label: "Tunnel", state: "wait", detail: "" },
  { label: "Reachable", state: "wait", detail: "" },
];
let frame = 0;
let shimmer = 0;
let ready = null; // { url, link } once everything is up
let warning = "";
/** The open tab's whereabouts, polled from the server. */
let report = null;
let presenceTimer;
let beaconTimer;

/** Cuts a line to `width` visible characters, keeping its color and link escape codes whole. */
function fit(line, width) {
  let out = "";
  let shown = 0;
  for (let i = 0; i < line.length; ) {
    const esc = line.slice(i).match(/^\x1b(\[[0-9;?]*[A-Za-z]|\]8;;[^\x07]*\x07)/);
    if (esc) {
      out += esc[0];
      i += esc[0].length;
      continue;
    }
    const ch = String.fromCodePoint(line.codePointAt(i));
    if (shown >= width) {
      out += "…";
      break;
    }
    out += ch;
    shown++;
    i += ch.length;
  }
  return out + (tty ? "\x1b[0m" : "");
}
const visible = (s) => s.replace(/\x1b(\[[0-9;?]*[A-Za-z]|\]8;;[^\x07]*\x07)/g, "").length;

/** A row of the spark: dark to bright by character, with a glint sweeping across it diagonally. */
function logoRow(y) {
  const sweep = LOGO_W + LOGO.length * 2 + 16;
  const pos = (shimmer % sweep) - 8;
  let out = "";
  for (let x = 0; x < LOGO_W; x++) {
    const ch = LOGO[y][x];
    const w = WEIGHT[ch];
    if (!w) {
      out += " ";
      continue;
    }
    const glint = Math.max(0, 1 - Math.abs(x + y * 2 - pos) / 5);
    out += fg(mix(mix(look.dim, look.hi, w), look.glow, glint * 0.8)) + ch;
  }
  return out + "\x1b[0m";
}

const deviceName = (d) =>
  !d ? "" : d === "simulator" ? "live Simulator" : d.replace(/iphone/i, "iPhone").replace(/ipad/i, "iPad").replace(/android/i, "Android").replace(/-/g, " ");

function bar(done, total, moving) {
  const width = 20;
  const full = total ? Math.round((done / total) * width) : 0;
  const head = moving ? full + (Math.floor(frame / 2) % Math.max(1, width - full)) : -1;
  let s = "";
  for (let i = 0; i < width; i++) s += i < full ? fg(look.hi) + "█" : i === head ? fg(look.glow) + "▓" : fg(look.dim) + "░";
  return `${s}\x1b[0m ${dim(`${done}/${total}`)}`;
}

/** Where the open tab is, as a theme, a title and a few lines. */
function scene() {
  if (!ready) return { theme: "idle", title: "Sparkflow", lines: [] };
  const p = report?.presence;
  if (!p || report.age == null || report.age > 25000) {
    return { theme: "idle", title: "Sparkflow", head: `${dim("○")} Waiting for the site`, lines: [dim("Open it below: it finds this computer by itself.")] };
  }
  if (p.hidden) return { theme: "away", title: "Sparkflow", head: `${dim("◌")} Sparkflow is in a background tab`, lines: [dim("Come back to it and this screen follows.")] };
  if (p.view === "home") {
    if (p.composer === "recording") return { theme: "record", title: "Sparkflow — recording", head: `${red("●")} Recording a voice memo`, lines: [dim("Describe the app out loud, Muse Spark listens.")] };
    if (p.composer === "sketch") return { theme: "write", title: "Sparkflow — new app", head: `${blue("◆")} A sketch is attached`, lines: [dim(p.draft ? `“${p.draft}”` : "SAM 3.1 will read its layout.")] };
    if (p.composer === "writing") return { theme: "write", title: "Sparkflow — new app", head: `${blue("✎")} Describing an app`, lines: [`“${p.draft ?? ""}${frame % 12 < 6 ? "▍" : " "}”`] };
    if (p.section === "how") return { theme: "how", title: "Sparkflow — How it works", head: "How it works", lines: [dim("Plan → build → screenshot → fix, until every page matches.")] };
    if (p.section === "apps") {
      const n = report.apps;
      return { theme: "apps", title: "Sparkflow — My apps", head: "My apps", lines: [dim(`${n} app${n === 1 ? "" : "s"} on this computer`)] };
    }
    return { theme: "hero", title: "Sparkflow", head: "On the landing", lines: [dim("Describe an app, drop a sketch or record a voice memo.")] };
  }
  const pj = report.project;
  const name = pj?.name ?? "App";
  const where = p.page ? `${name} › ${p.page}` : name;
  const device = deviceName(p.device);
  if (p.mode === "play") return { theme: "play", title: `▶ ${name}`, head: `▶ Playing ${bold(name)}`, lines: [dim(device ? `on the ${device}` : "end to end")] };
  if (pj?.status === "running") {
    return { theme: "build", title: `Building ${name}`, head: `${yellow(FRAMES[frame % FRAMES.length])} Building ${bold(name)}`, lines: [dim(pj.step ?? "Working…"), bar(pj.done, pj.total, true)] };
  }
  if (pj?.status === "failed") return { theme: "failed", title: `${name} — stopped`, head: `${red("✗")} ${bold(where)}`, lines: [dim("The last run stopped: see the Activity tab."), bar(pj.done, pj.total, false)] };
  const all = pj && pj.total > 0 && pj.done === pj.total;
  return {
    theme: all ? "done" : "hero",
    title: where,
    head: `${all ? green("✓") : blue("◆")} ${bold(where)}`,
    lines: [pj ? bar(pj.done, pj.total, false) + dim(" pages verified") : "", dim([p.mode === "page" ? "page in focus" : "all pages", device].filter(Boolean).join(" · "))],
  };
}

function draw() {
  if (!tty) return;
  frame++;
  const sc = scene();
  glide(THEMES[sc.theme]);
  shimmer += look.speed;

  const width = (process.stdout.columns || 80) - 1;
  if (titled !== sc.title) {
    titled = sc.title;
    process.stdout.write(`\x1b]0;${sc.title}\x07`);
  }
  if (tintable && tinted !== hex(look.bg)) {
    tinted = hex(look.bg);
    process.stdout.write(`\x1b]11;${tinted}\x07`);
  }

  const spin = FRAMES[frame % FRAMES.length];
  const icon = (s) => ({ wait: dim("·"), run: blue(spin), ok: green("✓"), fail: red("✗") })[s.state];
  const panel = [
    `${fg(look.hi)}✦\x1b[0m ${bold("Sparkflow")} ${dim("v" + version)}`,
    "",
    ...steps.map((s) => `${icon(s)} ${s.state === "wait" ? dim(s.label.padEnd(10)) : s.label.padEnd(10)} ${dim(s.detail)}`),
    "",
  ];
  if (ready) {
    if (sc.head) panel.push(sc.head, ...sc.lines.filter(Boolean), "");
    panel.push(blue(linkTo(ready.link, "Open sparkflow-ai.web.app ↗")), "");
  }
  // One entry per screen line, so the redraw knows how far to go back up.
  if (warning) panel.push(...`${yellow("!")} ${warning}`.split("\n"), "");
  panel.push(dim(`Logs  ${short(logPath)}`), dim("Stop  Ctrl+C"));

  // The spark sits on the left when the window has room for it, the panel centred beside it.
  const height = process.stdout.rows || 24;
  let lines;
  if (width >= LOGO_W + 52 && height >= LOGO.length + 2) {
    const rows = Math.max(LOGO.length, panel.length);
    const top = Math.floor((rows - panel.length) / 2);
    const logoTop = Math.floor((rows - LOGO.length) / 2);
    lines = [""];
    for (let i = 0; i < rows; i++) {
      const l = i - logoTop >= 0 && i - logoTop < LOGO.length ? logoRow(i - logoTop) : " ".repeat(LOGO_W);
      lines.push(`  ${l}    ${panel[i - top] ?? ""}`);
    }
    lines.push("");
  } else {
    lines = ["", ...panel.map((l) => (l ? `  ${l}` : l)), ""];
  }
  // The screen has a terminal page of its own (alternate screen): each frame is drawn from the top
  // corner, centred vertically, every line cut to the width and the frame to the height, so a
  // resize never leaves pieces of the previous one behind.
  lines = lines.slice(0, height);
  const pad = Math.max(0, Math.floor((height - lines.length) / 2));
  last = lines.map((l) => fit(l, width));
  process.stdout.write("\x1b[H" + "\x1b[K\n".repeat(pad) + last.join("\x1b[K\n") + "\x1b[K\x1b[J");
}
/** The last frame, printed back on the normal screen when sparkflow stops. */
let last = [];
const timer = setInterval(draw, 80);
// Its own screen page, without the cursor; redrawn at once when the window is resized.
if (tty) {
  process.stdout.write("\x1b[?1049h\x1b[?25l");
  process.stdout.on("resize", () => {
    process.stdout.write("\x1b[2J");
    draw();
  });
}

const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  clearInterval(presenceTimer);
  clearInterval(beaconTimer);
  // Tell guests the app went offline before the server goes away, but never hold the exit long.
  beacon(true, 1500).finally(() => finish(code));
}

function finish(code) {
  rmSync(connection, { force: true });
  rmSync(`${connection}.claimed`, { force: true });
  for (const ch of children) ch.kill("SIGTERM");
  draw();
  // Give the terminal back as it was (page, cursor, background, title), with the last frame on it.
  if (tty) process.stdout.write("\x1b[?1049l\x1b[?25h" + (tintable ? "\x1b]111\x07" : "") + "\x1b]0;\x07" + last.join("\n").replace(/^\n+/, "\n") + "\n");
  // No status screen (output piped, a service): the failure as plain lines.
  else if (code) console.error(steps.filter((x) => x.state === "fail").map((x) => `${x.label}: ${x.detail}`).concat(warning ? [warning.replace(/\x1b\[[0-9;]*m/g, "")] : []).join("\n"));
  process.exit(code);
}
/**
 * Known failures, recognized in an error or the server's output, with what to do about them.
 * Anything else shows the last lines of the log.
 */
const KNOWN = [
  [/ENOSPC|no space left/i, "Your disk is full. Free some space, then run sparkflow again."],
  [/EMFILE|too many open files/i, "Too many open files. Install watchman (brew install watchman), then run sparkflow again."],
  [/Could not find a production build|Cannot find module|MODULE_NOT_FOUND|ERR_MODULE_NOT_FOUND/, "This Sparkflow install is incomplete. Reinstall it: sparkflow update"],
  [/EACCES|EPERM|permission denied/i, "Sparkflow isn't allowed to write somewhere it needs. Check your apps folder (sparkflow folder) and ~/.sparkflow."],
  [/ENOMEM|JavaScript heap out of memory/i, "Your Mac ran out of memory. Close a few apps (or a simulator), then run sparkflow again."],
];
const explain = (text) => KNOWN.find(([re]) => re.test(text))?.[1];
const logTail = (n = 6) => {
  try {
    return readFileSync(logPath, "utf8").trim().split("\n").slice(-n).join("\n");
  } catch {
    return "";
  }
};

/** Stops on a failed step. `hint`: what to do, shown instead of the server's last output. */
function fail(step, detail, hint) {
  if (stopping) return;
  step.state = "fail";
  step.detail = detail;
  const tail = logTail();
  hint ??= explain(tail);
  if (hint) warning = hint;
  else if (tail) warning = `Last server output (${short(logPath)}):\n    ${dim(tail.split("\n").join("\n    "))}`;
  stop(1);
}

// A bug in this script itself: the same clean ending instead of a stack trace over the screen.
const crash = (err) => {
  log.write(`\n[sparkflow] ${err?.stack ?? err}\n`);
  const step = steps.find((x) => x.state === "run") ?? steps[0];
  fail(step, "stopped unexpectedly", explain(String(err?.message ?? err)) ?? `Something went wrong: ${String(err?.message ?? err).slice(0, 120)}\n  Details in ${short(logPath)}. Run sparkflow again; if it keeps happening, sparkflow update.`);
};
process.on("uncaughtException", crash);
process.on("unhandledRejection", crash);
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

// ---------- Server ----------
const [serverStep, tunnelStep, reachStep] = steps;

// Something already answers on the port: most likely Sparkflow running in another terminal. Say so
// and stop before opening a tunnel, rather than failing halfway with its logs.
let taken = await fetch(`http://127.0.0.1:${PORT}/api/projects`, { signal: AbortSignal.timeout(1500) }).then(
  // Sparkflow answers in JSON, even when it refuses a request without its token (403).
  (r) => (/json/.test(r.headers.get("content-type") ?? "") ? "sparkflow" : "other"),
  () => null,
);
const busy = (who) =>
  fail(
    serverStep,
    who === "sparkflow" ? "Sparkflow is already running" : `port ${PORT} is taken`,
    who === "sparkflow"
      ? `Sparkflow already runs in another terminal: use that one,\n  or stop it there (Ctrl+C) and run ${bold("sparkflow")} again.`
      : `Another program uses port ${PORT}. Close it, or start on another port:\n  ${bold(`PORT=${Number(PORT) + 1} sparkflow`)}`,
  );
// A server left behind by a Sparkflow whose terminal was closed: no other `sparkflow` runs, so
// stop it and take its place.
if (taken === "sparkflow") {
  const sh = (cmd) => {
    try {
      return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    } catch {
      return "";
    }
  };
  const others = sh(`pgrep -f "[s]cripts/remote.mjs"`).split("\n").filter((p) => p.trim() && Number(p) !== process.pid);
  if (!others.length) {
    for (const pid of sh(`lsof -tiTCP:${PORT} -sTCP:LISTEN`).split("\n").filter(Boolean)) {
      try {
        process.kill(Number(pid), "SIGKILL");
      } catch {}
    }
    await new Promise((r) => setTimeout(r, 800));
    taken = null;
  }
}
if (taken) busy(taken);
if (process.argv.includes("--build") || !existsSync(".next-server/BUILD_ID")) {
  serverStep.state = "run";
  serverStep.detail = "building (first run only)…";
  draw();
  try {
    execSync(`npx next build >> "${logPath}" 2>&1`, { stdio: "ignore", env });
  } catch {
    fail(serverStep, "build failed", explain(logTail(30)) ?? `The server build failed. Reinstall Sparkflow: sparkflow update\n  Details in ${short(logPath)}.`);
  }
}

// The apps folder: it may sit on a disk that isn't plugged in, or be read-only.
const appsDir = env.SPARKFLOW_DATA_DIR;
if (appsDir) {
  try {
    mkdirSync(appsDir, { recursive: true });
    accessSync(appsDir, constants.W_OK);
  } catch {
    fail(
      serverStep,
      "apps folder unavailable",
      `${short(appsDir)} isn't available${appsDir.startsWith("/Volumes/") ? " (disk unplugged?)" : ""}.\n  Plug it in, or pick another folder: ${bold("sparkflow folder")}`,
    );
  }
}
// Little disk left: builds and screenshots will fail halfway, so say it now (without stopping).
try {
  const { bavail, bsize } = statfsSync(appsDir || sparkHome);
  const gb = (bavail * bsize) / 1024 ** 3;
  if (gb < 2) warning = `Only ${gb.toFixed(1)} GB left on disk: builds may fail. Free some space.`;
} catch {}

serverStep.state = "run";
serverStep.detail = `starting on localhost:${PORT}…`;
// Bound to 127.0.0.1: the server trusts local requests, so other machines on the network must not reach it.
const server = spawn("npx", ["next", "start", "-H", "127.0.0.1", "-p", PORT], {
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...env, SPARKFLOW_TOKEN: token, SPARKFLOW_CONNECTION: connection, SPARKFLOW_HOME: sparkHome },
});
children.push(server);
const onServerOutput = (d) => {
  log.write(d);
  const text = String(d);
  if (/EADDRINUSE/.test(text)) busy("other");
  // Errors while running (a build that failed, Metro…) show up as one line; details in the log.
  const err = text.split("\n").find((l) => /\b(Error|error)\b/.test(l));
  if (err && serverStep.state === "ok") warning = explain(text) ?? err.replace(/^\s*\[sparkflow\]\s*/, "").trim().slice(0, 100);
};
server.on("error", (e) => fail(serverStep, "couldn't start", explain(e.message) ?? "Node's npx wasn't found. Reinstall Sparkflow: sparkflow update"));
server.stdout.on("data", onServerOutput);
server.stderr.on("data", onServerOutput);
server.on("exit", (code, signal) => serverStep.state !== "fail" && fail(serverStep, signal ? `stopped (${signal})` : `stopped (exit ${code})`));

// Where the open Sparkflow tab is. With the token: a request from a script carries no browser fetch
// metadata, so the server refuses it as owner-by-locality once a token is set.
async function pollPresence() {
  report = await fetch(`http://127.0.0.1:${PORT}/api/presence`, { headers: { "x-sparkflow-token": token } }).then((r) => (r.ok ? r.json() : null), () => null);
}

// Ready once it answers HTTP locally.
(async function waitServer() {
  for (let i = 0; i < 120; i++) {
    const up = await fetch(`http://127.0.0.1:${PORT}/api/projects`, { headers: { "x-sparkflow-token": token } }).then(() => true).catch(() => false);
    if (up) {
      serverStep.state = "ok";
      serverStep.detail = `localhost:${PORT}`;
      presenceTimer = setInterval(pollPresence, 600);
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  fail(serverStep, "didn't start in 60 s", explain(logTail(30)) ?? `The server didn't answer in 60 s. Run sparkflow again; details in ${short(logPath)}.`);
})();

// ---------- Tunnel ----------
// Empty config: a ~/.cloudflared/config.yml with its own ingress rules would answer 404 to everything.
const emptyConfig = join(tmpdir(), "sparkflow-cloudflared.yml");
try {
  writeFileSync(emptyConfig, "{}\n");
} catch {}
tunnelStep.state = "run";
tunnelStep.detail = "opening a Cloudflare quick tunnel…";

/**
 * Without a tunnel Sparkflow still works in a browser on this Mac (the site reaches localhost):
 * keep the server, say why the tunnel is missing, and what that costs (other devices, phones).
 */
let tunnelOutput = "";

/**
 * Asks the server to publish its tunnel address for the people a project is shared with (it reads the
 * address from connection.json itself and does nothing unless something is shared). Best effort.
 */
function beacon(offline = false, ms = 3000) {
  return fetch(`http://127.0.0.1:${PORT}/api/share/beacon${offline ? "?offline=1" : ""}`, {
    method: "POST",
    headers: { "x-sparkflow-token": token },
    signal: AbortSignal.timeout(ms),
  }).then(
    () => {},
    () => {},
  );
}

function tunnelDown(detail, hint) {
  if (stopping || tunnelStep.state === "fail") return;
  void beacon(true);
  tunnelStep.state = "fail";
  tunnelStep.detail = detail;
  reachStep.state = "wait";
  reachStep.detail = "this Mac only";
  warning = `${hint}\n  Works on this Mac; other devices can't reach it.`;
  if (!ready) {
    const local = `http://localhost:${PORT}`;
    try {
      writeFileSync(connection, JSON.stringify({ url: local, token }), { mode: 0o600 });
    } catch {}
    ready = { url: local, link: SITE, picked: false, opened: false, local: true };
  }
}
const why = () =>
  /429|Too Many Requests|failed to (request|unmarshal) quick Tunnel/i.test(tunnelOutput)
    ? "Cloudflare refused a new tunnel (too many in a short time): wait a minute, then run sparkflow again."
    : /no such host|lookup .* failed|network is unreachable|dial tcp|i\/o timeout|ENOTFOUND/i.test(tunnelOutput)
      ? "No internet connection: the tunnel couldn't open. Check your network, then run sparkflow again."
      : `The Cloudflare tunnel couldn't open. Run sparkflow again; details in ${short(logPath)}.`;

const tunnel = spawn("cloudflared", ["--config", emptyConfig, "tunnel", "--no-autoupdate", "--url", `http://127.0.0.1:${PORT}`], { stdio: ["ignore", "pipe", "pipe"] });
children.push(tunnel);
tunnel.on("error", () => tunnelDown("cloudflared is missing", `Install it to reach Sparkflow from other devices: ${bold("brew install cloudflared")}`));
tunnel.on("exit", (code) => {
  if (stopping) return;
  // Closed after working (sleep, network change): the server stays up on this Mac.
  if (seen) tunnelDown("closed", "The tunnel closed (sleep or a network change). Restart sparkflow to reach it from other devices again.");
  else tunnelDown(`closed (exit ${code})`, why());
});
// No address after 45 s: offline, or Cloudflare is slow to hand one out.
setTimeout(() => {
  if (!seen && tunnelStep.state === "run") {
    tunnel.kill("SIGTERM");
    tunnelDown("no address after 45 s", why());
  }
}, 45000);

/**
 * The tunnel's name takes a little while to exist. Opening the site before that makes the system
 * resolver remember "no such host" for minutes, so wait for Cloudflare's DNS (1.1.1.1, never the
 * local resolver) to know it and for the tunnel to answer, then open the link.
 */
async function reachable(url) {
  const host = new URL(url).hostname;
  const dns = new Resolver();
  dns.setServers(["1.1.1.1", "1.0.0.1"]);
  for (let i = 0; i < 60; i++) {
    const ip = await dns.resolve4(host).then((a) => a[0]).catch(() => null);
    if (ip) {
      const code = await new Promise((res) => {
        const req = request({ host: ip, servername: host, headers: { host }, path: "/api/projects", timeout: 5000 }, (r) => {
          r.resume();
          res(r.statusCode);
        });
        req.on("error", () => res(0));
        req.on("timeout", () => req.destroy());
        req.end();
      });
      if (code === 401) return true; // the server answered (and refused us without the token)
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

let seen = false;
const watch = async (chunk) => {
  log.write(chunk);
  const text = chunk.toString();
  tunnelOutput = (tunnelOutput + text).slice(-4000);
  // A dropped connection that cloudflared is bringing back: show it, then the host again.
  if (seen && tunnelStep.state !== "fail") {
    if (/ERR .*(connection|Serve tunnel)/i.test(text)) tunnelStep.detail = "reconnecting…";
    else if (/Registered tunnel connection/i.test(text)) tunnelStep.detail = "connected";
  }
  const url = chunk.toString().match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0];
  if (!url || seen || tunnelStep.state === "fail") return;
  seen = true;
  tunnelStep.state = "ok";
  tunnelStep.detail = "connected";
  reachStep.state = "run";
  reachStep.detail = "waiting for the address to go live…";
  if (await reachable(url)) {
    reachStep.state = "ok";
    reachStep.detail = "the hosted site can reach this computer";
  } else {
    reachStep.state = "ok";
    reachStep.detail = "slow to come up, the link may need a minute";
  }
  const link = `${SITE}/?backend=${encodeURIComponent(url)}&token=${token}`;
  rmSync(`${connection}.claimed`, { force: true });
  writeFileSync(connection, JSON.stringify({ url, token }), { mode: 0o600 });
  void beacon();
  // A heartbeat, so guests see a fresh seenAt while this Mac stays up.
  clearInterval(beaconTimer);
  beaconTimer = setInterval(() => void beacon(), 10 * 60_000);
  ready = { url, link, picked: false, opened: false };
  if (!tty) console.log(`Sparkflow is connected: ${link}`);
  // A Sparkflow tab already waiting on the onboarding asks /api/connect within 2 s: give it the
  // chance before opening a new tab, so the browser doesn't end up with two.
  await new Promise((r) => setTimeout(r, 3000));
  // The browser opens by itself only the very first time: later, a Sparkflow tab finds this server on
  // its own (it asks localhost when it loads), so a restart doesn't pile up tabs.
  const openedOnce = join(sparkHome, ".opened-site");
  if (existsSync(`${connection}.claimed`)) {
    ready.picked = true;
  } else if (process.platform === "darwin" && !process.env.SPARKFLOW_NO_OPEN && !existsSync(openedOnce)) {
    spawn("open", [link]);
    ready.opened = true;
  }
  try {
    writeFileSync(openedOnce, "");
  } catch {}
};
tunnel.stdout.on("data", watch);
tunnel.stderr.on("data", watch);

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
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { request } from "node:https";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { onboarding } from "./onboarding.mjs";

const SITE = process.env.SPARKFLOW_SITE ?? "https://sparkflow-ai.web.app";
const PORT = process.env.PORT ?? "3002";
const token = randomBytes(24).toString("base64url");
// Own build folder: `npm run build:static` and `next dev` both write to .next.
const env = { ...process.env, NEXT_DIST_DIR: ".next-server" };
const version = JSON.parse(readFileSync("package.json", "utf8")).version;
const sparkHome = process.env.SPARKFLOW_HOME ?? join(homedir(), ".sparkflow");
const logDir = join(sparkHome, "logs");
// The tunnel address and token of this run, for /api/connect: the hosted site, open in a browser on
// this computer, asks localhost for them and connects by itself.
const connection = join(sparkHome, "connection.json");
mkdirSync(logDir, { recursive: true });
const logPath = join(logDir, "server.log");
const log = createWriteStream(logPath, { flags: "w" });

// First run (or `--key`): the Muse Spark API key, before the status screen takes the terminal.
await onboarding({ force: process.argv.includes("--key") });
if (process.argv.includes("--key")) process.exit(0);

// ---------- Terminal screen ----------
const tty = process.stdout.isTTY;
const c = (code) => (s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const dim = c("2"), bold = c("1"), green = c("32"), red = c("31"), yellow = c("33"), blue = c("38;5;75");
/** Clickable text in terminals that support it (iTerm2, Terminal, VS Code, Ghostty…). */
const linkTo = (url, text) => (tty ? `\x1b]8;;${url}\x07${text}\x1b]8;;\x07` : url);
const FRAMES = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";
const home = homedir();
const short = (p) => (p.startsWith(home) ? "~" + p.slice(home.length) : p);

const steps = [
  { label: "Server", state: "wait", detail: "" },
  { label: "Tunnel", state: "wait", detail: "" },
  { label: "Reachable", state: "wait", detail: "" },
];
let frame = 0;
let ready = null; // { url, link } once everything is up
let warning = "";
let drawn = 0;

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

function draw() {
  if (!tty) return;
  const spin = FRAMES[frame++ % FRAMES.length];
  const icon = (s) => ({ wait: dim("·"), run: blue(spin), ok: green("✓"), fail: red("✗") })[s.state];
  const lines = [
    "",
    `  ${blue("✦")} ${bold("Sparkflow")} ${dim("v" + version)}`,
    "",
    ...steps.map((s) => `  ${icon(s)} ${s.state === "wait" ? dim(s.label.padEnd(10)) : s.label.padEnd(10)} ${dim(s.detail)}`),
    "",
  ];
  if (ready) {
    lines.push(
      `  ${green("●")} ${bold("Connected")} ${dim("— your browser opened Sparkflow")}`,
      "",
      `    ${blue(linkTo(ready.link, "Open sparkflow-ai.web.app ↗"))}`,
      `    ${dim(new URL(ready.url).host)}`,
      "",
    );
  }
  // One entry per screen line, so the redraw knows how far to go back up.
  if (warning) lines.push(...`  ${yellow("!")} ${warning}`.split("\n"), "");
  lines.push(`  ${dim(`Logs  ${short(logPath)}`)}`, `  ${dim("Stop  Ctrl+C")}`, "");
  // Redraw in place: back up over the previous frame, then clear to the end of the screen. Every
  // line is cut to the terminal's width: a line that wraps takes two rows, and the redraw would
  // then back up too little and push the screen down a row each frame.
  const width = (process.stdout.columns || 80) - 1;
  process.stdout.write((drawn ? `\x1b[${drawn}F` : "") + "\x1b[0J" + lines.map((l) => fit(l, width)).join("\n") + "\n");
  drawn = lines.length;
}
const timer = setInterval(draw, 80);
if (tty) process.stdout.write("\x1b[?25l"); // hide the cursor while the spinner runs

const children = [];
function stop(code = 0) {
  clearInterval(timer);
  rmSync(connection, { force: true });
  for (const ch of children) ch.kill("SIGTERM");
  draw();
  if (tty) process.stdout.write("\x1b[?25h");
  process.exit(code);
}
function fail(step, detail) {
  step.state = "fail";
  step.detail = detail;
  const tail = existsSync(logPath) ? readFileSync(logPath, "utf8").trim().split("\n").slice(-6).join("\n    ") : "";
  if (tail) warning = `Last server output:\n    ${dim(tail)}`;
  stop(1);
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

// ---------- Server ----------
const [serverStep, tunnelStep, reachStep] = steps;
if (process.argv.includes("--build") || !existsSync(".next-server/BUILD_ID")) {
  serverStep.state = "run";
  serverStep.detail = "building (first run only)…";
  draw();
  try {
    execSync(`npx next build >> "${logPath}" 2>&1`, { stdio: "ignore", env });
  } catch {
    fail(serverStep, "build failed");
  }
}

serverStep.state = "run";
serverStep.detail = `starting on localhost:${PORT}…`;
const server = spawn("npx", ["next", "start", "-p", PORT], { stdio: ["ignore", "pipe", "pipe"], env: { ...env, SPARKFLOW_TOKEN: token, SPARKFLOW_CONNECTION: connection } });
children.push(server);
const onServerOutput = (d) => {
  log.write(d);
  const text = String(d);
  if (/EADDRINUSE/.test(text)) fail(serverStep, `port ${PORT} is taken (another Sparkflow running?)`);
  // Errors while running (a build that failed, Metro…) show up as one line; details in the log.
  const err = text.split("\n").find((l) => /\b(Error|error)\b/.test(l));
  if (err && serverStep.state === "ok") warning = err.replace(/^\s*\[sparkflow\]\s*/, "").slice(0, 100);
};
server.stdout.on("data", onServerOutput);
server.stderr.on("data", onServerOutput);
server.on("exit", (code) => serverStep.state !== "fail" && fail(serverStep, `stopped (exit ${code})`));

// Ready once it answers HTTP locally.
(async function waitServer() {
  for (let i = 0; i < 120; i++) {
    const up = await fetch(`http://localhost:${PORT}/api/projects`).then(() => true).catch(() => false);
    if (up) {
      serverStep.state = "ok";
      serverStep.detail = `localhost:${PORT}`;
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  fail(serverStep, "didn't start in 60 s");
})();

// ---------- Tunnel ----------
// Empty config: a ~/.cloudflared/config.yml with its own ingress rules would answer 404 to everything.
const emptyConfig = join(tmpdir(), "sparkflow-cloudflared.yml");
writeFileSync(emptyConfig, "{}\n");
tunnelStep.state = "run";
tunnelStep.detail = "opening a Cloudflare quick tunnel…";
const tunnel = spawn("cloudflared", ["--config", emptyConfig, "tunnel", "--no-autoupdate", "--url", `http://localhost:${PORT}`], { stdio: ["ignore", "pipe", "pipe"] });
children.push(tunnel);
tunnel.on("error", () => fail(tunnelStep, "cloudflared is missing: brew install cloudflared"));
tunnel.on("exit", (code) => tunnelStep.state !== "fail" && fail(tunnelStep, `closed (exit ${code})`));

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
  const url = chunk.toString().match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0];
  if (!url || seen) return;
  seen = true;
  tunnelStep.state = "ok";
  tunnelStep.detail = new URL(url).host;
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
  ready = { url, link };
  writeFileSync(connection, JSON.stringify({ url, token }), { mode: 0o600 });
  if (!tty) console.log(`Sparkflow is connected: ${link}`);
  if (process.platform === "darwin" && !process.env.SPARKFLOW_NO_OPEN) spawn("open", [link]);
};
tunnel.stdout.on("data", watch);
tunnel.stderr.on("data", watch);

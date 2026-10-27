// Runs Sparkflow on this computer and opens it to the hosted site (Firebase Hosting) through a
// Cloudflare quick tunnel. The site gets the tunnel URL and a one-time token in its link; anyone
// without the token is refused (see proxy.ts). Ctrl+C stops the server and closes the tunnel.
//
//   npm run remote            build if needed, then serve on port 3002
//   npm run remote -- --build force a fresh build first
import { execSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { Resolver } from "node:dns/promises";
import { request } from "node:https";
import { existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SITE = process.env.SPARKFLOW_SITE ?? "https://sparkflow-ai.web.app";
const PORT = process.env.PORT ?? "3002";
const token = randomBytes(24).toString("base64url");
// Own build folder: `npm run build:static` and `next dev` both write to .next.
const env = { ...process.env, NEXT_DIST_DIR: ".next-server" };

if (process.argv.includes("--build") || !existsSync(".next-server/BUILD_ID")) {
  console.log("› Building the server…");
  execSync("npx next build", { stdio: "inherit", env });
}

const children = [];
const stop = () => {
  for (const c of children) c.kill("SIGTERM");
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

const server = spawn("npx", ["next", "start", "-p", PORT], {
  stdio: ["ignore", "inherit", "inherit"],
  env: { ...env, SPARKFLOW_TOKEN: token },
});
children.push(server);
server.on("exit", (code) => {
  console.error(`Server stopped (${code}).`);
  stop();
});

// Empty config: a ~/.cloudflared/config.yml with its own ingress rules would answer 404 to everything.
const emptyConfig = join(tmpdir(), "sparkflow-cloudflared.yml");
writeFileSync(emptyConfig, "{}\n");
const tunnel = spawn("cloudflared", ["--config", emptyConfig, "tunnel", "--no-autoupdate", "--url", `http://localhost:${PORT}`], { stdio: ["ignore", "pipe", "pipe"] });
children.push(tunnel);
tunnel.on("error", () => {
  console.error("cloudflared is missing: brew install cloudflared");
  stop();
});

/**
 * The tunnel's name takes a little while to exist. Opening the site before that makes the system
 * resolver remember "no such host" for minutes, so wait for Cloudflare's DNS (1.1.1.1, never the
 * local resolver) to know it and for the tunnel to answer, then open the link.
 */
async function ready(url) {
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

let shown = false;
const watch = async (chunk) => {
  const url = chunk.toString().match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0];
  if (!url || shown) return;
  shown = true;
  console.log(`› Tunnel created at ${url}, waiting for it to be reachable…`);
  if (!(await ready(url))) console.log("  It is slow to come up; the link may need a minute.");
  const link = `${SITE}/?backend=${encodeURIComponent(url)}&token=${token}`;
  console.log(`\n✓ Your computer is reachable at ${url}\n\n  Open Sparkflow connected to it:\n  ${link}\n\n  Ctrl+C to stop.\n`);
  if (process.platform === "darwin" && !process.env.SPARKFLOW_NO_OPEN) spawn("open", [link]);
};
tunnel.stdout.on("data", watch);
tunnel.stderr.on("data", watch);

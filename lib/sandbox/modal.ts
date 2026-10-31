// Modal sandbox driver. Written against the modal SDK's types; not exercised by the local smoke test.
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ModalClient, type App, type Image, type Sandbox as ModalSandbox, type Volume } from "modal";
import { execIn, walk } from "./local";
import { DEFAULT_VIEWPORT, type ExecResult, type InspectJob, type InspectTargetResult, type Preview, type Sandbox, type SandboxDriver } from "./types";
import { LineBuffer, stateDir, repoRoot, templateDir } from "./util";

const PLAYWRIGHT = "1.64.1";
const APP = () => process.env.MODAL_APP_NAME ?? "sparkflow";
const VOLUME = () => process.env.MODAL_VOLUME_NAME ?? "sparkflow-projects";
const TIMEOUT = () => Number(process.env.MODAL_SANDBOX_TIMEOUT_MS ?? 4 * 3600_000);
const IDLE = () => Number(process.env.MODAL_SANDBOX_IDLE_TIMEOUT_MS ?? 30 * 60_000);
const q = (s: string) => `'${s.replace(/'/g, "'\\''")}'`;

async function sh(sb: ModalSandbox, command: string, timeoutSec = 120): Promise<ExecResult> {
  const p = await sb.exec(["bash", "-lc", command], { workdir: "/app", timeoutMs: timeoutSec * 1000 } as never);
  const [stdout, stderr] = await Promise.all([p.stdout.readText(), p.stderr.readText()]);
  const code = await p.wait();
  return { code, stdout, stderr, timedOut: false };
}

class ModalProjectSandbox implements Sandbox {
  dir = "/app";
  private preview?: Preview;
  private logs = new LineBuffer();
  constructor(
    public id: string,
    private sb: ModalSandbox,
  ) {}

  exec(command: string, opts?: { timeoutSec?: number }) {
    return sh(this.sb, command, opts?.timeoutSec ?? 120);
  }
  async readFile(rel: string) {
    const r = await this.exec(`cat -- ${q(rel)}`);
    if (r.code) throw new Error(r.stderr || `Cannot read ${rel}`);
    return r.stdout;
  }
  async readFileBytes(rel: string) {
    const r = await this.exec(`base64 -w0 -- ${q(rel)}`);
    if (r.code) throw new Error(r.stderr || `Cannot read ${rel}`);
    return Buffer.from(r.stdout, "base64");
  }
  async writeFile(rel: string, content: string | Buffer) {
    // A big file (a project's git bundle): copied over in one go.
    if (content.length > 512 * 1024) {
      const tmp = path.join(os.tmpdir(), `sparkflow-${this.id}-${Date.now()}`);
      await writeFile(tmp, content);
      try {
        const r = await this.exec(`mkdir -p "$(dirname -- ${q(rel)})"`);
        if (r.code) throw new Error(r.stderr);
        await this.sb.filesystem.copyFromLocal(tmp, rel.startsWith("/") ? rel : `/app/${rel}`);
      } finally {
        await rm(tmp, { force: true });
      }
      return;
    }
    const b64 = Buffer.from(content).toString("base64");
    // A command line holds 64 KB at most: a bigger file (an image) goes in chunks, appended in order.
    const CHUNK = 48_000;
    const tmp = `${rel}.sparkflow-part`;
    const r = await this.exec(`mkdir -p "$(dirname -- ${q(rel)})" && : > ${q(tmp)}`);
    if (r.code) throw new Error(r.stderr);
    for (let i = 0; i < b64.length || i === 0; i += CHUNK) {
      const w = await this.exec(`printf %s ${q(b64.slice(i, i + CHUNK))} >> ${q(tmp)}`);
      if (w.code) throw new Error(w.stderr);
      if (!b64.length) break;
    }
    const d = await this.exec(`base64 -d ${q(tmp)} > ${q(rel)} && rm -f ${q(tmp)}`);
    if (d.code) throw new Error(d.stderr);
  }
  async listFiles(dir?: string) {
    const r = await this.exec(
      `find ${q(dir || ".")} -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/.expo/*' -not -path '*/dist/*' | sed 's#^\\./##' | sort | head -5000`,
    );
    return r.stdout.split("\n").filter(Boolean);
  }
  async startDevServer(): Promise<Preview> {
    if (this.preview && this.devServerRunning()) return this.preview;
    const tunnels = await this.sb.tunnels(60_000);
    const https = tunnels[8081];
    const tcp = tunnels[8082];
    await this.exec("pkill -f 'expo start' || true; pkill socat || true");
    // Long-running processes are execs of their own, left running (an exec's children end with it).
    const proxyUrl = https.url.replace(/^https:/, "http:");
    await this.sb.exec(["bash", "-lc", `EXPO_PACKAGER_PROXY_URL=${q(proxyUrl)} BROWSER=none EXPO_NO_TELEMETRY=1 exec npx expo start --port 8081 > /tmp/metro.log 2>&1`], { workdir: "/app" } as never);
    await this.sb.exec(["bash", "-lc", "exec socat TCP-LISTEN:8082,fork,reuseaddr TCP:127.0.0.1:8081 > /dev/null 2>&1"], { workdir: "/app" } as never);
    const deadline = Date.now() + 180_000;
    for (;;) {
      const r = await this.exec("curl -s http://127.0.0.1:8081/status", { timeoutSec: 10 });
      if (r.stdout.includes("running")) break;
      if (Date.now() > deadline) throw new Error(`Metro did not start:\n${(await this.exec("tail -30 /tmp/metro.log")).stdout}`);
      await new Promise((res) => setTimeout(res, 1000));
    }
    // Expo Go speaks plain HTTP, hence the unencrypted TCP tunnel.
    const [host, port] = tcp ? [tcp.unencryptedHost ?? tcp.host, tcp.unencryptedPort ?? tcp.port] : [null, null];
    this.preview = { webUrl: https.url, internalUrl: "http://127.0.0.1:8081", expoGoUrl: host ? `exp://${host}:${port}` : null };
    return this.preview;
  }
  devServerRunning() {
    return !!this.preview;
  }
  devServerLogs(lines: number) {
    void this.exec(`tail -${lines} /tmp/metro.log`).then((r) => this.logs.push(r.stdout));
    return this.logs.tail(lines);
  }
  async inspect(job: InspectJob): Promise<InspectTargetResult[]> {
    await this.startDevServer();
    const dir = `/tmp/inspect-${Date.now()}`;
    await this.writeFile(`${dir}/job.json`, JSON.stringify({ viewport: DEFAULT_VIEWPORT, ...job, baseUrl: "http://127.0.0.1:8081" }));
    const r = await this.exec(`cd /opt/sparkflow && node inspect.mjs ${dir}`, { timeoutSec: 120 + 45 * job.targets.length + 30 });
    if (!r.stdout.includes("SPARKFLOW_INSPECT_DONE")) throw new Error(`Inspector failed: ${(r.stderr || r.stdout).slice(-1500)}`);
    const raw = JSON.parse(await this.readFile(`${dir}/result.json`));
    const load = (n: string | null) => (n ? this.readFileBytes(`${dir}/${n}`) : Promise.resolve(null));
    const out = await Promise.all(
      raw.map(async (t: any) => ({ ...t, screenshot: await load(t.screenshot), stepShots: (await Promise.all(t.stepShots.map(load))).filter(Boolean), video: await load(t.video) })),
    );
    await this.exec(`rm -rf ${dir}`);
    return out;
  }
  async persist() {
    await this.exec(`git bundle create /data/${this.id}.bundle --all && sync`, { timeoutSec: 120 });
  }
  async terminate() {
    await this.sb.terminate();
  }
}

export class ModalDriver {
  name = "modal" as const;
  private client = new ModalClient();
  private app?: Promise<App>;
  private volume?: Promise<Volume>;
  private image?: Promise<Image>;

  private getApp() {
    return (this.app ??= this.client.apps.fromName(APP(), { createIfMissing: true }));
  }
  private getVolume() {
    return (this.volume ??= this.client.volumes.fromName(VOLUME(), { createIfMissing: true, version: 2 }));
  }

  /** Template snapshot, cached by a hash of the template files, the inspector and the Playwright version. */
  private getImage() {
    return (this.image ??= (async () => {
      const files = await walk(templateDir());
      const hash = createHash("sha256");
      for (const f of files) hash.update(f).update(await readFile(path.join(templateDir(), f)));
      const inspector = path.join(repoRoot(), "lib", "sandbox", "runtime", "inspect.mjs");
      hash.update(await readFile(inspector)).update(PLAYWRIGHT);
      const key = hash.digest("hex").slice(0, 16);
      const cacheFile = path.join(stateDir(), "modal-image.json");
      const cached = existsSync(cacheFile) ? JSON.parse(await readFile(cacheFile, "utf8")) : null;
      if (cached?.key === key) return this.client.images.fromId(cached.imageId);

      const base = this.client.images
        .fromRegistry(`mcr.microsoft.com/playwright:v${PLAYWRIGHT}-noble`)
        .dockerfileCommands([
          "RUN apt-get update && apt-get install -y git socat curl && rm -rf /var/lib/apt/lists/*",
          // Commands run in /app (sh): it must exist before the template is unpacked there.
          "RUN mkdir -p /app",
          `RUN mkdir -p /opt/sparkflow && cd /opt/sparkflow && npm init -y >/dev/null && npm i playwright@${PLAYWRIGHT}`,
          "RUN git config --global user.name Sparkflow && git config --global user.email agent@sparkflow.dev && git config --global init.defaultBranch main",
        ]);
      const builder = await this.client.sandboxes.create(await this.getApp(), base, { cpu: 4, memoryMiB: 8192, timeoutMs: 3600_000 });
      try {
        const tar = path.join(stateDir(), "template.tgz");
        await mkdir(stateDir(), { recursive: true });
        await execIn(templateDir(), `tar --exclude=node_modules --exclude=.expo -czf ${q(tar)} .`, 300);
        await builder.filesystem.copyFromLocal(tar, "/tmp/template.tgz");
        await builder.filesystem.copyFromLocal(inspector, "/opt/sparkflow/inspect.mjs");
        const r = await sh(builder, "mkdir -p /app && tar -xzf /tmp/template.tgz -C /app && cd /app && (npm ci || npm install) && git init -q && git add -A && git commit -qm Template", 1200);
        if (r.code) throw new Error(`Template setup failed: ${r.stderr.slice(-1500)}`);
        const image = await builder.snapshotFilesystem();
        await writeFile(cacheFile, JSON.stringify({ key, imageId: image.imageId }));
        return image;
      } finally {
        await builder.terminate().catch(() => {});
      }
    })());
  }

  async open(projectId: string): Promise<Sandbox> {
    const name = `sf-${projectId}`;
    let sb: ModalSandbox | undefined;
    try {
      sb = await this.client.sandboxes.fromName(APP(), name);
    } catch {}
    if (!sb) {
      sb = await this.client.sandboxes.create(await this.getApp(), await this.getImage(), {
        name,
        cpu: 2,
        memoryMiB: 4096,
        timeoutMs: TIMEOUT(),
        idleTimeoutMs: IDLE(),
        encryptedPorts: [8081],
        unencryptedPorts: [8082],
        volumes: { "/data": await this.getVolume() },
        workdir: "/app",
      } as never);
      // Restore the project's git history from the volume, if any.
      await sh(sb, `if [ -f /data/${projectId}.bundle ]; then git fetch -q /data/${projectId}.bundle 'refs/heads/*:refs/remotes/backup/*' && git reset -q --hard backup/main; fi`);
    }
    return new ModalProjectSandbox(projectId, sb);
  }

  async remove(projectId: string) {
    try {
      const sb = await this.client.sandboxes.fromName(APP(), `sf-${projectId}`);
      await sh(sb, `rm -f /data/${projectId}.bundle`).catch(() => {});
      await sb.terminate();
    } catch {}
  }
}

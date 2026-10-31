import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "sf-cloud-"));
process.env.SPARKFLOW_DATA_DIR = dir;
process.env.SPARKFLOW_HOME = dir;
process.env.SPARKFLOW_CLOUD = "1";
process.env.SPARKFLOW_CLOUD_DAILY_RUNS = "2";
process.env.SPARKFLOW_CLOUD_UNLIMITED_UNTIL = "2000-01-01T00:00:00Z";
delete process.env.SPARKFLOW_TOKEN;

const { createSession, setProjectOwner } = await import("../lib/cloud/mode");
const { proxy } = await import("../proxy");

const call = (path: string, init: { method?: string; token?: string; host?: string } = {}) =>
  proxy(
    new NextRequest(`http://${init.host ?? "sparkflow.run.app"}${path}`, {
      method: init.method ?? "GET",
      headers: { ...(init.token ? { "x-sparkflow-token": init.token } : {}), host: init.host ?? "sparkflow.run.app", origin: "https://sparkflow-ai.web.app" },
    }),
  );
const actor = (r: Response) => r.headers.get("x-middleware-request-x-sparkflow-actor");

describe("cloud gate", () => {
  const alice = createSession({ uid: "alice", email: "a@x", name: "A" });
  const bob = createSession({ uid: "bob", email: "b@x", name: "B" });
  setProjectOwner("p-alice", "alice");

  it("lets no one in without a session, not even from localhost", async () => {
    expect((await call("/api/projects")).status).toBe(401);
    expect((await call("/api/projects", { host: "localhost:3000" })).status).toBe(401);
    expect((await call("/api/projects", { token: "sfc_forged" })).status).toBe(401);
  });

  it("opens a person's own projects only", async () => {
    expect(actor(await call("/api/projects/p-alice/files", { token: alice }))).toBe("owner");
    expect((await call("/api/projects/p-alice/files", { token: bob })).status).toBe(404);
  });

  it("keeps Mac-only routes and other APIs closed", async () => {
    expect((await call("/api/projects/p-alice/reveal", { method: "POST", token: alice })).status).toBe(404);
    // Sharing now works in the cloud: the owner manages it.
    expect(actor(await call("/api/projects/p-alice/share", { token: alice }))).toBe("owner");
    expect((await call("/api/projects/p-alice/share", { token: bob })).status).toBe(404);
    expect((await call("/api/sim/devices", { token: alice })).status).toBe(404);
  });

  it("counts runs per day", async () => {
    expect(actor(await call("/api/projects/p-alice/prompt", { method: "POST", token: alice }))).toBe("owner");
    expect(actor(await call("/api/projects", { method: "POST", token: alice }))).toBe("owner");
    expect((await call("/api/projects/p-alice/prompt", { method: "POST", token: alice })).status).toBe(429);
    // Reading isn't a run.
    expect(actor(await call("/api/projects/p-alice/state", { token: alice }))).toBe("owner");
  });

  it("lets a friend into the shared project only, by role, on the owner's quota", async () => {
    const key = "sfg_" + "k".repeat(43);
    const sha = createHash("sha256").update(key).digest("hex");
    mkdirSync(join(dir, ".sparkflow"), { recursive: true });
    writeFileSync(
      join(dir, ".sparkflow", "sharing.json"),
      JSON.stringify({ v: 1, projects: { "p-alice": { invites: [], members: [{ uid: "carol", role: "view", revokedAt: null }] } }, keys: { [sha]: { projectId: "p-alice", uid: "carol", createdAt: Date.now(), lastUsedAt: Date.now() } } }),
    );
    expect(actor(await call("/api/projects/p-alice/board", { token: key }))).toBe("guest");
    expect((await call("/api/projects/p-bob/board", { token: key })).status).toBe(404);
    // A viewer can't run the agent, nor reach a Mac-only route.
    expect((await call("/api/projects/p-alice/prompt", { method: "POST", token: key })).status).toBe(403);
    expect((await call("/api/projects/p-alice/reveal", { method: "POST", token: key })).status).toBe(404);
    // The public join and sign-back-in routes need no session.
    expect(actor(await call("/api/share/join", { method: "POST" }))).toBe("public");
  });

  it("lets the sign-in exchange and the health check through", async () => {
    expect(actor(await call("/api/cloud/session", { method: "POST" }))).toBe("public");
    expect(actor(await call("/api/health"))).toBe("public");
  });
});

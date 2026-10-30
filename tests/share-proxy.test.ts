import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "sf-proxy-"));
process.env.SPARKFLOW_DATA_DIR = dir;
process.env.SPARKFLOW_HOME = dir;
process.env.SPARKFLOW_TOKEN = "owner-secret";
mkdirSync(join(dir, ".sparkflow"), { recursive: true });

const KEY = "sfg_viewer";
const GONE = "sfg_removed";
const hash = (k: string) => createHash("sha256").update(k).digest("hex");
const now = Date.now();
writeFileSync(
  join(dir, ".sparkflow", "sharing.json"),
  JSON.stringify({
    v: 1,
    projects: {
      p1: {
        invites: [],
        members: [
          { uid: "u1", role: "view", revokedAt: null },
          { uid: "u2", role: "edit", revokedAt: now },
        ],
      },
    },
    keys: { [hash(KEY)]: { projectId: "p1", uid: "u1", createdAt: now, lastUsedAt: now }, [hash(GONE)]: { projectId: "p1", uid: "u2", createdAt: now, lastUsedAt: now } },
  }),
);

const { proxy } = await import("../proxy");

const req = (path: string, init: { method?: string; headers?: Record<string, string>; host?: string } = {}) =>
  new NextRequest(`http://${init.host ?? "localhost:3000"}${path}`, { method: init.method ?? "GET", headers: { host: init.host ?? "localhost:3000", ...init.headers } });
const fwd = (res: Response, h: string) => res.headers.get(`x-middleware-request-${h}`);

describe("proxy", () => {
  it("keeps a guest key from localhost restricted", () => {
    const ok = proxy(req("/api/projects/p1/board", { headers: { "x-sparkflow-token": KEY } }));
    expect(fwd(ok, "x-sparkflow-actor")).toBe("guest");
    expect(fwd(ok, "x-sparkflow-uid")).toBe("u1");
    expect(ok.headers.get("referrer-policy")).toBe("no-referrer");
    expect(proxy(req("/api/projects/p1/board", { method: "POST", headers: { "x-sparkflow-token": KEY } })).status).toBe(403);
    expect(proxy(req("/api/projects/p2/board", { headers: { "x-sparkflow-token": KEY } })).status).toBe(404);
    expect(proxy(req("/api/info", { headers: { "x-sparkflow-token": KEY } })).status).toBe(404);
    expect(proxy(req("/", { headers: { "x-sparkflow-token": KEY } })).status).toBe(404);
    expect(proxy(req("/api/projects/p1/events", { headers: { "x-sparkflow-token": KEY } })).status).toBe(403);
  });

  it("strips client actor headers", () => {
    const res = proxy(req("/api/projects/p1/board", { headers: { "x-sparkflow-token": KEY, "x-sparkflow-role": "edit", "x-sparkflow-actor": "owner" } }));
    expect(fwd(res, "x-sparkflow-role")).toBe("view");
    const owner = proxy(req("/api/info", { headers: { "x-sparkflow-uid": "u9", "sec-fetch-site": "same-origin" } }));
    expect(fwd(owner, "x-sparkflow-actor")).toBe("owner");
    expect(fwd(owner, "x-sparkflow-uid")).toBeNull();
  });

  it("stops trusting locality alone while a project is shared", () => {
    // Guest code in the Expo web preview (another localhost port), or a native runtime with no fetch metadata.
    expect(proxy(req("/api/projects/p1/share", { method: "POST", headers: { origin: "http://localhost:8081" } })).status).toBe(403);
    expect(proxy(req("/api/projects/p1/share", { method: "POST", headers: { origin: "http://localhost:3001" } })).status).toBe(403);
    expect(proxy(req("/api/projects/p1/share", { method: "POST" })).status).toBe(403);
    expect(proxy(req("/api/sim/devices")).status).toBe(403);
    expect(proxy(req("/api/sim/devices", { headers: { "sec-fetch-site": "same-site" } })).status).toBe(403);
    // The IDE itself, and the hosted site.
    expect(fwd(proxy(req("/api/projects/p1/share", { method: "POST", headers: { origin: "http://localhost:3000" } })), "x-sparkflow-actor")).toBe("owner");
    expect(fwd(proxy(req("/api/projects", { method: "POST", headers: { origin: "https://sparkflow-ai.firebaseapp.com" } })), "x-sparkflow-actor")).toBe("owner");
    expect(fwd(proxy(req("/")), "x-sparkflow-actor")).toBe("owner");
  });

  it("revoked and unknown keys get 401", () => {
    expect(proxy(req("/api/projects/p1/board", { headers: { "x-sparkflow-token": GONE } })).status).toBe(401);
    expect(proxy(req("/api/projects/p1/board", { headers: { "x-sparkflow-token": "sfg_nope" } })).status).toBe(401);
  });

  it("refuses a guest key outside the header", () => {
    expect(proxy(req(`/api/projects/p1/board?token=${KEY}`)).status).toBe(401);
  });

  it("refuses cross-site local writes", () => {
    expect(proxy(req("/api/projects", { method: "POST", headers: { origin: "https://evil.example" } })).status).toBe(403);
    expect(proxy(req("/api/projects", { method: "POST", headers: { "sec-fetch-site": "cross-site" } })).status).toBe(403);
    expect(fwd(proxy(req("/api/projects", { method: "POST", headers: { origin: "http://localhost:3000" } })), "x-sparkflow-actor")).toBe("owner");
  });

  it("the owner token still works through the tunnel", () => {
    const remote = { host: "abc.trycloudflare.com", headers: { "cf-connecting-ip": "1.2.3.4" } };
    expect(proxy(req("/api/info", remote)).status).toBe(401);
    const ok = proxy(req("/api/info", { ...remote, headers: { ...remote.headers, "x-sparkflow-token": "owner-secret" } }));
    expect(fwd(ok, "x-sparkflow-actor")).toBe("owner");
    const page = proxy(req("/?token=owner-secret", remote));
    expect(page.headers.get("set-cookie")).toContain("sparkflow_token");
  });

  it("lets anyone reach the join endpoints as public, and sets no cookie for guests", () => {
    const remote = { host: "abc.trycloudflare.com", headers: { "cf-connecting-ip": "1.2.3.4" } };
    expect(fwd(proxy(req("/api/share/join", { ...remote, method: "POST" })), "x-sparkflow-actor")).toBe("public");
    const g = proxy(req("/api/projects/p1", { ...remote, headers: { ...remote.headers, "x-sparkflow-token": KEY } }));
    expect(g.headers.get("set-cookie")).toBeNull();
  });
});

import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyDemoOverlay, DEMO_PROMPT, demoDir, demoFiles, demoAction, loadDemoPlan, markSeeded, mergeJson } from "../lib/agent/seed";
import type { Sandbox } from "../lib/sandbox/types";

describe("demo app overlay", () => {
  it("has a valid plan whose screens are overlay files", async () => {
    const plan = await loadDemoPlan();
    const files = await demoFiles();
    expect(plan.name).toBe("Wander");
    expect(plan.screens.length).toBeGreaterThanOrEqual(6);
    for (const s of plan.screens) expect(files).toContain(s.file);
    expect(plan.screens.find((s) => s.route === "/place/[id]")?.previewPath).toBe("/place/santorini");
  });

  it("lists source and photos, not plan.json", async () => {
    const files = await demoFiles();
    expect(files).not.toContain("plan.json");
    expect(files).toContain("lib/store.ts");
    expect(files.filter((f) => f.startsWith("assets/places/") && f.endsWith(".jpg")).length).toBeGreaterThanOrEqual(8);
  });

  it("bundles every photo the store requires", async () => {
    const store = await import("node:fs/promises").then((fs) => fs.readFile(path.join(demoDir(), "lib/store.ts"), "utf8"));
    const required = [...store.matchAll(/require\("\.\.\/(assets\/places\/[^"]+)"\)/g)].map((m) => m[1]);
    expect(required.length).toBeGreaterThanOrEqual(8);
    for (const r of required) expect(existsSync(path.join(demoDir(), r))).toBe(true);
  });

  it("merges app.json patches and keeps the rest", () => {
    const base = { expo: { name: "Sparkflow App", slug: "sparkflow-app", plugins: ["a", "b"], ios: { bundleIdentifier: "x" } } };
    expect(mergeJson(base, { expo: { name: "Wander", plugins: ["c"] } })).toEqual({
      expo: { name: "Wander", slug: "sparkflow-app", plugins: ["c"], ios: { bundleIdentifier: "x" } },
    });
  });

  it("writes the overlay into a sandbox and drops the kit gallery", async () => {
    const written = new Map<string, string | Buffer>();
    const commands: string[] = [];
    const sb = {
      exec: async (c: string) => (commands.push(c), { code: 0, stdout: "", stderr: "", timedOut: false }),
      readFile: async () => JSON.stringify({ expo: { name: "Sparkflow App", slug: "sparkflow-app" } }),
      writeFile: async (rel: string, content: string | Buffer) => void written.set(rel, content),
    } as unknown as Sandbox;
    await applyDemoOverlay(sb);
    expect(commands).toContain("rm -f app/index.tsx");
    expect(written.has("app/(tabs)/index.tsx")).toBe(true);
    expect(written.has("plan.json")).toBe(false);
    expect(JSON.parse(String(written.get("app.json"))).expo).toEqual({ name: "Wander", slug: "sparkflow-app" });
  });
});

describe("demo seeding flag", () => {
  const prev = process.env.SPARKFLOW_DATA_DIR;
  let dir = "";
  afterEach(async () => {
    if (prev === undefined) delete process.env.SPARKFLOW_DATA_DIR;
    else process.env.SPARKFLOW_DATA_DIR = prev;
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it("seeds until built, rebuilds a failed demo, never over a user's Wander", async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "sf-seed-"));
    process.env.SPARKFLOW_DATA_DIR = dir;
    const habits = { id: "a", name: "Habits", prompt: "habits" };
    const demo = { id: "b-demo", name: "Wander", prompt: DEMO_PROMPT };
    expect(await demoAction([habits])).toEqual({ kind: "create" });
    // Created but not built yet (or its build failed): rebuilt, not created twice.
    expect(await demoAction([habits, demo])).toEqual({ kind: "rebuild", id: "b-demo" });
    await markSeeded();
    expect(await demoAction([habits, demo])).toEqual({ kind: "none" });
    await rm(path.join(dir, ".seeded-wander"));
    expect(await demoAction([{ id: "c", name: "wander", prompt: "my own travel app" }])).toEqual({ kind: "skip" });
    expect(existsSync(path.join(dir, ".seeded-wander"))).toBe(true);
  });
});

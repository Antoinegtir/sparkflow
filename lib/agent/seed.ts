import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { AppPlanSchema, type AppPlan } from "../shared";
import type { Sandbox } from "../sandbox/types";
import { repoRoot, stateDir } from "../sandbox/util";

/**
 * The demo app every user finds in My apps: a hand-written app (templates/demo) laid over the Expo template,
 * planned and captured like a generated one, without a model call.
 */
export const DEMO_NAME = "Wander";
export const DEMO_PROMPT = "Wander, a travel app: explore destinations, plan trips, keep favorites. (Sparkflow demo app)";
const FLAG = ".seeded-wander";

export const demoDir = () => path.join(repoRoot(), "templates", "demo");
const flagFile = () => path.join(stateDir(), FLAG);

/** templates/demo/plan.json, validated. */
export async function loadDemoPlan(dir = demoDir()): Promise<AppPlan> {
  return AppPlanSchema.parse(JSON.parse(await readFile(path.join(dir, "plan.json"), "utf8")));
}

/** Overlay files relative to the demo folder; plan.json is metadata, not app source. */
export async function demoFiles(dir = demoDir()): Promise<string[]> {
  const out: string[] = [];
  const walk = async (rel: string) => {
    for (const e of await readdir(path.join(dir, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      if (e.isDirectory()) await walk(r);
      else if (r !== "plan.json") out.push(r);
    }
  };
  await walk("");
  return out.sort();
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Deep merge for JSON config: objects merge, everything else (arrays included) is replaced. */
export function mergeJson(base: unknown, patch: unknown): unknown {
  if (!isObj(base) || !isObj(patch)) return patch;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) out[k] = k in base ? mergeJson(base[k], v) : v;
  return out;
}

/**
 * Writes the overlay into a sandbox holding the template. app.json is a patch merged into the template's
 * (the slug stays, the shared dev client opens apps by it); the kit gallery goes unless the demo has its own "/".
 */
export async function applyDemoOverlay(sb: Sandbox, dir = demoDir()) {
  const files = await demoFiles(dir);
  if (!files.includes("app/index.tsx")) await sb.exec("rm -f app/index.tsx");
  for (const rel of files) {
    const bytes = await readFile(path.join(dir, rel));
    if (rel === "app.json") {
      const base = JSON.parse(await sb.readFile("app.json"));
      await sb.writeFile(rel, JSON.stringify(mergeJson(base, JSON.parse(bytes.toString("utf8"))), null, 2) + "\n");
    } else {
      await sb.writeFile(rel, bytes);
    }
  }
  return files;
}

export const isSeeded = () => existsSync(flagFile());

/** A project is the demo when it was seeded with the demo's prompt (a user's own "Wander" is not). */
export const isDemoProject = (meta: { prompt: string }) => meta.prompt === DEMO_PROMPT;

/**
 * What seeding has to do on this data dir: nothing once the demo was built (the flag), "skip" when a user's own
 * project already has the demo's name, "rebuild" an earlier demo whose build failed, else "create" it.
 */
export async function demoAction(projects: { id: string; name: string; prompt: string }[]): Promise<{ kind: "none" | "skip" | "create" } | { kind: "rebuild"; id: string }> {
  if (process.env.SPARKFLOW_NO_DEMO === "1") return { kind: "none" };
  if (!existsSync(path.join(demoDir(), "plan.json"))) return { kind: "none" };
  if (isSeeded()) return { kind: "none" };
  const demo = projects.find(isDemoProject);
  if (demo) return { kind: "rebuild", id: demo.id };
  if (projects.some((p) => p.name.trim().toLowerCase() === DEMO_NAME.toLowerCase())) {
    await markSeeded();
    return { kind: "skip" };
  }
  return { kind: "create" };
}

/** Written once the demo app was built and captured: it is never seeded again. */
export async function markSeeded() {
  await mkdir(stateDir(), { recursive: true });
  await writeFile(flagFile(), `${new Date().toISOString()}\n`);
}

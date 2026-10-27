import { existsSync } from "node:fs";
import path from "node:path";
import { repoRoot } from "../sandbox/util";

let loaded = false;
/** Loads .env.local then .env from the repo root. Variables already set win. */
export function loadEnv() {
  if (loaded) return;
  loaded = true;
  for (const name of [".env.local", ".env"]) {
    const file = path.join(repoRoot(), name);
    if (!existsSync(file)) continue;
    const before = { ...process.env };
    try {
      process.loadEnvFile(file);
    } catch {
      continue;
    }
    for (const [k, v] of Object.entries(before)) process.env[k] = v;
  }
}

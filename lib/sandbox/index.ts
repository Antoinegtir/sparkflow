import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { LocalDriver } from "./local";
import type { SandboxDriver } from "./types";

export * from "./types";

/**
 * modal in the cloud (SPARKFLOW_CLOUD) when Modal credentials exist, else local: a Mac with a Modal
 * token of its own still builds on itself. SPARKFLOW_SANDBOX forces one.
 */
export async function createDriver(): Promise<SandboxDriver> {
  const forced = process.env.SPARKFLOW_SANDBOX;
  const hasModal =
    (process.env.MODAL_TOKEN_ID && process.env.MODAL_TOKEN_SECRET) ||
    existsSync(process.env.MODAL_CONFIG_PATH ?? path.join(os.homedir(), ".modal.toml"));
  if (forced === "modal" || (!forced && process.env.SPARKFLOW_CLOUD === "1" && hasModal)) {
    try {
      const { ModalDriver } = await import("./modal");
      return new ModalDriver();
    } catch (err) {
      console.warn("[sparkflow] Modal driver unavailable, using local:", (err as Error).message);
    }
  }
  return new LocalDriver();
}

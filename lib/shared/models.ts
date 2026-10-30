import type { Phase } from "./events";

/**
 * The Meta models behind each step of the agent loop, as shown in the app (Activity, the prompt bar):
 * a model id ("muse-wonder-1.0") as its product name, and the model a step uses when an older event
 * didn't record it.
 */
export function modelName(id?: string | null): string | null {
  if (!id) return null;
  const known: Record<string, string> = { "sam-3.1": "SAM 3.1" };
  if (known[id]) return known[id];
  const m = /^muse-([a-z]+)-?([\d.]+)?$/.exec(id);
  if (!m) return id;
  return `Muse ${m[1][0].toUpperCase()}${m[1].slice(1)}${m[2] ? ` ${m[2]}` : ""}`;
}

export const DEFAULT_PHASE_MODEL: Partial<Record<Phase, string>> = { planner: "muse-spark-1.3", builder: "muse-wonder-1.0", verifier: "muse-spark-1.3" };

/** What each step of the loop does, for the legend and tooltips. */
export const PHASE_ROLE: Partial<Record<Phase, string>> = {
  sandbox: "Prepares the app's sandbox and its live preview",
  planner: "Plans the pages, their content and how they link",
  builder: "Writes the React Native code",
  verifier: "Screenshots each page and checks it against its criteria",
};

/** Tools that call a Meta model themselves (the builder uses them on its own). */
export const TOOL_MODEL: Record<string, string> = { generate_image: "muse-image-1.0", segment: "sam-3.1" };

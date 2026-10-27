import type { z } from "zod";
import {
  AppPlanSchema,
  LLMPlanSchema,
  LLMVerdictSchema,
  matchRoute,
  normalizeRoute,
  planFromLLM,
  previewPathFor,
  routeToPath,
  type AgentEvent,
  type AppPlan,
  type MediaInput,
  type ScreenPlan,
  type Verdict,
} from "../shared";
import type { InspectTargetResult } from "../sandbox/types";
import type { ChatMessage, ContentPart, LLMProvider } from "./llm/types";
import { PLANNER_SYSTEM, VERIFIER_SYSTEM } from "./prompts";
import { parseJsonLoose, toJsonSchema } from "./schema";
import { DEFAULT_TOOLS, executeTool, toImageParts, toolSpecs, type ToolContext, type ToolName } from "./tools";
import type { UsageMeter } from "./usage";

export type RoleDeps = { provider: LLMProvider; meter: UsageMeter; signal?: AbortSignal; emit: (e: AgentEvent) => void };

/** One strict-schema call, validated with zod, with one repair retry. */
export async function structured<S extends z.ZodType>(deps: RoleDeps, role: "planner" | "verifier", name: string, schema: S, messages: ChatMessage[]): Promise<z.infer<S>> {
  const json = toJsonSchema(schema);
  let msgs = messages;
  for (let attempt = 0; attempt < 2; attempt++) {
    deps.meter.check();
    const res = await deps.provider.chat({ role, messages: msgs, jsonSchema: { name, schema: json }, signal: deps.signal });
    deps.meter.record(res);
    try {
      return schema.parse(parseJsonLoose(res.content ?? ""));
    } catch (err) {
      if (attempt === 1) throw err;
      msgs = [
        ...msgs,
        { role: "assistant", content: res.content },
        { role: "user", content: `Your output did not match the required JSON schema: ${String((err as Error).message).slice(0, 1500)}\nReturn ONLY the corrected JSON object.` },
      ];
    }
  }
  throw new Error("unreachable");
}

const audioPart = (a: MediaInput): ContentPart => ({ type: "audio", format: a.mediaType.includes("mp3") || a.mediaType.includes("mpeg") ? "mp3" : "wav", data: a.data });

export async function runPlanner(deps: RoleDeps, input: { prompt: string; image?: MediaInput; audio?: MediaInput; segments?: string }): Promise<AppPlan> {
  const parts: ContentPart[] = [
    { type: "text", text: input.prompt.trim() ? `User request:\n${input.prompt.trim()}` : "Build the app shown/described in the attachment." },
  ];
  if (input.image) {
    parts.push({ type: "image", mediaType: input.image.mediaType, data: input.image.data, detail: "high" });
    if (input.segments) parts.push({ type: "text", text: `Detected UI regions (positions in % of the image):\n${input.segments}` });
  }
  if (input.audio) parts.push(audioPart(input.audio));
  const raw = await structured(deps, "planner", "app_plan", LLMPlanSchema, [
    { role: "system", content: PLANNER_SYSTEM },
    { role: "user", content: parts },
  ]);
  return normalizePlan(planFromLLM(raw));
}

/** Makes the plan consistent: app/ prefix and .tsx, routes from files, unique routes, one owner for "/", loose navigatesTo resolved. */
export function normalizePlan(plan: AppPlan): AppPlan {
  const seen = new Set<string>();
  let screens: ScreenPlan[] = [];
  for (const s of plan.screens) {
    let file = s.file.replace(/^\.?\//, "");
    if (!file.startsWith("app/")) file = "app/" + file;
    if (!/\.(tsx|ts|jsx|js)$/.test(file)) file += ".tsx";
    const route = normalizeRoute(file);
    if (seen.has(route)) continue;
    seen.add(route);
    screens.push({ ...s, file, route, previewPath: s.previewPath && s.previewPath.startsWith("/") ? s.previewPath : previewPathFor(route) });
  }
  if (screens.some((s) => s.file === "app/(tabs)/index.tsx")) screens = screens.filter((s) => s.file !== "app/index.tsx");
  const routes = screens.map((s) => s.route);
  const resolve = (t: string) => {
    const n = normalizeRoute(t);
    return (
      routes.find((r) => r === n) ??
      routes.find((r) => routeToPath(r) === routeToPath(n)) ??
      matchRoute(routeToPath(n).replace(/\[[^\]]+\]/g, "1"), routes)
    );
  };
  screens = screens.map((s) => ({ ...s, navigatesTo: [...new Set(s.navigatesTo.map(resolve).filter((r): r is string => !!r && r !== s.route))] }));
  return AppPlanSchema.parse({ ...plan, screens });
}

const TOOL_LOG_ARGS = 120;

function pruneImages(messages: ChatMessage[]) {
  const withImages = messages.map((m, i) => (m.role === "user" && Array.isArray(m.content) && m.content.some((p) => p.type === "image") ? i : -1)).filter((i) => i > 0);
  const old = new Set(withImages.slice(0, -2));
  return messages.map((m, i) =>
    old.has(i) && m.role === "user" && Array.isArray(m.content)
      ? { ...m, content: m.content.map((p) => (p.type === "image" ? { type: "text" as const, text: "[older screenshot removed]" } : p)) }
      : m,
  );
}

export type BuilderInput = {
  system: string;
  task: string;
  images?: { mediaType: string; data: string; caption: string }[];
  audio?: MediaInput;
  maxTurns: number;
  tools?: ToolName[];
  route?: string;
};

/** Tool loop. Returns the finish summary, or null when the builder stopped without finishing. */
export async function runBuilderTask(deps: RoleDeps, ctx: ToolContext, input: BuilderInput): Promise<string | null> {
  const first: ContentPart[] = [{ type: "text", text: input.task }];
  for (const img of input.images ?? []) first.push({ type: "text", text: img.caption }, { type: "image", mediaType: img.mediaType, data: img.data, detail: "high" });
  if (input.audio) first.push(audioPart(input.audio));
  let messages: ChatMessage[] = [{ role: "system", content: input.system }, { role: "user", content: first }];
  const tools = toolSpecs(input.tools ?? DEFAULT_TOOLS);
  let nudged = false;
  ctx.finished = undefined;
  for (let turn = 0; turn < input.maxTurns; turn++) {
    if (deps.signal?.aborted) throw new Error("Stopped");
    deps.meter.check();
    messages = pruneImages(messages);
    const res = await deps.provider.chat({ role: "builder", messages, tools, signal: deps.signal });
    deps.meter.record(res);
    messages.push({ role: "assistant", content: res.content, toolCalls: res.toolCalls });
    if (!res.toolCalls.length) {
      if (nudged) return null;
      nudged = true;
      messages.push({ role: "user", content: "Continue with tool calls. When the task is complete and typecheck passes, call finish." });
      continue;
    }
    const images: ContentPart[] = [];
    for (const call of res.toolCalls) {
      let args = call.arguments;
      if (call.name === "write_file") {
        try {
          args = JSON.parse(call.arguments).path;
        } catch {}
      }
      deps.emit({ type: "log", level: "info", message: `🔧 ${call.name} ${args.slice(0, TOOL_LOG_ARGS)}`, route: input.route });
      const out = await executeTool(ctx, call.name, call.arguments);
      if (out.text.startsWith("Error:")) deps.emit({ type: "log", level: "error", message: `↳ ${out.text.slice(0, 300)}`, route: input.route });
      messages.push({ role: "tool", toolCallId: call.id, content: out.text });
      images.push(...toImageParts(out));
    }
    if (images.length) messages.push({ role: "user", content: images });
    if (ctx.finished !== undefined) return ctx.finished;
  }
  deps.emit({ type: "log", level: "error", message: `Builder reached the ${input.maxTurns}-turn limit`, route: input.route });
  return null;
}

export function runtimeProblems(r: InspectTargetResult) {
  const out: string[] = [];
  if (r.error) out.push(`Navigation failed: ${r.error}`);
  if (r.errorOverlay) out.push(`Error on screen: ${r.bodyText.slice(0, 600)}`);
  out.push(...r.pageErrors.slice(0, 3).map((e) => `Uncaught: ${e}`));
  return out;
}

export async function runVerifier(deps: RoleDeps, screen: ScreenPlan, r: InspectTargetResult, extraCriteria: string[] = []): Promise<Verdict> {
  const criteria = [...screen.acceptance, ...extraCriteria];
  const problems = runtimeProblems(r);
  const failAll = (reason: string): Verdict => ({
    route: screen.route,
    criteria: criteria.map((text) => ({ text, pass: false, reason })),
    defects: problems.map((description) => ({ severity: "high" as const, description })).concat(problems.length ? [] : [{ severity: "high", description: reason }]),
  });
  // A broken screen fails everything without spending a model call.
  if (problems.length && (r.errorOverlay || !r.ok)) return failAll("The screen does not render.");
  if (!r.screenshot) return failAll("Screenshot failed.");
  const ids = r.testIds
    .slice(0, 80)
    .map((t) => `${t.id} @ ${Math.round(t.rect.x)},${Math.round(t.rect.y)} ${Math.round(t.rect.width)}×${Math.round(t.rect.height)}${t.text ? ` "${t.text.slice(0, 40)}"` : ""}`);
  const text = `Screen: ${screen.title}
Route: ${screen.route} (opened at ${r.finalPath})
Purpose: ${screen.purpose}

Acceptance criteria:
${criteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}

data-testid elements:
${ids.join("\n") || "none"}

Accessibility tree:
${r.aria.slice(0, 3000)}
${problems.length ? `\nRuntime problems:\n${problems.join("\n")}` : ""}${r.console.length ? `\nConsole errors:\n${r.console.slice(0, 5).join("\n")}` : ""}`;
  const raw = await structured(deps, "verifier", "verdict", LLMVerdictSchema, [
    { role: "system", content: VERIFIER_SYSTEM },
    { role: "user", content: [{ type: "text", text }, { type: "image", mediaType: "image/png", data: r.screenshot.toString("base64"), detail: "high" }] },
  ]);
  return {
    route: screen.route,
    // The model may rephrase: keep the planned texts, matched by position.
    criteria: criteria.map((t, i) => ({ text: t, pass: raw.criteria[i]?.pass ?? false, reason: raw.criteria[i]?.reason ?? "Not evaluated." })),
    defects: [
      ...raw.defects.map((d) => ({ severity: d.severity, description: d.description, ...(d.testId ? { testId: d.testId } : {}) })),
      ...problems.map((description) => ({ severity: "high" as const, description })),
    ],
  };
}

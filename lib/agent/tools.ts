import { z } from "zod";
import { matchRoute, normalizeRoute, routeSlug, type AgentEvent, type AppPlan } from "../shared";
import type { InspectStep, Sandbox } from "../sandbox/types";
import type { ContentPart, ToolSpec } from "./llm/types";
import { generateImage, IMAGE_SIZES, segmentUI, describeSegments } from "./meta";
import { toJsonSchema } from "./schema";
import { skillByName, SKILLS } from "./skills";

export const PROTECTED = [
  /^app\/\+html\.tsx$/,
  /^components\/sparkflow\//,
  /^components\/kit\//,
  /^constants\/theme\.ts$/,
  /^constants\/palette\.(js|d\.ts)$/,
  /^(babel|metro|tailwind)\.config\.js$/,
  /^eslint\.config\.(js|mjs)$/,
  /^(tsconfig|package|package-lock)\.json$/,
  /^global\.css$/,
  /^AGENT_RULES\.md$/,
  /^node_modules\//,
  /^\.git\//,
];

export type ToolContext = {
  sandbox: Sandbox;
  plan?: AppPlan;
  emit: (e: AgentEvent) => void;
  signal?: AbortSignal;
  local: boolean;
  /** Muse Image / SAM available (a key and not mock). */
  media: boolean;
  /** Files written or deleted during this task. */
  touched: Set<string>;
  finished?: string;
  /** Protected paths may be written (native projects own their whole folder). */
  unrestricted?: boolean;
  commit?: (message: string) => Promise<string | null>;
};

export type ToolResult = { text: string; images?: { mediaType: string; data: string; caption: string }[] };

export function cleanPath(p: string) {
  const s = p.trim().replace(/^\.\//, "").replace(/^\/+/, "");
  if (!s || s.split("/").includes("..")) throw new Error(`Invalid path: ${p}`);
  return s;
}

function assertWritable(ctx: ToolContext, p: string) {
  if (!ctx.unrestricted && PROTECTED.some((re) => re.test(p))) throw new Error(`${p} is protected and cannot be changed`);
}

const ALLOW = [/^npx tsc\b/, /^npx expo install\b/, /^npx expo lint\b/, /^npm ls\b/, /^(ls|cat|grep|head|tail|wc|find)\b/, /^git (status|diff|log|show)\b/];

/** Local driver only: no sandbox around the shell, so allow a few read-only commands. */
function allowedLocally(cmd: string) {
  if (/[;&<>`]|\$\(/.test(cmd)) return false;
  return cmd.split("|").every((part) => ALLOW.some((re) => re.test(part.trim())));
}

/** "path(line,col): error TSxxxx: message" lines, at most 40. */
export function parseTsc(out: string) {
  const errors = [...out.matchAll(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/gm)].map((m) => `${m[1]}:${m[2]}:${m[3]} ${m[4]} ${m[5]}`);
  return errors;
}

export async function typecheck(sandbox: Sandbox) {
  const r = await sandbox.exec("npx tsc --noEmit --pretty false -p .", { timeoutSec: 180 });
  const out = r.stdout + r.stderr;
  const errors = parseTsc(out);
  return { ok: r.code === 0, errors, text: r.code === 0 ? "Typecheck passed." : errors.length ? `${errors.length} error(s):\n${errors.slice(0, 40).join("\n")}` : out.slice(-4000) };
}

/** Planned route or URL path → the URL path to open. */
function pathFor(ctx: ToolContext, route: string) {
  const r = route.trim();
  const planned = ctx.plan?.screens.find((s) => s.route === normalizeRoute(r));
  if (planned) return planned.previewPath ?? "/";
  if (ctx.plan && matchRoute(r, ctx.plan.screens.map((s) => s.route))) return r;
  return r.startsWith("/") ? r : "/" + r;
}

const Step = z.discriminatedUnion("action", [
  z.object({ action: z.literal("click"), testId: z.string() }),
  z.object({ action: z.literal("fill"), testId: z.string(), value: z.string() }),
  z.object({ action: z.literal("press"), key: z.string() }),
  z.object({ action: z.literal("scroll"), y: z.number() }),
  z.object({ action: z.literal("wait"), ms: z.number() }),
  z.object({ action: z.literal("goto"), path: z.string() }),
]);

type Def<S extends z.ZodType> = { description: string; schema: S; run: (ctx: ToolContext, args: z.infer<S>) => Promise<ToolResult | string> };
const def = <S extends z.ZodType>(d: Def<S>) => d;

const png = (b: Buffer, caption: string) => ({ mediaType: "image/png", data: b.toString("base64"), caption });

export const TOOLS = {
  list_files: def({
    description: "List project files (node_modules and build folders excluded).",
    schema: z.object({ dir: z.string().optional() }),
    run: async (ctx, a) => (await ctx.sandbox.listFiles(a.dir ? cleanPath(a.dir) : undefined)).join("\n") || "(empty)",
  }),
  read_file: def({
    description: "Read a text file.",
    schema: z.object({ path: z.string() }),
    run: async (ctx, a) => {
      const t = await ctx.sandbox.readFile(cleanPath(a.path));
      return t.length > 60000 ? t.slice(0, 60000) + "\n… (truncated)" : t;
    },
  }),
  write_file: def({
    description: "Create or overwrite a file with its complete content.",
    schema: z.object({ path: z.string(), content: z.string() }),
    run: async (ctx, a) => {
      const p = cleanPath(a.path);
      assertWritable(ctx, p);
      await ctx.sandbox.writeFile(p, a.content);
      ctx.touched.add(p);
      ctx.emit({ type: "files_changed", files: [p] });
      return `Wrote ${p} (${a.content.length} chars).`;
    },
  }),
  apply_patch: def({
    description: "Replace exact snippets in a file. Each `old` must appear exactly once, unless `all: true` (then every occurrence is replaced).",
    schema: z.object({ path: z.string(), edits: z.array(z.object({ old: z.string(), new: z.string(), all: z.boolean().optional() })).min(1) }),
    run: async (ctx, a) => {
      const p = cleanPath(a.path);
      assertWritable(ctx, p);
      let text = await ctx.sandbox.readFile(p);
      for (const [i, e] of a.edits.entries()) {
        const count = text.split(e.old).length - 1;
        if (e.all && count > 0) {
          text = text.split(e.old).join(e.new);
          continue;
        }
        if (count !== 1)
          throw new Error(`Edit ${i + 1}: the old text appears ${count} times in ${p}; it must appear exactly once (add more context, or set all: true to replace every occurrence).`);
        text = text.replace(e.old, () => e.new);
      }
      await ctx.sandbox.writeFile(p, text);
      ctx.touched.add(p);
      ctx.emit({ type: "files_changed", files: [p] });
      return `Patched ${p} (${a.edits.length} edit(s)).`;
    },
  }),
  delete_file: def({
    description: "Delete a file.",
    schema: z.object({ path: z.string() }),
    run: async (ctx, a) => {
      const p = cleanPath(a.path);
      assertWritable(ctx, p);
      await ctx.sandbox.exec(`rm -f -- '${p.replace(/'/g, "")}'`);
      ctx.touched.add(p);
      ctx.emit({ type: "files_changed", files: [p] });
      return `Deleted ${p}.`;
    },
  }),
  run: def({
    description: "Run a shell command in the project folder.",
    schema: z.object({ command: z.string(), timeoutSec: z.number().optional() }),
    run: async (ctx, a) => {
      if (ctx.local && !allowedLocally(a.command)) {
        throw new Error("Not allowed here. Allowed: npx tsc, npx expo install/lint, npm ls, ls, cat, grep, head, tail, wc, find, git status/diff/log/show (pipes ok).");
      }
      const r = await ctx.sandbox.exec(a.command, { timeoutSec: Math.min(600, a.timeoutSec ?? 120) });
      return `exit ${r.code}${r.timedOut ? " (timed out)" : ""}\n${(r.stdout + r.stderr).slice(-8000)}`;
    },
  }),
  typecheck: def({
    description: "Run the TypeScript compiler on the project.",
    schema: z.object({}),
    run: async (ctx) => (await typecheck(ctx.sandbox)).text,
  }),
  start_app: def({
    description: "Start the Metro dev server if it is not running.",
    schema: z.object({}),
    run: async (ctx) => {
      const p = await ctx.sandbox.startDevServer();
      return `Running at ${p.webUrl}`;
    },
  }),
  app_logs: def({
    description: "Last lines of the Metro dev server output.",
    schema: z.object({ lines: z.number().max(400).optional() }),
    run: async (ctx, a) => ctx.sandbox.devServerLogs(a.lines ?? 120) || "(no output)",
  }),
  screenshot: def({
    description: "Open a route (planned route or URL path) at 390×844 and return a screenshot, issues and testIDs.",
    schema: z.object({ route: z.string() }),
    run: async (ctx, a) => {
      const [r] = await ctx.sandbox.inspect({ targets: [{ name: "shot", path: pathFor(ctx, a.route) }] });
      const issues = [
        r.error && `Navigation error: ${r.error}`,
        r.errorOverlay && `Error on screen: ${r.bodyText.slice(0, 600)}`,
        ...r.pageErrors.slice(0, 3).map((e) => `Uncaught: ${e}`),
        ...r.console.filter((c) => c.startsWith("error")).slice(0, 5),
      ].filter(Boolean);
      const ids = r.testIds.slice(0, 50).map((t) => `${t.id}${t.text ? ` "${t.text.slice(0, 40)}"` : ""}`);
      return {
        text: `${r.finalPath} — ${issues.length ? `Issues:\n${issues.join("\n")}` : "no issues"}\ntestIDs: ${ids.join(", ") || "none"}`,
        images: r.screenshot ? [png(r.screenshot, `Screenshot of ${r.finalPath}`)] : [],
      };
    },
  }),
  ui_tree: def({
    description: "Accessibility tree and testIDs with positions for a route.",
    schema: z.object({ route: z.string() }),
    run: async (ctx, a) => {
      const [r] = await ctx.sandbox.inspect({ targets: [{ name: "tree", path: pathFor(ctx, a.route) }] });
      const ids = r.testIds.map((t) => `${t.id} @ ${Math.round(t.rect.x)},${Math.round(t.rect.y)} ${Math.round(t.rect.width)}×${Math.round(t.rect.height)}`);
      return `${r.aria}\n\ntestIDs:\n${ids.join("\n")}`;
    },
  }),
  interact: def({
    description: "Open a route and run 1–8 steps (click/fill by testId, press a key, scroll, wait, goto). Returns the last screenshots.",
    schema: z.object({ route: z.string(), steps: z.array(Step).min(1).max(8) }),
    run: async (ctx, a) => {
      const [r] = await ctx.sandbox.inspect({ targets: [{ name: "interact", path: pathFor(ctx, a.route), steps: a.steps as InspectStep[], shotAfterEachStep: true }] });
      const shots = r.stepShots.slice(-4);
      return {
        text: `Ended on ${r.finalPath}. ${r.error ? `Error: ${r.error}` : ""}${r.pageErrors.length ? `\nUncaught: ${r.pageErrors.slice(0, 3).join("\n")}` : ""}`,
        images: shots.map((s, i) => png(s, `After step ${a.steps.length - shots.length + i + 1}`)),
      };
    },
  }),
  generate_image: def({
    description: "Generate an image with Muse Image and save it under assets/images/.",
    schema: z.object({ prompt: z.string(), name: z.string(), aspect: z.enum(["square", "portrait", "landscape"]) }),
    run: async (ctx, a) => {
      if (!ctx.media) return "Image generation is unavailable here. Use an Ionicons icon or a tinted View instead.";
      const bytes = await generateImage(a.prompt, a.aspect as keyof typeof IMAGE_SIZES, ctx.signal);
      const file = `assets/images/${routeSlug("/" + a.name).toLowerCase()}.png`;
      await ctx.sandbox.writeFile(file, bytes);
      ctx.touched.add(file);
      return `Saved ${file}. Use it with: <Image source={require("@/${file}")} style={{ width: 120, height: 120 }} /> (Image from "expo-image").`;
    },
  }),
  segment: def({
    description: "Find UI regions (buttons, cards, rows…) in a project image with SAM 3.1.",
    schema: z.object({ path: z.string() }),
    run: async (ctx, a) => {
      if (!ctx.media) return "Segmentation is unavailable here.";
      const bytes = await ctx.sandbox.readFileBytes(cleanPath(a.path));
      const segs = await segmentUI({ mediaType: a.path.endsWith(".png") ? "image/png" : "image/jpeg", data: bytes.toString("base64") }, undefined, ctx.signal);
      return describeSegments(segs) || "Nothing found.";
    },
  }),
  commit: def({
    description: "Commit the current changes with a message.",
    schema: z.object({ message: z.string() }),
    run: async (ctx, a) => {
      const sha = (await ctx.commit?.(a.message)) ?? null;
      return sha ? `Committed ${sha}.` : "Nothing to commit.";
    },
  }),
  skill: def({
    description: "Read a mobile skill (an exact recipe for an iOS / Android feature: liquid-glass, haptics, animations, sheets…). See the index in the system prompt.",
    schema: z.object({ name: z.string() }),
    run: async (_ctx, a) => {
      const s = skillByName(a.name);
      if (!s) return `Error: no skill "${a.name}". Skills: ${SKILLS.map((x) => x.name).join(", ")}.`;
      return `# ${s.title}\n\n${s.body}`;
    },
  }),
  finish: def({
    description: "Finish the task with a 1–2 sentence summary for the user.",
    schema: z.object({ summary: z.string() }),
    run: async (ctx, a) => {
      ctx.finished = a.summary;
      return "Finished.";
    },
  }),
};

export type ToolName = keyof typeof TOOLS;

export const DEFAULT_TOOLS: ToolName[] = [
  "list_files", "read_file", "write_file", "apply_patch", "delete_file", "run", "typecheck",
  "app_logs", "screenshot", "ui_tree", "interact", "generate_image", "skill", "finish",
];

export const toolSpecs = (names: ToolName[]): ToolSpec[] =>
  names.map((n) => ({ name: n, description: TOOLS[n].description, parameters: toJsonSchema(TOOLS[n].schema, { strict: false }) }));

/** Runs one call. Every failure comes back as "Error: …" text for the model. */
export async function executeTool(ctx: ToolContext, name: string, rawArgs: string): Promise<ToolResult> {
  const tool = TOOLS[name as ToolName];
  if (!tool) return { text: `Error: unknown tool ${name}` };
  let args: unknown;
  try {
    args = JSON.parse(rawArgs || "{}");
  } catch {
    return { text: "Error: arguments are not valid JSON" };
  }
  const parsed = tool.schema.safeParse(args);
  if (!parsed.success) return { text: `Error: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}` };
  try {
    const r = await (tool.run as (c: ToolContext, a: unknown) => Promise<ToolResult | string>)(ctx, parsed.data);
    return typeof r === "string" ? { text: r } : r;
  } catch (err) {
    return { text: `Error: ${String((err as Error).message ?? err).slice(0, 3000)}` };
  }
}

export const toImageParts = (r: ToolResult): ContentPart[] =>
  (r.images ?? []).flatMap((i) => [{ type: "text" as const, text: i.caption }, { type: "image" as const, mediaType: i.mediaType, data: i.data, detail: "high" as const }]);

/** git add + commit as the Sparkflow agent. Returns the short sha, or null when nothing changed. */
export async function gitCommit(sandbox: Sandbox, message: string) {
  // Only commit inside the sandbox's own repository.
  if ((await sandbox.exec("test -d .git")).code !== 0) return null;
  const msg = message.replace(/[`$\\]/g, "").replace(/'/g, "’").slice(0, 200);
  await sandbox.exec("git add -A");
  const diff = await sandbox.exec("git diff --cached --quiet");
  if (diff.code === 0) return null;
  const r = await sandbox.exec(`git -c user.name=Sparkflow -c user.email=agent@sparkflow.dev commit -q -m '${msg}' && git rev-parse --short HEAD`);
  return r.code === 0 ? r.stdout.trim().split("\n").pop() || null : null;
}

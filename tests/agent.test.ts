import { afterEach, describe, expect, it, vi } from "vitest";
import { chatCompletions } from "../lib/agent/llm/openai-compatible";
import { edgesFromSources } from "../lib/agent/nav";
import { normalizePlan } from "../lib/agent/roles";
import { parseJsonLoose, toJsonSchema } from "../lib/agent/schema";
import { LLMPlanSchema } from "../lib/shared";

describe("plan normalization", () => {
  it("fixes files, drops a duplicate root and resolves loose links", () => {
    const plan = normalizePlan({
      name: "X",
      theme: { primary: "#000", background: "#fff" },
      dataModel: [],
      screens: [
        { route: "", file: "(tabs)/index", title: "Home", purpose: "", components: [], navigatesTo: ["/habit/1"], acceptance: [] },
        { route: "", file: "app/index.tsx", title: "Dup", purpose: "", components: [], navigatesTo: [], acceptance: [] },
        { route: "", file: "app/habit/[id].tsx", title: "Habit", purpose: "", components: [], navigatesTo: [], acceptance: [] },
      ],
    });
    expect(plan.screens.map((s) => s.route)).toEqual(["/(tabs)/index", "/habit/[id]"]);
    expect(plan.screens[0].navigatesTo).toEqual(["/habit/[id]"]);
    expect(plan.screens[1].previewPath).toBe("/habit/1");
  });
});

describe("navigation from code", () => {
  it("finds links to planned routes", () => {
    const edges = edgesFromSources([{ route: "/(tabs)/index", source: "router.push(`/habit/${h.id}`); <Link href=\"/stats\" />" }], ["/(tabs)/index", "/(tabs)/stats", "/habit/[id]"]);
    expect(edges.map((e) => e.to).sort()).toEqual(["/(tabs)/stats", "/habit/[id]"]);
  });
});

describe("schemas", () => {
  it("makes every object strict", () => {
    const s = toJsonSchema(LLMPlanSchema) as any;
    expect(s.additionalProperties).toBe(false);
    expect(s.properties.theme.required).toEqual(["primary", "background", "font"]);
  });
  it("parses JSON loosely", () => {
    expect(parseJsonLoose('Sure:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonLoose('noise {"b":2} tail')).toEqual({ b: 2 });
  });
});

describe("streaming client", () => {
  afterEach(() => vi.unstubAllGlobals());
  const sse = (chunks: object[]) =>
    new Response(new ReadableStream({ start(c) { for (const ch of chunks) c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(ch)}\n\n`)); c.enqueue(new TextEncoder().encode("data: [DONE]\n\n")); c.close(); } }));

  it("assembles tool calls from deltas and reads usage", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => sse([
      { choices: [{ delta: { tool_calls: [{ index: 0, id: "c1", function: { name: "write_", arguments: '{"pa' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { name: "file", arguments: 'th":"a"}' } }] } }] },
      { usage: { prompt_tokens: 10, completion_tokens: 5, prompt_tokens_details: { cached_tokens: 4 } }, choices: [] },
    ])));
    const r = await chatCompletions({ baseUrl: "http://x", apiKey: "k" }, "m", { role: "builder", messages: [] });
    expect(r.toolCalls).toEqual([{ id: "c1", name: "write_file", arguments: '{"path":"a"}' }]);
    expect(r.usage).toEqual({ inputTokens: 10, outputTokens: 5, cachedTokens: 4 });
  });

  it("retries on 429", async () => {
    const f = vi.fn().mockResolvedValueOnce(new Response("slow down", { status: 429, headers: { "retry-after": "0.01" } })).mockResolvedValueOnce(sse([{ choices: [{ delta: { content: "ok" } }] }]));
    vi.stubGlobal("fetch", f);
    const r = await chatCompletions({ baseUrl: "http://x", apiKey: "k" }, "m", { role: "other", messages: [] });
    expect(r.content).toBe("ok");
    expect(f).toHaveBeenCalledTimes(2);
  });
});

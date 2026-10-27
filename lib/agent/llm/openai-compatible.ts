import type { ChatMessage, ChatRequest, ChatResponse, ContentPart, ToolCall } from "./types";

export class LLMHttpError extends Error {
  constructor(
    public status: number,
    body: string,
  ) {
    super(`LLM HTTP ${status}: ${body.slice(0, 500)}`);
  }
}

type Opts = { baseUrl: string; apiKey: string; reasoningEffort?: string };

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((res, rej) => {
    const t = setTimeout(res, ms);
    signal?.addEventListener("abort", () => (clearTimeout(t), rej(new Error("aborted"))), { once: true });
  });

function part(p: ContentPart) {
  if (p.type === "text") return { type: "text", text: p.text };
  if (p.type === "image") return { type: "image_url", image_url: { url: `data:${p.mediaType};base64,${p.data}`, detail: p.detail ?? "auto" } };
  return { type: "input_audio", input_audio: { data: p.data, format: p.format } };
}

function wire(m: ChatMessage) {
  switch (m.role) {
    case "system":
      return { role: "system", content: m.content };
    case "user":
      return { role: "user", content: typeof m.content === "string" ? m.content : m.content.map(part) };
    case "assistant":
      return {
        role: "assistant",
        content: m.content,
        ...(m.toolCalls?.length
          ? { tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.arguments } })) }
          : {}),
      };
    case "tool":
      return { role: "tool", tool_call_id: m.toolCallId, content: m.content };
  }
}

/** Streaming chat completions client (Meta's Model API and OpenAI speak the same dialect). */
export async function chatCompletions(opts: Opts, model: string, req: ChatRequest): Promise<ChatResponse> {
  // Long non-streaming calls time out (504) on Meta's gateway, so always stream.
  const body: Record<string, unknown> = {
    model,
    messages: req.messages.map(wire),
    stream: true,
    stream_options: { include_usage: true },
    max_completion_tokens: req.maxTokens ?? 32000,
  };
  if (opts.reasoningEffort) body.reasoning_effort = opts.reasoningEffort;
  if (req.tools?.length) {
    body.tools = req.tools.map((t) => ({ type: "function", function: t }));
    body.parallel_tool_calls = true;
  }
  if (req.jsonSchema) {
    body.response_format = { type: "json_schema", json_schema: { name: req.jsonSchema.name, schema: req.jsonSchema.schema, strict: true } };
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${opts.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${opts.apiKey}` },
        body: JSON.stringify(body),
        signal: req.signal,
      });
    } catch (err) {
      if (req.signal?.aborted) throw err;
      lastErr = err;
      await sleep(1500 * 2 ** attempt, req.signal);
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      lastErr = new LLMHttpError(res.status, await res.text().catch(() => ""));
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(retryAfter > 0 ? retryAfter * 1000 : 1500 * 2 ** attempt, req.signal);
      continue;
    }
    if (!res.ok) throw new LLMHttpError(res.status, await res.text().catch(() => ""));
    return readStream(res, model);
  }
  throw lastErr;
}

async function readStream(res: Response, model: string): Promise<ChatResponse> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let content = "";
  const calls: { id?: string; name: string; arguments: string }[] = [];
  const usage = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      let chunk: any;
      try {
        chunk = JSON.parse(data);
      } catch {
        continue;
      }
      if (chunk.error) throw new Error(`LLM stream error: ${JSON.stringify(chunk.error).slice(0, 500)}`);
      if (chunk.usage) {
        usage.inputTokens = chunk.usage.prompt_tokens ?? 0;
        usage.outputTokens = chunk.usage.completion_tokens ?? 0;
        usage.cachedTokens = chunk.usage.prompt_tokens_details?.cached_tokens ?? 0;
      }
      const delta = chunk.choices?.[0]?.delta;
      if (!delta) continue;
      if (typeof delta.content === "string") content += delta.content;
      for (const tc of delta.tool_calls ?? []) {
        const c = (calls[tc.index ?? 0] ??= { name: "", arguments: "" });
        if (tc.id) c.id = tc.id;
        if (tc.function?.name) c.name += tc.function.name;
        if (tc.function?.arguments) c.arguments += tc.function.arguments;
      }
    }
  }
  const toolCalls: ToolCall[] = calls
    .filter(Boolean)
    .map((c, i) => ({ id: c.id ?? `call_${i}_${Date.now()}`, name: c.name, arguments: c.arguments || "{}" }));
  return { content: content || null, toolCalls, usage, model };
}

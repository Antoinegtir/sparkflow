export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image"; mediaType: string; data: string; detail?: "low" | "high" | "auto" }
  | { type: "audio"; format: "wav" | "mp3"; data: string };

export type ToolCall = { id: string; name: string; arguments: string };

export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string | ContentPart[] }
  | { role: "assistant"; content: string | null; toolCalls?: ToolCall[] }
  | { role: "tool"; toolCallId: string; content: string };

export type ToolSpec = { name: string; description: string; parameters: Record<string, unknown> };

export type AgentRole = "planner" | "builder" | "verifier" | "other";

export type ChatRequest = {
  role: AgentRole;
  model?: string;
  messages: ChatMessage[];
  tools?: ToolSpec[];
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  maxTokens?: number;
  signal?: AbortSignal;
};

export type ChatUsage = { inputTokens: number; outputTokens: number; cachedTokens: number };
export type ChatResponse = { content: string | null; toolCalls: ToolCall[]; usage: ChatUsage; model: string };
export type Pricing = { input: number; cached: number; output: number };

export interface LLMProvider {
  name: "muse" | "openai" | "mock";
  chat(req: ChatRequest): Promise<ChatResponse>;
  pricing(model: string): Pricing;
  modelFor(role: AgentRole, opts?: { hasAudio?: boolean }): string;
}

export const hasAudio = (messages: ChatMessage[]) =>
  messages.some((m) => m.role === "user" && Array.isArray(m.content) && m.content.some((p) => p.type === "audio"));

import { loadEnv } from "../env";
import { MockProvider } from "./mock";
import { chatCompletions } from "./chat-completions";
import type { AgentRole, ChatRequest, LLMProvider, Pricing } from "./types";
import { hasAudio } from "./types";

export * from "./types";

const ZERO: Pricing = { input: 0, cached: 0, output: 0 };

/** USD per 1M tokens. */
function musePricing(model: string): Pricing {
  if (model.endsWith("-contributor")) return { input: 0.1, cached: 0.002, output: 0.2 };
  if (model.startsWith("muse-wonder")) return { input: 4, cached: 0.2, output: 20 };
  if (model.startsWith("muse-spark")) return { input: 1.25, cached: 0.15, output: 4.25 };
  return ZERO;
}

const env = (k: string) => process.env[k] || undefined;
const roleKey = (role: AgentRole) => role.toUpperCase();

class MuseProvider implements LLMProvider {
  name = "muse" as const;
  constructor(private apiKey: string) {}
  modelFor(role: AgentRole, opts?: { hasAudio?: boolean }) {
    if (opts?.hasAudio) return env("MUSE_AUDIO_MODEL") ?? "muse-spark-1.2";
    // Writing code goes to Muse Wonder, the most capable; planning and checking stay on Spark.
    return env(`MUSE_MODEL_${roleKey(role)}`) ?? env("MUSE_MODEL") ?? (role === "builder" ? "muse-wonder-1.0" : "muse-spark-1.3");
  }
  pricing = musePricing;
  chat(req: ChatRequest) {
    const model = req.model ?? this.modelFor(req.role, { hasAudio: hasAudio(req.messages) });
    return chatCompletions(
      { baseUrl: env("MUSE_BASE_URL") ?? "https://api.meta.ai/v1", apiKey: this.apiKey, reasoningEffort: env("MUSE_REASONING_EFFORT") ?? "low" },
      model,
      req,
    );
  }
}

export const museKey = () => env("MODEL_API_KEY") ?? env("META_API_KEY");

export function createProvider(): LLMProvider {
  loadEnv();
  const forced = env("SPARKFLOW_LLM");
  const muse = museKey();
  const kind = forced ?? (muse ? "muse" : "mock");
  if (kind === "muse" && muse) return new MuseProvider(muse);
  return new MockProvider();
}

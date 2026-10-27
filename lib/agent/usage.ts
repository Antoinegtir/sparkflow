import type { Usage } from "../shared";
import type { ChatResponse, LLMProvider } from "./llm/types";

export class BudgetExceededError extends Error {
  constructor(cost: number, max: number) {
    super(`Cost ceiling reached ($${cost.toFixed(3)} > $${max}). Raise SPARKFLOW_MAX_COST_USD to continue.`);
  }
}

/** Running token and cost totals for one project. Starts from the folded state so the ceiling survives restarts. */
export class UsageMeter {
  usage: Usage;
  constructor(
    private provider: LLMProvider,
    private maxCostUsd: number,
    private emit: (u: Usage) => void,
    start?: Usage,
  ) {
    this.usage = { ...(start ?? { inputTokens: 0, outputTokens: 0, cachedTokens: 0, costUsd: 0, calls: 0 }) };
  }
  check() {
    if (this.usage.costUsd > this.maxCostUsd) throw new BudgetExceededError(this.usage.costUsd, this.maxCostUsd);
  }
  record(res: ChatResponse) {
    const p = this.provider.pricing(res.model);
    const { inputTokens, outputTokens, cachedTokens } = res.usage;
    const cost = ((inputTokens - cachedTokens) * p.input + cachedTokens * p.cached + outputTokens * p.output) / 1e6;
    this.usage.inputTokens += inputTokens;
    this.usage.outputTokens += outputTokens;
    this.usage.cachedTokens += cachedTokens;
    this.usage.calls += 1;
    this.addCost(cost);
  }
  addCost(usd: number) {
    this.usage.costUsd += usd;
    this.emit({ ...this.usage });
  }
}

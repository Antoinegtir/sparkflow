import { MOCK_A11Y_FIXES, MOCK_FOUNDATION, MOCK_PLAN, MOCK_SCREENS } from "./mock-fixtures";
import type { ChatMessage, ChatRequest, ChatResponse, LLMProvider, ToolCall } from "./types";

const COLORS: Record<string, string> = {
  blue: "#2563EB", bleu: "#2563EB",
  green: "#16A34A", vert: "#16A34A",
  red: "#DC2626", rouge: "#DC2626",
  orange: "#EA580C",
  pink: "#DB2777", rose: "#DB2777",
  teal: "#0D9488",
  purple: "#7C3AED", violet: "#7C3AED",
};

const textOf = (m: ChatMessage | undefined) =>
  !m ? "" : typeof m.content === "string" ? (m.content ?? "") : Array.isArray(m.content) ? m.content.map((p) => (p.type === "text" ? p.text : "")).join("\n") : "";

let n = 0;
const call = (name: string, args: unknown): ToolCall => ({ id: `mock_${++n}`, name, arguments: JSON.stringify(args) });
const reply = (content: string | null, toolCalls: ToolCall[] = []): ChatResponse => ({
  content,
  toolCalls,
  model: "mock",
  usage: { inputTokens: 0, outputTokens: 0, cachedTokens: 0 },
});

/** Scripted provider: builds the Habitly sample app and handles a few kinds of requests. */
export class MockProvider implements LLMProvider {
  name = "mock" as const;
  modelFor() {
    return "mock";
  }
  pricing() {
    return { input: 0, cached: 0, output: 0 };
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    await new Promise((r) => setTimeout(r, 250));
    if (req.role === "planner") return reply(JSON.stringify(MOCK_PLAN));
    if (req.role === "verifier") return reply(JSON.stringify(this.verdict(textOf(req.messages.find((m) => m.role === "user")))));
    return this.builder(req.messages);
  }

  private verdict(text: string) {
    const block = text.split("Acceptance criteria")[1]?.split("data-testid elements")[0] ?? "";
    const criteria = [...block.matchAll(/^\s*\d+\.\s+(.+)$/gm)].map((m) => ({ text: m[1].trim(), pass: true, reason: "Visible in the screenshot." }));
    return { criteria, defects: [] };
  }

  private builder(messages: ChatMessage[]): ChatResponse {
    const task = textOf(messages.find((m) => m.role === "user"));
    const step = messages.filter((m) => m.role === "assistant").length;
    const files = this.filesFor(task);
    if (typeof files === "string") return step === 0 ? reply(null, [call("finish", { summary: files })]) : reply(null, []);
    if (step === 0) return reply(null, Object.entries(files).map(([path, content]) => call("write_file", { path, content })));
    if (step === 1) return reply(null, [call("typecheck", {})]);
    return reply(null, [call("finish", { summary: this.summary(task) })]);
  }

  private summary(task: string) {
    if (task.startsWith("TASK: Lay the foundation")) return "Theme, store and tab navigation are in place.";
    if (task.startsWith("TASK: Implement the screen")) return "Screen implemented.";
    if (/accessibility issues/i.test(task)) return "Check buttons are now 44×44 with a label.";
    return "Done.";
  }

  /** Files to write, or a message string when the request can't be handled. */
  private filesFor(task: string): Record<string, string> | string {
    if (task.startsWith("TASK: Lay the foundation")) return MOCK_FOUNDATION;
    if (task.startsWith("TASK: Implement the screen")) {
      const route = task.match(/^Route: (.+)$/m)?.[1]?.trim() ?? "";
      return MOCK_SCREENS[route] ?? {};
    }
    if (task.startsWith("TASK: Fix") || task.startsWith("TASK: The project does not typecheck")) return {};
    if (task.startsWith("TASK: The user asks")) {
      const route = task.match(/^Focused screen: .*\((.+)\)$/m)?.[1];
      if (/accessibility issues/i.test(task)) return (route && MOCK_A11Y_FIXES[route]) || MOCK_A11Y_FIXES["/(tabs)/index"];
      const word = Object.keys(COLORS).find((w) => new RegExp(`\\b${w}\\b`, "i").test(task.split("Request:")[1] ?? task));
      if (word) {
        const theme = JSON.parse(MOCK_FOUNDATION["theme.json"]);
        const current = task.match(/"primary":\s*"(#[0-9A-Fa-f]{6})"/)?.[1];
        if (task.startsWith("TASK: The user asks for a change in their native app")) {
          // Native sample: recolor the avatar's backgroundColor in App.tsx.
          const app = task.split("=== App.tsx ===\n")[1]?.split(/\n=== /)[0];
          const re = /(avatar(?:Small)?\s*:\s*\{[^}]*?backgroundColor:\s*["'])(#[0-9A-Fa-f]{3,8}|[a-z]+)(["'])/g;
          if (!app || !re.test(app)) return "Mock mode can only recolor the avatar in App.tsx. Set MODEL_API_KEY to use Muse Spark.";
          return { "App.tsx": app.replace(re, `$1${COLORS[word]}$3`) };
        }
        theme.primary = COLORS[word];
        if (current && current === COLORS[word]) return "It already uses that color.";
        return { "theme.json": JSON.stringify(theme, null, 2) };
      }
      return 'Mock mode only understands color changes (try "make it blue"). Set MODEL_API_KEY to use Muse Spark.';
    }
    return {};
  }
}

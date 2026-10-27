import type { AppPlan, ScreenPlan, Verdict } from "../shared";

export const KIT_COMPONENTS = [
  "Screen", "Header", "Text", "Card", "List", "ListItem", "Button", "IconButton", "Fab", "Input",
  "Segmented", "EmptyState", "BarChart", "ProgressBar", "Stat", "Badge", "Avatar", "Toggle", "Divider", "Icon",
];

export const PLANNER_SYSTEM = `You plan mobile apps built with Expo Router and React Native.
Return ONE JSON object matching the schema.

Rules:
- 3 to 6 screens. No login, signup or onboarding unless the user asks for it.
- route = the file path without "app" and the extension: app/(tabs)/stats.tsx → /(tabs)/stats.
- 2 to 4 main sections → bottom tabs: tab screens live in app/(tabs)/, app/(tabs)/index.tsx is the first tab, and there is NO app/index.tsx. Detail screens stay outside the group (app/habit/[id].tsx).
- previewPath = the URL that opens the screen: groups and a trailing "index" removed, dynamic params replaced by the seed id "1" (/(tabs)/index → /, /habit/[id] → /habit/1).
- navigatesTo lists the routes (not paths) a screen opens.
- components: names from this kit only: ${KIT_COMPONENTS.join(", ")}.
- acceptance: 3 to 5 VISUAL criteria per screen, each checkable on ONE 390×844 screenshot taken at first launch with seed data. Never behaviour, persistence, navigation results or animation. Good: "A header reads \\"Today\\"", "Three habit rows each show a check button".
- dataModel: entities with TypeScript-like field types.
- theme: hex colors; the primary must contrast with white text, the background must be light.
- name: 1 or 2 words.
- If an image is attached, follow its layout closely. Detected UI regions may be listed with positions.
- If audio is attached, it is the user describing the app.
- Screen titles are short page names in English (\"Today\", \"Task detail\", \"Settings\"), whatever the user's language. Write purposes and criteria, and every text shown in the app, in the user's language.`;

export const BUILDER_PREAMBLE = `You are the Builder: a senior React Native engineer working inside an Expo Router project through tools.

How to work:
1. The files you need are already in the task. Read others only if needed.
2. Write complete files with write_file. Use apply_patch for small edits to large files.
3. Run typecheck and fix every error.
4. Optionally take ONE screenshot of the screen you changed to check it.
5. Call finish with a 1–2 sentence summary for the user, in the user's language.

Design bar: 16/24 px spacing, rounded cards, Ionicons, real content (never lorem ipsum), clear hierarchy.
Give every meaningful element a unique testID prefixed with the screen slug.
Batch independent tool calls in one turn.`;

export const VERIFIER_SYSTEM = `You are a strict but fair QA engineer. You get one 390×844 screenshot of a mobile screen, its acceptance criteria, the visible testIDs and the accessibility tree.
For each criterion, in order, decide pass or fail and give a concrete reason based on what is visible.
List defects: "high" for a failed criterion, a blank or error screen, overlapping elements, placeholder content or the wrong screen; "low" for polish. Reference the testId when you can.
Do not invent requirements beyond the criteria. Return ONE JSON object matching the schema.`;

/** Stable prefix (preamble + rules + plan) so the provider can cache it. */
export function builderSystem(rules: string, plan: AppPlan) {
  return `${BUILDER_PREAMBLE}\n\n# AGENT_RULES.md (mandatory)\n\n${rules}\n\n# App plan\n\n${JSON.stringify(plan, null, 2)}`;
}

const MAX_FILE = 12000;
export function fileBlock(files: Record<string, string>) {
  return Object.entries(files)
    .map(([p, c]) => `=== ${p} ===\n${c.length > MAX_FILE ? c.slice(0, MAX_FILE) + "\n… (truncated, read_file for the rest)" : c}`)
    .join("\n\n");
}

const numbered = (xs: string[]) => xs.map((x, i) => `${i + 1}. ${x}`).join("\n");

export function foundationTask(plan: AppPlan, files: Record<string, string>) {
  const tabs = plan.screens.filter((s) => s.file.includes("/(tabs)/"));
  return `TASK: Lay the foundation of "${plan.name}".

1. Rewrite theme.json: primary ${plan.theme.primary}, background ${plan.theme.background}; derive surface, text, muted, border, danger and success with good contrast; add a "dark" object (dark background and surface tinted with the primary).
2. Write lib/store.ts: a zustand store with persist and persistStorage for this data model, with at least 3 seed items (ids "1", "2", "3") per entity:
${JSON.stringify(plan.dataModel, null, 2)}
3. Layouts: keep app/_layout.tsx a Stack (keep the global.css import).${tabs.length ? ` Write app/(tabs)/_layout.tsx with Tabs from "expo-router/js-tabs" and tabsScreenOptions, one tab per screen: ${tabs.map((t) => t.title).join(", ")} (tab labels in the language of the app's texts).` : ""}
4. Write a placeholder for every screen (a Screen with a Header and the right testID) so every route exists:
${plan.screens.map((s) => `- ${s.file} (${s.title})`).join("\n")}
5. typecheck must pass, then finish.

Current files:
${fileBlock(files)}`;
}

export function screenTask(s: ScreenPlan, previewUrl: string, files: Record<string, string>) {
  return `TASK: Implement the screen "${s.title}".
Route: ${s.route}
File: ${s.file}
Preview URL: ${previewUrl}
Purpose: ${s.purpose}
Kit components to use: ${s.components.join(", ")}
Navigates to (use real URL paths, never group names): ${s.navigatesTo.join(", ") || "nothing"}

Acceptance criteria (checked on one 390×844 screenshot at first launch):
${numbered(s.acceptance)}

Current files:
${fileBlock(files)}`;
}

export function fixTask(s: ScreenPlan, attempt: number, max: number, verdict: Verdict, runtime: string[], files: Record<string, string>) {
  const failing = verdict.criteria.filter((c) => !c.pass);
  return `TASK: Fix the screen "${s.title}" (attempt ${attempt}/${max}).
Route: ${s.route}
File: ${s.file}

The verifier rejected the attached screenshot.
Failing criteria:
${failing.map((c) => `- ${c.text}: ${c.reason}`).join("\n") || "- none"}
Defects:
${verdict.defects.map((d) => `- [${d.severity}] ${d.description}${d.testId ? ` (testID ${d.testId})` : ""}`).join("\n") || "- none"}
${runtime.length ? `Runtime errors:\n${runtime.map((r) => `- ${r}`).join("\n")}\n` : ""}
Fix the root causes, typecheck, then finish.

Current files:
${fileBlock(files)}`;
}

export type PickInfo = { testId: string; file?: string; line?: number; snippet?: string };

function picksBlock(picks: PickInfo[]) {
  if (!picks.length) return "";
  const list = picks
    .map((p, i) => `${i + 1}. ${p.testId}${p.file ? ` — ${p.file}${p.line ? `:${p.line}` : ""}` : ""}${p.snippet ? `\n\`\`\`\n${p.snippet}\n\`\`\`` : ""}`)
    .join("\n");
  return `\nThe user pointed at ${picks.length === 1 ? "this element" : "these elements"}:\n${list}\n${picks.length > 1 ? "Apply the request to each of them.\n" : ""}`;
}

export function userPromptTask(o: {
  text: string;
  voice: boolean;
  plan: AppPlan;
  focused?: ScreenPlan;
  picks: PickInfo[];
  files: Record<string, string>;
}) {
  const request = o.text.trim() || (o.voice ? "" : "(empty)");
  const scope = o.focused
    ? `Focused screen: ${o.focused.title} (${o.focused.route})
File: ${o.focused.file}
Its criteria:
${numbered(o.focused.acceptance)}
Prefer changing only this screen's file.`
    : `Whole app. Screens:
${o.plan.screens.map((s) => `- ${s.title} (${s.route}) — ${s.file}`).join("\n")}
To add a screen, create its route file and link to it from an existing screen.`;
  return `TASK: The user asks for a change.
${o.voice && !o.text.trim() ? "The user's request is in the attached voice memo." : `Request: ${request}`}${o.voice && o.text.trim() ? "\n(A voice memo is attached too.)" : ""}

${scope}
${picksBlock(o.picks)}
Make the change, typecheck, then finish with a short summary in the user's language.

Current files:
${fileBlock(o.files)}`;
}

export function nativeBuilderSystem(notes: string, plan: AppPlan) {
  return `You edit the user's own React Native app in place, through tools. Fast Refresh reloads it on the simulator.

Rules:
- Make the smallest change that does what the user asks, in the project's existing style (for example @callstack/liquid-glass, @bottom-tabs/react-navigation).
- No Expo Router, no NativeWind, no Sparkflow kit, no new packages.
- Typecheck, then finish with a 1–2 sentence summary in the user's language.

${notes ? `# AGENTS.md\n\n${notes}\n\n` : ""}# Pages captured from the simulator\n\n${JSON.stringify(plan.screens.map((s) => ({ title: s.title, route: s.route })), null, 2)}`;
}

export function nativePromptTask(o: { text: string; voice: boolean; page?: string; picks: PickInfo[]; crops: number; files: Record<string, string> }) {
  return `TASK: The user asks for a change in their native app.
${o.voice && !o.text.trim() ? "The user's request is in the attached voice memo." : `Request: ${o.text.trim()}`}
${o.page ? `Page on screen: ${o.page}\n` : ""}${picksBlock(o.picks)}${o.crops ? `Crops of the ${o.crops} pointed elements are attached, in order: find the code that renders each.\n` : ""}
Source files:
${fileBlock(o.files)}`;
}

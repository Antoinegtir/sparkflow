import { describe, expect, it } from "vitest";
import { expoGoPath } from "../lib/shared";
import { SKILLS, skillsFor, skillsIndex } from "../lib/agent/skills";
import { executeTool, type ToolContext } from "../lib/agent/tools";
import { nativeBuilderSystem } from "../lib/agent/prompts";
import type { AppPlan } from "../lib/shared";

describe("mobile skills", () => {
  it("inlines the skills a request names", () => {
    expect(skillsFor("met l'app en liquid glass")).toContain("expo-glass-effect");
    expect(skillsFor("ajoute des vibrations quand je coche")).toContain("expo-haptics");
    expect(skillsFor("un bottom sheet pour créer une tâche")).toContain('presentation: "formSheet"');
    expect(skillsFor("change le titre en bleu")).toBe("");
  });

  it("gives the user's own app a native recipe, never a look-alike", async () => {
    const glass = skillsFor("ajoute du liquid glass", 3, true);
    expect(glass).toContain("@callstack/liquid-glass");
    expect(glass).not.toContain("components/kit");
    expect(skillsFor("ajoute des vibrations", 3, true)).toMatch(/^[\s\S]*this project's own styling[\s\S]*expo-haptics/);
    const ctx = { nativeApp: true } as ToolContext;
    expect((await executeTool(ctx, "skill", JSON.stringify({ name: "liquid-glass" }))).text).toContain("LiquidGlassView");
    expect(nativeBuilderSystem("", { screens: [] } as unknown as AppPlan, ["@callstack/liquid-glass"])).toMatch(/native mobile app[\s\S]*- liquid-glass:[\s\S]*@callstack\/liquid-glass/);
  });

  it("lists every skill in the index, with unique names", () => {
    const names = SKILLS.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(skillsIndex()).toContain(`- ${n}:`);
  });

  it("reads a skill with the tool, and names the others when it doesn't exist", async () => {
    const ctx = {} as ToolContext;
    expect((await executeTool(ctx, "skill", JSON.stringify({ name: "haptics" }))).text).toContain("Haptics.selectionAsync");
    expect((await executeTool(ctx, "skill", JSON.stringify({ name: "nope" }))).text).toMatch(/^Error: no skill "nope".*liquid-glass/);
  });

  it("replaces every occurrence with all: true", async () => {
    let file = "a bg-surface/70 b bg-surface/70";
    const ctx = {
      touched: new Set<string>(),
      emit: () => {},
      sandbox: { readFile: async () => file, writeFile: async (_p: string, t: string) => void (file = t) },
    } as unknown as ToolContext;
    const once = await executeTool(ctx, "apply_patch", JSON.stringify({ path: "app/x.tsx", edits: [{ old: "bg-surface/70", new: "bg-surface" }] }));
    expect(once.text).toMatch(/appears 2 times.*all: true/);
    await executeTool(ctx, "apply_patch", JSON.stringify({ path: "app/x.tsx", edits: [{ old: "bg-surface/70", new: "bg-surface", all: true }] }));
    expect(file).toBe("a bg-surface b bg-surface");
  });

  it("opens the first page in Expo Go by its route group", () => {
    expect(expoGoPath("/", "/(tabs)/index")).toBe("/(tabs)");
    expect(expoGoPath("/stats", "/(tabs)/stats")).toBe("/stats");
  });
});

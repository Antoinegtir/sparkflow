import { z } from "zod";

export const ScreenPlanSchema = z.object({
  route: z.string(),
  file: z.string(),
  title: z.string(),
  purpose: z.string(),
  components: z.array(z.string()),
  navigatesTo: z.array(z.string()),
  acceptance: z.array(z.string()),
  previewPath: z.string().optional(),
});
export type ScreenPlan = z.infer<typeof ScreenPlanSchema>;

export const AppPlanSchema = z.object({
  name: z.string(),
  /** The planner's reasoning about what the app needs, kept for the Builder. */
  brief: z.string().optional(),
  theme: z.object({ primary: z.string(), background: z.string(), font: z.string().optional() }),
  dataModel: z.array(z.object({ entity: z.string(), fields: z.record(z.string(), z.string()) })),
  screens: z.array(ScreenPlanSchema).min(1),
});
export type AppPlan = z.infer<typeof AppPlanSchema>;

/** Strict-mode variant for structured outputs: no optional keys, no free-form records. */
export const LLMPlanSchema = z.object({
  // Filled first: the model reasons about the app before it lists any screen.
  analysis: z.object({
    audience: z.string(),
    coreJob: z.string(),
    keyFlows: z.array(z.string()),
    deepNeeds: z.array(z.string()),
    navigation: z.enum(["tabs", "stack", "single-screen", "tabs-and-modals", "drawer"]),
    navigationWhy: z.string(),
    screenCountWhy: z.string(),
  }),
  name: z.string(),
  theme: z.object({ primary: z.string(), background: z.string(), font: z.string().nullable() }),
  dataModel: z.array(
    z.object({ entity: z.string(), fields: z.array(z.object({ name: z.string(), type: z.string() })) }),
  ),
  screens: z
    .array(
      ScreenPlanSchema.extend({ previewPath: z.string() }),
    )
    .min(1),
});
export type LLMPlan = z.infer<typeof LLMPlanSchema>;

export function planFromLLM(p: LLMPlan): AppPlan {
  const a = p.analysis;
  const brief = [
    `Audience: ${a.audience}`,
    `Core job: ${a.coreJob}`,
    `Key flows:\n${a.keyFlows.map((f) => `- ${f}`).join("\n")}`,
    `Deeper needs:\n${a.deepNeeds.map((f) => `- ${f}`).join("\n")}`,
    `Navigation: ${a.navigation}, because ${a.navigationWhy}`,
  ].join("\n");
  return {
    name: p.name,
    brief,
    theme: { primary: p.theme.primary, background: p.theme.background, ...(p.theme.font ? { font: p.theme.font } : {}) },
    dataModel: p.dataModel.map((d) => ({ entity: d.entity, fields: Object.fromEntries(d.fields.map((f) => [f.name, f.type])) })),
    screens: p.screens.map(({ previewPath, ...s }) => ({ ...s, ...(previewPath ? { previewPath } : {}) })),
  };
}

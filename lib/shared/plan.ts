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
  theme: z.object({ primary: z.string(), background: z.string(), font: z.string().optional() }),
  dataModel: z.array(z.object({ entity: z.string(), fields: z.record(z.string(), z.string()) })),
  screens: z.array(ScreenPlanSchema).min(1),
});
export type AppPlan = z.infer<typeof AppPlanSchema>;

/** Strict-mode variant for structured outputs: no optional keys, no free-form records. */
export const LLMPlanSchema = z.object({
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
  return {
    name: p.name,
    theme: { primary: p.theme.primary, background: p.theme.background, ...(p.theme.font ? { font: p.theme.font } : {}) },
    dataModel: p.dataModel.map((d) => ({ entity: d.entity, fields: Object.fromEntries(d.fields.map((f) => [f.name, f.type])) })),
    screens: p.screens.map(({ previewPath, ...s }) => ({ ...s, ...(previewPath ? { previewPath } : {}) })),
  };
}

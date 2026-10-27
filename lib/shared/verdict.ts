import { z } from "zod";

const Criterion = z.object({ text: z.string(), pass: z.boolean(), reason: z.string() });
const Defect = z.object({ severity: z.enum(["high", "low"]), description: z.string(), testId: z.string().optional() });

export const VerdictSchema = z.object({ route: z.string(), criteria: z.array(Criterion), defects: z.array(Defect) });
export type Verdict = z.infer<typeof VerdictSchema>;

export const LLMVerdictSchema = z.object({
  criteria: z.array(Criterion),
  defects: z.array(Defect.extend({ testId: z.string().nullable() })),
});
export type LLMVerdict = z.infer<typeof LLMVerdictSchema>;

export const verdictPasses = (v: Verdict) => v.criteria.every((c) => c.pass) && !v.defects.some((d) => d.severity === "high");

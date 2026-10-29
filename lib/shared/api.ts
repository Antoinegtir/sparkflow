import { z } from "zod";

export const MediaInputSchema = z.object({ mediaType: z.string(), data: z.string(), name: z.string().optional() });
export type MediaInput = z.infer<typeof MediaInputSchema>;

export const CreateProjectRequest = z
  .object({ prompt: z.string().default(""), image: MediaInputSchema.optional(), audio: MediaInputSchema.optional() })
  .refine((r) => r.prompt.trim() || r.image || r.audio, {
    message: "Describe the app, attach a sketch/screenshot, or record a voice memo.",
  });
export type CreateProjectRequest = z.infer<typeof CreateProjectRequest>;

const Area = z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() });
export type Area = z.infer<typeof Area>;

export const PickSchema = z.object({ testId: z.string(), area: Area.optional(), file: z.string().optional(), line: z.number().optional() });
export type Pick = z.infer<typeof PickSchema>;

export const PromptRequest = z
  .object({
    text: z.string().default(""),
    route: z.string().optional(),
    testId: z.string().optional(),
    area: Area.optional(),
    picks: z.array(PickSchema).max(12).optional(),
    image: MediaInputSchema.optional(),
    audio: MediaInputSchema.optional(),
  })
  .refine((r) => r.text.trim() || r.audio, { message: "Type a request or record a voice memo." });
export type PromptRequest = z.infer<typeof PromptRequest>;

export type ProjectSummary = {
  id: string;
  /** URL name, e.g. /habitly. */
  slug: string;
  name: string;
  prompt: string;
  createdAt: number;
  status: string;
  screenCount: number;
  coverUrl?: string;
  native?: boolean;
  previewDevice?: string;
  /** iOS bundle ID, e.g. com.sparkflow.wander. */
  bundleId?: string;
};

export type ResolvedElement = { testId: string; file?: string; line?: number; snippet?: string };

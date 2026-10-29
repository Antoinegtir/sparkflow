import { z } from "zod";
import type { Phase, RunStatus } from "./events";

/** Where the open Sparkflow tab is, so the `sparkflow` terminal screen can follow along. */
export const Presence = z.object({
  view: z.enum(["home", "app"]),
  /** Home: the part of the landing on screen. */
  section: z.enum(["hero", "how", "apps"]).optional(),
  /** Home: what the prompt box is doing, and the start of what is typed. */
  composer: z.enum(["writing", "recording", "sketch"]).optional(),
  draft: z.string().max(80).optional(),
  /** App: the project, the page open in focus (its title) and how it is shown. */
  projectId: z.string().max(80).optional(),
  page: z.string().max(80).optional(),
  mode: z.enum(["canvas", "page", "play"]).optional(),
  device: z.string().max(40).optional(),
  hidden: z.boolean().optional(),
});
export type Presence = z.infer<typeof Presence>;

/** What the terminal reads: the last presence, how old it is, and a summary of its project. */
export type PresenceReport = {
  presence: Presence | null;
  /** Milliseconds since the tab last spoke. */
  age: number;
  apps: number;
  project?: { name: string; status: RunStatus; phase: Phase; step?: string; done: number; total: number; costUsd: number };
};

import type { AppPlan } from "./plan";
import type { QualityReport } from "./quality";
import type { Verdict } from "./verdict";

export type ScreenStatus = "pending" | "building" | "verifying" | "done" | "failed";
export type RunStatus = "idle" | "running" | "done" | "failed" | "stopped";
export type Phase = "idle" | "sandbox" | "planner" | "builder" | "verifier";
export type NavEdge = { from: string; to: string; source: "plan" | "code" };
export type Usage = { inputTokens: number; outputTokens: number; cachedTokens: number; costUsd: number; calls: number };

export type AgentEvent =
  /** `removed`: pages deleted from the app, forgotten (a page added later on the same route starts fresh). */
  | { type: "plan"; plan: AppPlan; removed?: string[] }
  | { type: "screen_status"; route: string; status: ScreenStatus; version: number; attempt?: number }
  | { type: "screenshot"; route: string; url: string; version: number }
  | { type: "verdict"; verdict: Verdict; attempt: number }
  | { type: "log"; level: "info" | "error"; message: string; route?: string }
  | { type: "files_changed"; files: string[] }
  | { type: "preview_ready"; webUrl: string; expoGoUrl: string | null }
  | { type: "run_status"; status: RunStatus; message?: string }
  | { type: "phase"; phase: Phase; route?: string; detail?: string }
  | { type: "nav"; edges: NavEdge[] }
  | { type: "tree"; files: string[] }
  | ({ type: "usage" } & Usage)
  | { type: "user_prompt"; id: string; text: string; route?: string; testId?: string; /** "owner" or the guest uid. */ by?: string }
  | { type: "agent_message"; text: string; route?: string }
  | { type: "commit"; sha: string; message: string; routes: string[] }
  | { type: "renamed"; name: string }
  | { type: "preview_device"; device: string }
  | { type: "quality"; route: string; version: number; report: QualityReport }
  | { type: "dark_shot"; route: string; url: string; version: number; report?: QualityReport }
  | { type: "device_shot"; route: string; device: string; dark: boolean; url: string; version: number };

export type StoredEvent = AgentEvent & { seq: number; ts: number };

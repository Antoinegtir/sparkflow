import type { QualityReport } from "../shared";

export type ExecResult = { code: number; stdout: string; stderr: string; timedOut: boolean };
export type Preview = { webUrl: string; internalUrl: string; expoGoUrl: string | null };

export type InspectStep =
  | { action: "click"; testId: string }
  | { action: "fill"; testId: string; value: string }
  | { action: "press"; key: string }
  | { action: "scroll"; y: number }
  | { action: "wait"; ms: number }
  | { action: "goto"; path: string };

export type InspectJob = {
  targets: { name: string; path: string; steps?: InspectStep[]; shotAfterEachStep?: boolean; record?: boolean }[];
  viewport?: { width: number; height: number };
  deviceScaleFactor?: number;
  navigationTimeoutMs?: number;
  settleMs?: number;
  colorScheme?: "light" | "dark";
};

export type TestIdBox = { id: string; text: string; rect: { x: number; y: number; width: number; height: number } };

export type InspectTargetResult = {
  name: string;
  finalPath: string;
  httpStatus: number | null;
  ok: boolean;
  error: string | null;
  screenshot: Buffer | null;
  stepShots: Buffer[];
  aria: string;
  testIds: TestIdBox[];
  console: string[];
  pageErrors: string[];
  bodyText: string;
  errorOverlay: boolean;
  audit: QualityReport | null;
  video: Buffer | null;
  durationMs: number;
};

export interface Sandbox {
  id: string;
  dir: string;
  exec(command: string, opts?: { timeoutSec?: number }): Promise<ExecResult>;
  readFile(rel: string): Promise<string>;
  readFileBytes(rel: string): Promise<Buffer>;
  writeFile(rel: string, content: string | Buffer): Promise<void>;
  listFiles(dir?: string): Promise<string[]>;
  startDevServer(): Promise<Preview>;
  devServerRunning(): boolean;
  devServerLogs(lines: number): string;
  inspect(job: InspectJob): Promise<InspectTargetResult[]>;
  persist?(): Promise<void>;
  terminate(): Promise<void>;
}

export interface SandboxDriver {
  name: "local" | "modal";
  open(projectId: string): Promise<Sandbox>;
  remove(projectId: string): Promise<void>;
}

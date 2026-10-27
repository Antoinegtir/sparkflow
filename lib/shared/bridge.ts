export type IdeToApp =
  | { type: "inspect"; enabled: boolean }
  | { type: "navigate"; path: string }
  | { type: "color-scheme"; scheme: "system" | "light" | "dark" }
  | { type: "highlight"; testId: string | null; anchors?: Anchors }
  | { type: "selection"; items: ({ testId?: string } | { anchors: Anchors })[] }
  | { type: "ping" };

/** Contents of an element without a testID: the app outlines the smallest block holding all of them. */
export type Anchors = { ids: string[]; texts: string[]; labels?: string[]; climb?: boolean; control?: boolean };

export type Rect = { x: number; y: number; width: number; height: number };

export type AppToIde = { source: "sparkflow-app" } & (
  | { type: "ready"; path: string }
  | { type: "route"; path: string }
  | { type: "surface"; color: string }
  | { type: "select"; testId: string; text: string; rect: Rect; path: string; anchors?: Anchors }
);

export const isAppMessage = (m: unknown): m is AppToIde =>
  !!m && typeof m === "object" && (m as { source?: unknown }).source === "sparkflow-app";

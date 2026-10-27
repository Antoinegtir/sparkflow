import { describe, expect, it } from "vitest";
import { applyEvent, foldEvents, initialState, matchRoute, normalizeRoute, previewPathFor, qualityScore, routeSlug, routeToPath, type ProjectMeta, type StoredEvent } from "../lib/shared";

const meta: ProjectMeta = { id: "p1", name: "Test", prompt: "x", createdAt: 0, inputs: { image: false, audio: false } };
let seq = 0;
const ev = (e: object) => ({ ...e, seq: ++seq, ts: seq }) as StoredEvent;

describe("routes", () => {
  it("normalizes files and routes", () => {
    expect(normalizeRoute("app/(tabs)/index.tsx")).toBe("/(tabs)/index");
    expect(routeToPath("/(tabs)/index")).toBe("/");
    expect(routeToPath("/(tabs)/stats")).toBe("/stats");
    expect(previewPathFor("/habit/[id]")).toBe("/habit/1");
    expect(routeSlug("/(tabs)/home")).toBe("tabs-home");
    expect(routeSlug("/")).toBe("index");
  });
  it("prefers static routes over dynamic ones", () => {
    const routes = ["/habit/[id]", "/habit/new"];
    expect(matchRoute("/habit/new?x=1", routes)).toBe("/habit/new");
    expect(matchRoute("/habit/42", routes)).toBe("/habit/[id]");
  });
});

describe("quality", () => {
  it("scores 100 − 12×high − 3×low, floored at 0", () => {
    expect(qualityScore([{ kind: "label", severity: "low", message: "" }, { kind: "overflow", severity: "high", message: "" }])).toBe(85);
    expect(qualityScore(Array(10).fill({ kind: "overflow", severity: "high", message: "" }))).toBe(0);
  });
});

describe("state reducer", () => {
  it("ignores replayed events", () => {
    const s1 = applyEvent(initialState(meta), ev({ type: "renamed", name: "A" }));
    expect(applyEvent(s1, { ...ev({ type: "renamed", name: "B" }), seq: 1 }).name).toBe("A");
  });
  it("keeps one history entry per version and merges edges", () => {
    seq = 0;
    const s = foldEvents(meta, [
      ev({ type: "plan", plan: { name: "App", theme: { primary: "#000", background: "#fff" }, dataModel: [], screens: [{ route: "/a", file: "app/a.tsx", title: "A", purpose: "", components: [], navigatesTo: ["/b"], acceptance: [] }, { route: "/b", file: "app/b.tsx", title: "B", purpose: "", components: [], navigatesTo: [], acceptance: [] }] } }),
      ev({ type: "screenshot", route: "/a", url: "1", version: 1 }),
      ev({ type: "screenshot", route: "/a", url: "2", version: 1 }),
      ev({ type: "nav", edges: [{ from: "/a", to: "/b", source: "code" }, { from: "/b", to: "/b", source: "code" }] }),
    ]);
    expect(s.screens["/a"].history).toEqual([{ version: 1, url: "2", ts: 3 }]);
    expect(s.edges).toEqual([{ from: "/a", to: "/b", source: "plan" }]);
  });
});

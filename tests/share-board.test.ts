import { describe, expect, it } from "vitest";
import type { Actor } from "../lib/share/actor";
import { applyOps, mergePut, type Board } from "../lib/share/board";

const owner: Actor = { kind: "owner", me: "owner" };
const guest = (uid: string, role: "view" | "comment" | "edit"): Actor => ({ kind: "guest", me: uid, uid, projectId: "p1", role });
const empty = (): Board => ({ texts: [], comments: [], groups: [], rev: 0 });
const c = (id: string, text = "hi", x = 0, y = 0) => ({ op: "comment" as const, item: { id, x, y, text } });
const ok = (r: ReturnType<typeof applyOps>) => {
  if ("error" in r) throw new Error(r.message);
  return r.board;
};

describe("board ops", () => {
  it("stamps the author and ignores a spoofed one", () => {
    const op = { op: "comment" as const, item: { id: "c1", x: 1, y: 2, text: "x", by: "owner" } as never };
    const b = ok(applyOps(empty(), [op], guest("u1", "comment")));
    expect(b.comments[0].by).toBe("u1");
    expect(b.rev).toBe(1);
  });

  it("view can't comment, comment can't touch texts", () => {
    expect("error" in applyOps(empty(), [c("c1")], guest("u1", "view"))).toBe(true);
    expect("error" in applyOps(empty(), [{ op: "text", item: { id: "t1", x: 0, y: 0, text: "a" } }], guest("u1", "comment"))).toBe(true);
    expect("error" in applyOps(empty(), [{ op: "text", item: { id: "t1", x: 0, y: 0, text: "a" } }], guest("u1", "edit"))).toBe(false);
  });

  it("others' comments can't be edited or removed", () => {
    const b = ok(applyOps(empty(), [c("c1")], guest("u1", "comment")));
    expect("error" in applyOps(b, [c("c1", "changed")], guest("u2", "comment"))).toBe(true);
    expect("error" in applyOps(b, [{ op: "remove", id: "c1" }], guest("u2", "edit"))).toBe(true);
    expect("error" in applyOps(b, [c("c1", "changed")], guest("u2", "edit"))).toBe(true);
  });

  it("edit may move someone's pin, the owner moderates", () => {
    const b = ok(applyOps(empty(), [c("c1")], guest("u1", "comment")));
    const moved = ok(applyOps(b, [c("c1", "hi", 5, 6)], guest("u2", "edit")));
    expect(moved.comments[0]).toMatchObject({ x: 5, y: 6, by: "u1" });
    const edited = ok(applyOps(b, [c("c1", "tidy")], owner));
    expect(edited.comments[0]).toMatchObject({ text: "tidy", by: "u1" });
    expect(ok(applyOps(b, [{ op: "remove", id: "c1" }], owner)).comments).toHaveLength(0);
  });

  it("legacy comments belong to the owner", () => {
    const b: Board = { ...empty(), comments: [{ id: "old", x: 0, y: 0, text: "a", ts: 1 }] };
    expect("error" in applyOps(b, [{ op: "remove", id: "old" }], guest("u1", "comment"))).toBe(true);
    expect("error" in applyOps(b, [{ op: "remove", id: "old" }], owner)).toBe(false);
  });

  it("only edit authors or the owner mark a comment sent", () => {
    const b = ok(applyOps(empty(), [c("c1")], guest("u1", "comment")));
    expect("error" in applyOps(b, [{ op: "comment", item: { id: "c1", x: 0, y: 0, text: "hi", sent: true } }], guest("u1", "comment"))).toBe(true);
    expect("error" in applyOps(b, [{ op: "comment", item: { id: "c1", x: 0, y: 0, text: "hi", sent: true } }], owner)).toBe(false);
  });

  it("caps comments per member", () => {
    const b: Board = { ...empty(), comments: Array.from({ length: 100 }, (_, i) => ({ id: `c${i}`, x: 0, y: 0, text: "a", ts: 0, by: "u1" })) };
    expect("error" in applyOps(b, [c("new")], guest("u1", "comment"))).toBe(true);
    expect("error" in applyOps(b, [c("new")], guest("u2", "comment"))).toBe(false);
  });

  it("an old site's PUT keeps the server's authors", () => {
    const stored = ok(applyOps(empty(), [c("c1")], guest("u1", "comment")));
    const put = mergePut(stored, { ...stored, comments: [{ ...stored.comments[0], by: "owner", text: "x" }] }, owner);
    expect(put.comments[0].by).toBe("u1");
    expect(() => mergePut(stored, stored, guest("u1", "edit"))).toThrow();
  });
});

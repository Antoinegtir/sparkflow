import { describe, expect, it } from "vitest";
import { RANK, cleanPath, matchRule, ticketOk } from "../lib/share/policy";
import type { Role } from "../lib/shared/share";

const P = "/api/projects/p1";
const allowed = (role: Role, method: string, path: string, search = "") => {
  const r = matchRule(method, path, search);
  return !!r && (r.projectId ?? "p1") === "p1" && RANK[role] >= RANK[r.min];
};

const table: [string, string, string, Role | null][] = [
  ["GET", "/api/projects", "", "view"],
  ["GET", "/api/file-icon", "?name=a.ts", "view"],
  ["GET", P, "", "view"],
  ["PATCH", P, "", "edit"],
  ["DELETE", P, "", null],
  ["GET", `${P}/access`, "", "view"],
  ["DELETE", `${P}/access`, "", "view"],
  ["GET", `${P}/events`, "?poll=1", "view"],
  ["GET", `${P}/board`, "", "view"],
  ["POST", `${P}/board`, "", "comment"],
  ["PUT", `${P}/board`, "", null],
  ["GET", `${P}/shots/home.png`, "", "view"],
  ["GET", `${P}/layout`, "", "view"],
  ["GET", `${P}/resolve`, "", "view"],
  ["GET", `${P}/commits/abc1234`, "", "view"],
  ["GET", `${P}/commits/HEAD`, "", null],
  ["GET", `${P}/files`, "", "view"],
  ["GET", `${P}/files`, "?diagnostics=1", "edit"],
  ["POST", `${P}/files`, "", "edit"],
  ["PATCH", `${P}/files`, "", "edit"],
  ["POST", `${P}/ticket`, "", "view"],
  ...(["prompt", "stop", "undo", "restore", "dark", "preview", "device-shots", "lang"].map((r) => ["POST", `${P}/${r}`, "", "edit"]) as [string, string, string, Role][]),
  ...(["capture", "sim-capture", "reveal"].map((r) => ["POST", `${P}/${r}`, "", null]) as [string, string, string, null][]),
  ...(["export", "folder", "github", "release", "settings", "share"].map((r) => ["GET", `${P}/${r}`, "", null]) as [string, string, string, null][]),
  ["POST", `${P}/share`, "", null],
  ["DELETE", `${P}/share/invites/i_1`, "", null],
  ["PATCH", `${P}/share/members/u1`, "", null],
  ["POST", "/api/projects", "", null],
  ["POST", "/api/projects/import", "", null],
  ["GET", "/api/sim", "", null],
  ["POST", "/api/sim/abc/gesture", "", null],
  ["GET", "/api/info", "", null],
  ["GET", "/api/presence", "", null],
  ["GET", "/api/connect", "", null],
  ["POST", "/api/share/owner", "", null],
  ["POST", "/api/share/beacon", "", null],
  ["POST", "/api/pick-folder", "", null],
  ["GET", "/", "", null],
  ["GET", "/p/wander", "", null],
];

describe("guest policy", () => {
  for (const [method, path, search, min] of table) {
    it(`${method} ${path}${search} -> ${min ?? "denied"}`, () => {
      for (const role of ["view", "comment", "edit"] as Role[]) {
        expect(allowed(role, method, path, search)).toBe(min !== null && RANK[role] >= RANK[min]);
      }
    });
  }

  it("binds the project id", () => {
    expect(matchRule("GET", "/api/projects/other/board", "")?.projectId).toBe("other");
  });

  it("refuses encoded, dotted and odd paths", () => {
    for (const p of [`${P}/board/`, `${P}%2Fboard`, `/api/projects/p1/../p2/board`, `/api//projects/p1`, `${P}\\board`]) {
      expect(cleanPath(p)).toBe(false);
      expect(matchRule("GET", p, "")).toBeNull();
    }
  });

  it("allows tickets on images and raw files only", () => {
    expect(ticketOk("GET", `${P}/shots/a.png`, "")).toBe(true);
    expect(ticketOk("GET", `${P}/files`, "?raw=a.png")).toBe(true);
    expect(ticketOk("GET", `${P}/files`, "")).toBe(false);
    expect(ticketOk("GET", "/api/file-icon", "")).toBe(true);
    expect(ticketOk("POST", `${P}/shots/a.png`, "")).toBe(false);
    expect(ticketOk("GET", `${P}/board`, "")).toBe(false);
  });
});

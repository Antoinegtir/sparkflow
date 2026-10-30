import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

process.env.SPARKFLOW_HOME = mkdtempSync(join(tmpdir(), "sf-tickets-"));
const { mintTicket, readTicket } = await import("../lib/share/tickets");

describe("tickets", () => {
  afterEach(() => vi.useRealTimers());

  it("round-trips and binds uid and project", () => {
    const { ticket, exp } = mintTicket("u1", "p1");
    expect(readTicket(ticket)).toEqual({ uid: "u1", projectId: "p1" });
    expect(exp).toBeGreaterThan(Date.now() + 3_600_000 - 1);
  });

  it("refuses tampering", () => {
    const { ticket } = mintTicket("u1", "p1");
    const [v, , sig] = ticket.split(".");
    const forged = Buffer.from(JSON.stringify({ u: "u1", p: "p2", e: Date.now() + 1e9 })).toString("base64url");
    expect(readTicket(`${v}.${forged}.${sig}`)).toBeNull();
    expect(readTicket(`${ticket}x`)).toBeNull();
    expect(readTicket("t1.a")).toBeNull();
  });

  it("expires", () => {
    const { ticket } = mintTicket("u1", "p1");
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 3 * 3_600_000);
    expect(readTicket(ticket)).toBeNull();
  });
});

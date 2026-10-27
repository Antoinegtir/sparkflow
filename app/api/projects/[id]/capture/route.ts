import { captureTabPages } from "@/lib/web/capture";
import { findSubPages } from "@/lib/web/native-nav";
import { readTabs } from "@/lib/web/native-tabs";
import { handle, orchestrator, type RouteCtx } from "@/lib/web/server";
import { appearance, bootedDevices } from "@/lib/web/simulator";

export const dynamic = "force-dynamic";

const g = globalThis as unknown as { __sparkflowCapture?: Promise<string[]> | null };

/** Captures every page of the native app from the simulator. One capture at a time: tab taps must not interleave. */
export const POST = handle(async (req: Request, { params }: RouteCtx) => {
  const { id } = await params;
  const url = new URL(req.url);
  const [device] = await bootedDevices();
  if (!device) return Response.json({ error: "No simulator is booted" }, { status: 409 });
  if (g.__sparkflowCapture) return Response.json({ pages: await g.__sparkflowCapture });
  const job = (async () => {
    const o = orchestrator();
    const state = await o.getState(id);
    if (!state.native) throw new Error("Only native projects are captured from the simulator");
    const dark = url.searchParams.get("scheme") === "dark" || (await appearance(device.udid)) === "dark";
    const tabs = await readTabs(device.udid);
    const subs = await findSubPages(state.native.dir, tabs.map((t) => t.label));
    const pages = await captureTabPages(device.udid, subs);
    await o.recordNativePages(id, pages, { dark, refresh: url.searchParams.has("refresh"), device: /iPad/.test(device.name) ? device.name : undefined });
    return pages.map((p) => p.title);
  })();
  g.__sparkflowCapture = job;
  try {
    return Response.json({ pages: await job });
  } finally {
    g.__sparkflowCapture = null;
  }
});

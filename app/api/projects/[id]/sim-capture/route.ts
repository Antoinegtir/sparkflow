import { expoGoPath, previewPathFor } from "@/lib/shared";
import { installDevClient, openInDevClient } from "@/lib/web/dev-client";
import { handle, orchestrator, type RouteCtx } from "@/lib/web/server";
import { bootedDevice, frame, setAppearance } from "@/lib/web/simulator";

export const dynamic = "force-dynamic";

const g = globalThis as unknown as { __sparkflowSimCapture?: Promise<number> | null };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Captures every page of a generated app on the live Simulator (in Sparkflow Dev): each page is opened by
 * its deep link, then screenshotted. Stored as the "simulator" device's shots, in the appearance
 * asked for (?scheme=dark, the Simulator is switched to it). One capture at a time; pages already
 * captured at their current version are skipped unless ?refresh.
 */
export const POST = handle(async (req: Request, { params }: RouteCtx) => {
  const { id } = await params;
  const url = new URL(req.url);
  const refresh = url.searchParams.has("refresh");
  const dark = url.searchParams.get("scheme") === "dark";
  // The device shown in the IDE (?udid=): with a Simulator and an emulator both booted, the right one.
  const device = await bootedDevice(url.searchParams.get("udid"));
  if (!device) return Response.json({ error: "No simulator is booted" }, { status: 409 });
  if (g.__sparkflowSimCapture) return Response.json({ captured: await g.__sparkflowSimCapture });
  const job = (async () => {
    const o = orchestrator();
    const state = await o.getState(id);
    if (state.native) throw new Error("Native projects use the simulator capture");
    const preview = state.preview ?? (await o.ensurePreview(id));
    if (!preview?.expoGoUrl) throw new Error("No Metro link for this app");
    await setAppearance(device.udid, dark ? "dark" : "light").catch(() => {});
    const scheme = dark ? "dark" : "light";
    const stale = state.order.filter((r) => {
      const s = state.screens[r];
      return s && (refresh || s.devices?.simulator?.[scheme]?.version !== s.version);
    });
    if (!stale.length) return 0;
    await installDevClient(device.udid);
    const shots: { route: string; png: Buffer }[] = [];
    for (const [i, route] of stale.entries()) {
      const s = state.screens[route]!;
      const path = s.previewPath ?? previewPathFor(route);
      // The first link may load the app in Sparkflow Dev (and its dialogs); later ones only change the page.
      await openInDevClient(device.udid, preview.expoGoUrl, expoGoPath(path, route), { watch: i === 0 ? 10 : 3 });
      await sleep(i === 0 ? 2500 : 1200);
      shots.push({ route, png: await frame(device.udid, "png") });
    }
    await o.recordDeviceShots(id, "simulator", dark, shots);
    return shots.length;
  })();
  g.__sparkflowSimCapture = job;
  try {
    return Response.json({ captured: await job });
  } finally {
    g.__sparkflowSimCapture = null;
  }
});

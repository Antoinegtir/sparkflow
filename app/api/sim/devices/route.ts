import { z } from "zod";
import { handle } from "@/lib/web/server";
import { appearance, assertUdid, bootedDevices, simctl } from "@/lib/web/simulator";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const json = JSON.parse(await simctl("list", "devices", "available", "-j"));
  const out = Object.entries(json.devices as Record<string, { udid: string; name: string; state: string }[]>)
    .filter(([rt]) => /SimRuntime\.iOS-/.test(rt))
    .map(([rt, list]) => ({ runtime: "iOS " + rt.replace(/^.*iOS-/, "").replace(/-/g, "."), list }))
    .sort((a, b) => b.runtime.localeCompare(a.runtime, undefined, { numeric: true }))
    .flatMap(({ runtime, list }) => list.map((d) => ({ udid: d.udid, name: d.name, runtime, booted: d.state === "Booted", kind: /iPad/.test(d.name) ? "ipad" : "iphone" })));
  return Response.json(out);
});

const g = globalThis as unknown as { __sparkflowSwitch?: Promise<unknown> | null };

/** Switch the booted simulator, keeping the appearance and reinstalling the same app build. */
export const POST = handle(async (req: Request) => {
  const { udid, bundleId } = z.object({ udid: z.string(), bundleId: z.string().optional() }).parse(await req.json());
  assertUdid(udid);
  if (g.__sparkflowSwitch) return Response.json(await g.__sparkflowSwitch);
  const job = (async () => {
    const [current] = await bootedDevices();
    if (current?.udid === udid) return { switched: false };
    let app: string | null = null;
    let look: string = "light";
    if (current) {
      if (bundleId && /^[A-Za-z0-9.-]+$/.test(bundleId)) app = (await simctl("get_app_container", current.udid, bundleId, "app").catch(() => "")).trim() || null;
      look = await appearance(current.udid);
      await simctl("shutdown", current.udid).catch(() => {});
    }
    await simctl("boot", udid).catch((e: Error) => {
      if (!/current state: Booted/i.test(String(e.message))) throw e;
    });
    await simctl("bootstatus", udid, "-b");
    if (look === "dark" || look === "light") await simctl("ui", udid, "appearance", look).catch(() => {});
    let installed = false;
    if (app && bundleId) {
      await simctl("install", udid, app);
      await simctl("launch", "--terminate-running-process", udid, bundleId).catch(() => {});
      installed = true;
    }
    return { switched: true, installed };
  })();
  g.__sparkflowSwitch = job;
  try {
    return Response.json(await job);
  } finally {
    g.__sparkflowSwitch = null;
  }
});

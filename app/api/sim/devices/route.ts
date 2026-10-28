import { z } from "zod";
import * as android from "@/lib/web/android";
import { isMac } from "@/lib/web/platform";
import { handle } from "@/lib/web/server";
import { appearance, assertUdid, bootedDevices, setAppearance, simctl } from "@/lib/web/simulator";

export const dynamic = "force-dynamic";

const AVD = "avd:";

/** iOS Simulators (macOS) and Android emulators (AVDs). An AVD not running yet has the id "avd:<name>". */
export const GET = handle(async () => {
  const ios = isMac()
    ? Object.entries(JSON.parse(await simctl("list", "devices", "available", "-j").catch(() => '{"devices":{}}')).devices as Record<string, { udid: string; name: string; state: string }[]>)
        .filter(([rt]) => /SimRuntime\.iOS-/.test(rt))
        .map(([rt, list]) => ({ runtime: "iOS " + rt.replace(/^.*iOS-/, "").replace(/-/g, "."), list }))
        .sort((a, b) => b.runtime.localeCompare(a.runtime, undefined, { numeric: true }))
        .flatMap(({ runtime, list }) => list.map((d) => ({ udid: d.udid, name: d.name, runtime, booted: d.state === "Booted", kind: /iPad/.test(d.name) ? "ipad" : "iphone" })))
    : [];
  const [avds, running] = await Promise.all([android.listAvds(), android.bootedEmulators()]);
  const byAvd = new Map(await Promise.all(running.map(async (d) => [await android.avdOf(d.udid), d] as const)));
  const droid = avds.map((name) => {
    const d = byAvd.get(name);
    return { udid: d?.udid ?? AVD + name, name: name.replace(/_/g, " "), runtime: d?.runtime ?? "Android", booted: !!d, kind: "android" };
  });
  return Response.json([...ios, ...droid]);
});

const g = globalThis as unknown as { __sparkflowSwitch?: Promise<unknown> | null };

/** Switch the booted device, keeping the appearance (and, between iOS Simulators, reinstalling the same app build). */
export const POST = handle(async (req: Request) => {
  const { udid, bundleId } = z.object({ udid: z.string(), bundleId: z.string().optional() }).parse(await req.json());
  const avd = udid.startsWith(AVD) ? udid.slice(AVD.length) : null;
  if (!avd) assertUdid(udid);
  if (g.__sparkflowSwitch) return Response.json(await g.__sparkflowSwitch);
  const job = (async () => {
    const [current] = await bootedDevices();
    if (current?.udid === udid) return { switched: false };
    let app: string | null = null;
    let look: string = "light";
    if (current) {
      look = await appearance(current.udid);
      if (current.platform === "android") await android.shutdown(current.udid);
      else {
        if (!avd && bundleId && /^[A-Za-z0-9.-]+$/.test(bundleId)) app = (await simctl("get_app_container", current.udid, bundleId, "app").catch(() => "")).trim() || null;
        await simctl("shutdown", current.udid).catch(() => {});
      }
    }
    if (avd || android.isAndroidId(udid)) {
      // An emulator already running only needs the current device out of the way.
      const serial = avd ? await android.bootAvd(avd) : udid;
      if (look === "dark" || look === "light") await setAppearance(serial, look).catch(() => {});
      return { switched: true, installed: false };
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

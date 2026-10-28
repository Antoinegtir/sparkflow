import { handle } from "@/lib/web/server";
import { idbAvailable, screenPoints } from "@/lib/web/idb";
import { bootedDevices, devicesSupported, inputDriver } from "@/lib/web/simulator";

export const dynamic = "force-dynamic";

/** Booted simulators and emulators with their size in points, the input driver and whether live streaming is available. */
export const GET = handle(async () => {
  if (!(await devicesSupported())) return Response.json({ supported: false, devices: [] });
  const [booted, driver] = await Promise.all([bootedDevices(), inputDriver()]);
  const stream = idbAvailable();
  const devices = await Promise.all(
    booted.map(async (d) => {
      // Android: adb gives the size, input and (polled) frames.
      if (d.platform === "android") return { ...d, ipad: false, points: await screenPoints(d.udid).catch(() => null), input: "adb", stream: true };
      return {
        ...d,
        ipad: /iPad/.test(d.name),
        points: stream ? await screenPoints(d.udid).catch(() => null) : null,
        input: stream ? "idb" : (driver?.kind ?? null),
        stream,
      };
    }),
  );
  return Response.json({ supported: true, devices });
});

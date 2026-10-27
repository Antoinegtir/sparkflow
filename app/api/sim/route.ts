import os from "node:os";
import { handle } from "@/lib/web/server";
import { idbAvailable, screenPoints } from "@/lib/web/idb";
import { bootedDevices, inputDriver } from "@/lib/web/simulator";

export const dynamic = "force-dynamic";

/** Booted simulators with their size in points, the input driver and whether live streaming is available. */
export const GET = handle(async () => {
  if (os.platform() !== "darwin") return Response.json({ supported: false, devices: [] });
  const [booted, driver] = await Promise.all([bootedDevices(), inputDriver()]);
  const stream = idbAvailable();
  const devices = await Promise.all(
    booted.map(async (d) => ({
      ...d,
      ipad: /iPad/.test(d.name),
      points: stream ? await screenPoints(d.udid).catch(() => null) : null,
      input: stream ? "idb" : (driver?.kind ?? null),
      stream,
    })),
  );
  return Response.json({ supported: true, devices });
});

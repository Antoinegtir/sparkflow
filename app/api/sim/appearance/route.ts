import { z } from "zod";
import { handle } from "@/lib/web/server";
import { appearance, bootedDevice, setAppearance } from "@/lib/web/simulator";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const d = await bootedDevice(new URL(req.url).searchParams.get("udid"));
  return Response.json({ appearance: d ? await appearance(d.udid) : null });
});

export const POST = handle(async (req: Request) => {
  // `udid`: the device shown in the IDE (an iOS Simulator or an Android emulator), else the booted Simulator.
  const { appearance: look, udid } = z.object({ appearance: z.enum(["light", "dark"]), udid: z.string().regex(/^[\w-]+$/).optional() }).parse(await req.json());
  const target = (await bootedDevice(udid))?.udid;
  if (!target) return Response.json({ error: "No simulator is booted" }, { status: 409 });
  await setAppearance(target, look);
  return Response.json({ ok: true });
});

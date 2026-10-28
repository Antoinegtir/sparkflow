import { z } from "zod";
import { handle } from "@/lib/web/server";
import { appearance, bootedDevices, setAppearance } from "@/lib/web/simulator";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const [d] = await bootedDevices();
  return Response.json({ appearance: d ? await appearance(d.udid) : null });
});

export const POST = handle(async (req: Request) => {
  const { appearance: look } = z.object({ appearance: z.enum(["light", "dark"]) }).parse(await req.json());
  const [d] = await bootedDevices();
  if (!d) return Response.json({ error: "No simulator is booted" }, { status: 409 });
  await setAppearance(d.udid, look);
  return Response.json({ ok: true });
});

import { z } from "zod";
import { assertUdid, launch } from "@/lib/web/simulator";
import { handle, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request, { params }: RouteCtx<{ udid: string }>) => {
  const body = z.object({ bundleId: z.string().optional(), url: z.string().optional() }).parse(await req.json());
  await launch(assertUdid((await params).udid), body);
  return Response.json({ ok: true });
});

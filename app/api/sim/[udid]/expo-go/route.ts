import { z } from "zod";
import { ensureExpoGo, openInExpoGo } from "@/lib/web/expo-go";
import { assertUdid } from "@/lib/web/simulator";
import { handle, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

/** Installs Expo Go on the Simulator if needed (or for another SDK), then opens the app's exp:// URL in it. */
export const POST = handle(async (req: Request, { params }: RouteCtx<{ udid: string }>) => {
  const udid = assertUdid((await params).udid);
  const { url } = z.object({ url: z.string().regex(/^exps?:\/\//) }).parse(await req.json());
  const version = await ensureExpoGo(udid);
  await openInExpoGo(udid, url);
  return Response.json({ version });
});

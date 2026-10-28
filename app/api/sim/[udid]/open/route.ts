import { z } from "zod";
import { installDevClient, openInDevClient, splitExpUrl } from "@/lib/web/dev-client";
import { assertUdid } from "@/lib/web/simulator";
import { handle, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

/**
 * Opens a generated app in Sparkflow Dev on a Simulator or emulator: builds the dev client the first
 * time (about 6 minutes on iOS, 15 on Android, progress at GET /api/sim/dev-client), installs it, then loads the app's Metro
 * at `path` (or the "/--/path" of an exp:// link).
 */
export const POST = handle(async (req: Request, { params }: RouteCtx<{ udid: string }>) => {
  const udid = assertUdid((await params).udid);
  const { url, path } = z.object({ url: z.string().regex(/^(exps?|https?):\/\//), path: z.string().startsWith("/").optional() }).parse(await req.json());
  const hash = await installDevClient(udid);
  await openInDevClient(udid, url, path ?? splitExpUrl(url).path);
  return Response.json({ hash });
});

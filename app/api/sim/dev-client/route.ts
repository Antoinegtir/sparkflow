import { z } from "zod";
import { devClientBuilt, devClientStatus, ensureDevClient } from "@/lib/web/dev-client";
import { handle } from "@/lib/web/server";

export const dynamic = "force-dynamic";

/** The Sparkflow Dev build: { state, platform, step, percent, error, log } plus whether ?platform is built. */
export const GET = handle(async (req: Request) => {
  const platform = new URL(req.url).searchParams.get("platform");
  const built = platform === "ios" || platform === "android" ? await devClientBuilt(platform) : undefined;
  return Response.json({ ...devClientStatus(), built });
});

/** Starts building Sparkflow Dev for a platform in the background (no-op when cached). */
export const POST = handle(async (req: Request) => {
  const { platform } = z.object({ platform: z.enum(["ios", "android"]) }).parse(await req.json());
  void ensureDevClient(platform).catch(() => {});
  return Response.json(devClientStatus(), { status: 202 });
});

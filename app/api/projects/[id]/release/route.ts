import { z } from "zod";
import { NotReadyError, releaseJob, startRelease } from "@/lib/web/release";
import { handle, orchestrator, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

/** The app's last native build or upload: step, log, result. */
export const GET = handle(async (_req: Request, { params }: RouteCtx) => Response.json({ job: releaseJob((await params).id) }));

/** Starts a native Release build (installed on a Simulator / emulator) or a fastlane upload to the stores. */
export const POST = handle(async (req: Request, { params }: RouteCtx) => {
  const { action, platform, device } = z
    .object({ action: z.enum(["build", "deploy"]), platform: z.enum(["ios", "android"]), device: z.string().regex(/^[\w-]+$/).optional() })
    .parse(await req.json());
  const target = await orchestrator().releaseTarget((await params).id);
  try {
    return Response.json({ job: await startRelease(target, action, platform, device) });
  } catch (err) {
    // Missing setup: said up front, with the list, rather than as a failed job.
    if (err instanceof NotReadyError) return Response.json({ error: err.message, missing: err.missing, setup: platform }, { status: 409 });
    throw err;
  }
});

import { handle, orchestrator } from "@/lib/web/server";

export const dynamic = "force-dynamic";

/** Recreates the Wander demo when it's missing from this computer, and says where it is. */
export const POST = handle(async () => Response.json({ id: await orchestrator().ensureDemo() }));

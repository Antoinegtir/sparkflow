import { handle, orchestrator } from "@/lib/web/server";

export const dynamic = "force-dynamic";

export const GET = handle(async () => Response.json(await orchestrator().info()));

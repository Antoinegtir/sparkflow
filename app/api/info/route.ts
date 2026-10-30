import { handle, orchestrator } from "@/lib/web/server";

export const dynamic = "force-dynamic";

// features lets a newer site tell what this server supports (Share needs "share").
export const GET = handle(async () => Response.json({ ...(await orchestrator().info()), features: ["share"] }));

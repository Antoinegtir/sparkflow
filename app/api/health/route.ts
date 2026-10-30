import { CLOUD } from "@/lib/cloud/mode";

export const dynamic = "force-dynamic";

/** Up and which kind: Cloud Run's health check, and the site telling a cloud server from a Mac. */
export const GET = () => Response.json({ ok: true, cloud: CLOUD });

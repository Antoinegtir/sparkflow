import { CLOUD, projectsOf, setProjectOwner } from "@/lib/cloud/mode";
import { handle, orchestrator } from "@/lib/web/server";

export const dynamic = "force-dynamic";

/** Recreates the Wander demo when it's missing (in the cloud: the caller's own), and says where it is. */
export const POST = handle(async (req: Request) => {
  const uid = CLOUD ? req.headers.get("x-sparkflow-uid") : null;
  if (CLOUD && !uid) return Response.json({ error: "Sign in first" }, { status: 401 });
  const scope = uid ? { mine: projectsOf(uid), claim: (id: string) => setProjectOwner(id, uid) } : undefined;
  return Response.json({ id: await orchestrator().ensureDemo(scope) });
});

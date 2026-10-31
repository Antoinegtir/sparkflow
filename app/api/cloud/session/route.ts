import { z } from "zod";
import { CLOUD, createSession, DAILY_RUNS, runsLeft } from "@/lib/cloud/mode";
import { identityFromIdToken } from "@/lib/cloud/identity";
import { avatarFor, nameFor } from "@/lib/share/firebase";
import { handle } from "@/lib/web/server";

export const dynamic = "force-dynamic";

/**
 * Sparkflow in the cloud: trades a Firebase ID token (a GitHub or Google sign-in on the site) for a
 * session key. The token is checked with Firebase itself (accounts:lookup), never trusted as sent.
 */
export const POST = handle(async (req: Request) => {
  if (!CLOUD) return Response.json({ error: "Not found" }, { status: 404 });
  const { idToken } = z.object({ idToken: z.string().min(20).max(4000) }).parse(await req.json());
  const id = await identityFromIdToken(idToken);
  if (!id) return Response.json({ error: "Sign in with GitHub or Google to use Sparkflow in the cloud.", code: "signin" }, { status: 401 });
  // Their name and picture are kept: the friends they share an app with see who it's from.
  const token = createSession({ uid: id.uid, email: id.email, name: id.name ?? "" }, { name: nameFor(id), email: id.email, avatar: avatarFor(id), gh: id.gh });
  return Response.json({ token, runsLeft: runsLeft(id.uid), dailyRuns: DAILY_RUNS });
});

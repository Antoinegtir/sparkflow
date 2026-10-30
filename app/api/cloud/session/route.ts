import { z } from "zod";
import { CLOUD, createSession, DAILY_RUNS, runsLeft } from "@/lib/cloud/mode";
import { FIREBASE_CONFIG } from "@/lib/shared/firebase-config";
import { handle } from "@/lib/web/server";

export const dynamic = "force-dynamic";

/**
 * Sparkflow in the cloud: trades a Firebase ID token (a GitHub or Google sign-in on the site) for a
 * session key. The token is checked with Firebase itself (accounts:lookup), never trusted as sent.
 */
export const POST = handle(async (req: Request) => {
  if (!CLOUD) return Response.json({ error: "Not found" }, { status: 404 });
  const { idToken } = z.object({ idToken: z.string().min(20).max(4000) }).parse(await req.json());
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_CONFIG.apiKey}`, {
    method: "POST",
    headers: { "content-type": "application/json", Referer: "https://sparkflow-ai.web.app/" },
    body: JSON.stringify({ idToken }),
  });
  const user = res.ok ? (await res.json()).users?.[0] : null;
  const providers: string[] = (user?.providerUserInfo ?? []).map((p: { providerId: string }) => p.providerId);
  // A real account only (GitHub or Google), not an anonymous one.
  if (!user?.localId || !providers.some((p) => p === "github.com" || p === "google.com")) {
    return Response.json({ error: "Sign in with GitHub or Google to use Sparkflow in the cloud.", code: "signin" }, { status: 401 });
  }
  const token = createSession({ uid: user.localId, email: user.email ?? "", name: user.displayName ?? "" });
  return Response.json({ token, runsLeft: runsLeft(user.localId), dailyRuns: DAILY_RUNS });
});

import { handle } from "@/lib/web/server";

export const dynamic = "force-dynamic";

type Taken = "taken" | "free" | "unknown";

/**
 * Whether an app ID is already used on the stores: the App Store's lookup API (by bundle ID) and
 * Google Play's app page (by package). "unknown" when a store couldn't be reached.
 */
export const GET = handle(async (req: Request) => {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[A-Za-z][\w-]*(\.[A-Za-z][\w-]*)+$/.test(id)) return Response.json({ error: "Invalid ID" }, { status: 400 });
  const timeout = AbortSignal.timeout(6000);
  const ios: Promise<Taken> = fetch(`https://itunes.apple.com/lookup?bundleId=${encodeURIComponent(id)}`, { signal: timeout })
    .then((r) => r.json())
    .then((j: { resultCount?: number }) => (j.resultCount ? "taken" : "free"))
    .catch(() => "unknown");
  const android: Promise<Taken> = fetch(`https://play.google.com/store/apps/details?id=${encodeURIComponent(id)}&hl=en`, { signal: timeout, redirect: "manual" })
    .then((r) => (r.status === 200 ? "taken" : r.status === 404 ? "free" : "unknown"))
    .catch(() => "unknown");
  return Response.json({ ios: await ios, android: await android });
});

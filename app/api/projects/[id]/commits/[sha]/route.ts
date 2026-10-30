import { actorOf, guestReadable } from "@/lib/share/actor";
import { handle, orchestrator, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

/** Drops the parts of a `git show` patch (and stat lines) about files a guest may not read. */
function filterDiff(d: { stat: string; patch: string }) {
  const parts = d.patch.split(/(?=^diff --git )/m);
  const patch = parts
    .filter((part) => {
      const m = part.match(/^diff --git a\/(.+?) b\/(.+)$/m);
      return !m || (guestReadable(m[1]) && guestReadable(m[2]));
    })
    .join("");
  const stat = d.stat
    .split("\n")
    .filter((line) => {
      const m = line.match(/^\s*(\S.*?)\s+\|\s/);
      return !m || guestReadable(m[1]);
    })
    .join("\n");
  return { stat, patch };
}

export const GET = handle(async (req: Request, { params }: RouteCtx<{ id: string; sha: string }>) => {
  const { id, sha } = await params;
  const guest = actorOf(req).kind === "guest";
  if (guest && !/^[0-9a-f]{7,40}$/.test(sha)) return Response.json({ error: "Invalid commit" }, { status: 400 });
  const diff = await orchestrator().commitDiff(id, sha);
  return Response.json(guest ? { ...diff, ...filterDiff(diff) } : diff);
});

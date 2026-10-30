"use client";

import { useEffect } from "react";
import { watchUser } from "./auth";
import { writeProof } from "./share";

/**
 * The owner's name and avatar on their own comments: registered from a signed proof as soon as they're
 * signed in on the site (not only when they open Share), once per server. Older comments, which have no
 * author, are the owner's and show it too.
 */
export function useOwnerProfile(projectId: string, isOwner: boolean, onDone: () => void) {
  useEffect(() => {
    if (!isOwner) return;
    let done = false;
    const stop = watchUser(async (u) => {
      if (!u || done) return;
      done = true;
      try {
        const r = await fetch(`/api/projects/${projectId}/share`, { cache: "no-store" });
        if (!r.ok) return;
        const s = (await r.json()) as { owner?: unknown; serverUid?: string };
        if (s.owner || !s.serverUid) return;
        const proof = await writeProof(s.serverUid);
        const res = await fetch("/api/share/owner", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ proof }) });
        if (res.ok) onDone();
      } catch {}
    });
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, isOwner]);
}

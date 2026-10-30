"use client";

import { useEffect } from "react";
import { auth, watchUser } from "./auth";
import { PROFILE_EVENT } from "./profile";
import { writeProof } from "./share";

/**
 * The owner's name and avatar on their own comments: registered from a signed proof as soon as they're
 * signed in on the site (not only when they open Share), once per server and again after a profile change. Older comments, which have no
 * author, are the owner's and show it too.
 */
export function useOwnerProfile(projectId: string, isOwner: boolean, onDone: () => void) {
  useEffect(() => {
    if (!isOwner) return;
    let done = false;
    const register = async (u: NonNullable<ReturnType<typeof auth>["currentUser"]>) => {
      try {
        const r = await fetch(`/api/projects/${projectId}/share`, { cache: "no-store" });
        if (!r.ok) return;
        const s = (await r.json()) as { owner?: { name?: string; avatar?: string | null }; serverUid?: string };
        if (!s.serverUid) return;
        // Registered already, with the same profile (Settings › Account can change the name and picture).
        if (s.owner && (!u.displayName || s.owner.name === u.displayName) && (!u.photoURL || s.owner.avatar === u.photoURL)) return;
        const proof = await writeProof(s.serverUid);
        const res = await fetch("/api/share/owner", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ proof }) });
        if (res.ok) onDone();
      } catch {}
    };
    const stop = watchUser((u) => {
      if (!u || done) return;
      done = true;
      void register(u);
    });
    // A new picture or name: registered again right away, so comments and Share show it without a reload.
    const changed = () => auth().currentUser && void register(auth().currentUser!);
    addEventListener(PROFILE_EVENT, changed);
    return () => {
      stop();
      removeEventListener(PROFILE_EVENT, changed);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, isOwner]);
}

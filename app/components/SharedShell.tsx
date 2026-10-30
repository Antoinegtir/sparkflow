"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IDE } from "@/app/components/ide/IDE";
import { SignIn } from "@/app/components/SignIn";
import type { Access, JoinResult, SharedEntry } from "@/lib/shared/share";
import { requireSignIn } from "@/lib/web/auth";
import { loadCloudCopy } from "@/lib/web/cloud-copy";
import { OfflineCopy } from "./OfflineCopy";
import { entryId, getTicket, loadShared, openSession, saveShared, ShareError, updateShared, watchServer, writeProof } from "@/lib/web/share";

type Phase = { kind: "signin" } | { kind: "connecting" } | { kind: "gone" } | { kind: "error"; message: string } | { kind: "ready"; access: Access; slug: string };

export function entryFrom(serverUid: string, r: JoinResult, url: string | null, devUrl?: string): SharedEntry {
  return { serverUid, projectId: r.projectId, key: r.key, uid: r.me, role: r.role, name: r.name, slug: r.slug, url, owner: r.owner, joinedAt: Date.now(), ...(devUrl ? { devUrl } : {}) };
}

/**
 * A project someone shared with you, opened from their computer at /s/<serverUid>/<projectId>.
 * Finds their server through Firestore, gets (or renews) your key with a one-time identity proof,
 * then shows the IDE with what your role allows.
 */
export function SharedShell({ serverUid, projectId, page }: { serverUid: string; projectId: string; page: string[] }) {
  const id = entryId(serverUid, projectId);
  const [phase, setPhase] = useState<Phase>({ kind: "signin" });
  const [url, setUrl] = useState<string | null | undefined>(() => {
    const e = loadShared()[id];
    return e?.devUrl ?? undefined;
  });
  const [unreachable, setUnreachable] = useState(false);
  // While the owner's computer is offline: the project's cloud copy (its last saved pages), if any.
  const [copy, setCopy] = useState<Awaited<ReturnType<typeof loadCloudCopy>>>(null);
  useEffect(() => {
    if (!unreachable || phase.kind === "ready") return setCopy(null);
    let live = true;
    void requireSignIn("Sign in to see this shared project").then((ok) => ok && loadCloudCopy(serverUid, projectId).then((c) => live && setCopy(c)));
    return () => {
      live = false;
    };
  }, [unreachable, phase.kind, serverUid, projectId]);
  const sessionTried = useRef(false);

  // The owner's tunnel link follows their computer: offline, restarted, back.
  useEffect(() => {
    if (loadShared()[id]?.devUrl) return;
    return watchServer(serverUid, (u) => {
      updateShared(id, { url: u });
      setUrl(u);
    });
  }, [serverUid, id]);

  const session = useCallback(
    async (backend: string) => {
      const proof = await writeProof(serverUid);
      const r = await openSession(backend, projectId, proof);
      const prev = loadShared()[id];
      saveShared(id, entryFrom(serverUid, r, prev?.url ?? backend, prev?.devUrl));
    },
    [serverUid, projectId, id],
  );

  const connect = useCallback(
    async (backend: string) => {
      setPhase((p) => (p.kind === "ready" ? p : { kind: "connecting" }));
      try {
        if (!loadShared()[id]?.key) {
          sessionTried.current = true;
          await session(backend);
        }
        let res = await fetch(`/api/projects/${projectId}/access`, { cache: "no-store" });
        let body = (await res.clone().json().catch(() => ({}))) as { code?: string };
        // A lapsed or unknown key: prove who you are again, once.
        if (res.status === 401 && (body.code === "key" || body.code === "expired" || !body.code) && !sessionTried.current) {
          sessionTried.current = true;
          await session(backend);
          res = await fetch(`/api/projects/${projectId}/access`, { cache: "no-store" });
          body = (await res.clone().json().catch(() => ({}))) as { code?: string };
        }
        if ((res.status === 401 && body.code === "revoked") || (res.status === 403 && body.code === "not-member")) {
          saveShared(id, null);
          return setPhase({ kind: "gone" });
        }
        if (!res.ok) throw new Error(`The owner's computer answered ${res.status}.`);
        const access = (await res.json()) as Access;
        // Images and frames load with this ticket (guestSrc reads it synchronously): have it before the IDE mounts.
        if (!(await getTicket(projectId))) throw new Error("The owner's computer did not grant access to previews. Try again.");
        setUnreachable(false);
        const slug = loadShared()[id]?.slug ?? projectId;
        setPhase({ kind: "ready", access, slug });
      } catch (err) {
        if (err instanceof ShareError && (err.body.code === "not-member" || err.status === 403)) {
          saveShared(id, null);
          return setPhase({ kind: "gone" });
        }
        if (err instanceof TypeError) return setUnreachable(true);
        setPhase((p) => (p.kind === "ready" ? p : { kind: "error", message: (err as Error).message }));
      }
    },
    [id, projectId, session],
  );

  useEffect(() => {
    if (!url) {
      if (url === null) setUnreachable(true);
      return;
    }
    let cancelled = false;
    void requireSignIn("Sign in to open this shared project").then((ok) => {
      if (cancelled) return;
      if (!ok) return setPhase({ kind: "signin" });
      void connect(url);
    });
    return () => {
      cancelled = true;
    };
  }, [url, connect]);

  const banner = unreachable && (
    <div className="fixed inset-x-0 top-0 z-50 bg-amber-500/90 px-4 py-1.5 text-center text-xs text-black">The owner&apos;s computer is offline. This page reconnects when it is back.</div>
  );

  if (phase.kind === "ready")
    return (
      <>
        {banner}
        <IDE id={projectId} slug={phase.slug} initialPage={page} access={phase.access} basePath={`/s/${serverUid}/${projectId}`} />
      </>
    );

  if (copy) return <OfflineCopy copy={copy} />;

  return (
    <div data-ide className="grid h-screen place-items-center px-4 text-center text-sm text-ink-400">
      {banner}
      <div className="fixed right-4 top-3">
        <SignIn />
      </div>
      <div className="max-w-sm space-y-3">
        {phase.kind === "gone" ? (
          <p>You no longer have access to this project.</p>
        ) : phase.kind === "error" ? (
          <p>{phase.message}</p>
        ) : url === null ? (
          <p>Waiting for the owner&apos;s computer to come online…</p>
        ) : phase.kind === "signin" && url ? (
          <p>Sign in to open this shared project.</p>
        ) : (
          <p>Connecting to the owner&apos;s computer…</p>
        )}
        {(phase.kind === "gone" || phase.kind === "error") && (
          <a href="/" className="text-spark-400 hover:underline">
            Back to Sparkflow
          </a>
        )}
      </div>
    </div>
  );
}

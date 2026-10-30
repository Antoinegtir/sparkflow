"use client";

import { useEffect, useState } from "react";
import { entryFrom } from "@/app/components/SharedShell";
import { SignIn } from "@/app/components/SignIn";
import { trustedAvatar, type Person, type PreviewResult } from "@/lib/shared/share";
import { requireSignIn } from "@/lib/web/auth";
import { devHint, entryId, joinInvite, parseInvite, previewInvite, saveShared, ShareError, watchServer, writeProof } from "@/lib/web/share";

const PENDING = "sparkflow.pendingInvite";
type Invite = NonNullable<ReturnType<typeof parseInvite>>;
type View =
  | { kind: "loading" }
  | { kind: "bad" }
  | { kind: "offline" }
  | { kind: "old" }
  | { kind: "ended"; code: string }
  | { kind: "own"; slug: string }
  | { kind: "preview"; preview: PreviewResult; busy: boolean; error: string | null };

/** Read once: the secret leaves the address bar (and history) right away, kept for this tab only. */
function takeInvite(): Invite | null {
  const fromHash = location.hash ? parseInvite(location.hash) : null;
  if (fromHash) {
    try {
      sessionStorage.setItem(PENDING, location.hash);
    } catch {}
    history.replaceState(null, "", location.pathname + location.search);
    return fromHash;
  }
  try {
    return parseInvite(sessionStorage.getItem(PENDING) ?? "");
  } catch {
    return null;
  }
}

function Face({ person }: { person: Person | null }) {
  const name = person?.name ?? "Someone";
  // Only known hosts: a picture URL from anywhere else could track who opens the link.
  if (trustedAvatar(person?.avatar)) {
    return <img src={person!.avatar!} alt="" className="size-12 rounded-full" referrerPolicy="no-referrer" />;
  }
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return <div className="grid size-12 place-items-center rounded-full bg-spark-500/20 text-sm font-medium text-spark-300">{initials || "?"}</div>;
}

const ROLE: Record<string, string> = { edit: "edit", comment: "comment on", view: "view" };

/** /join#<serverUid>.<inviteId>.<secret>: an invite to a project on someone's computer. */
export default function JoinPage() {
  const [invite, setInvite] = useState<Invite | null | undefined>(undefined);
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  const [view, setView] = useState<View>({ kind: "loading" });

  useEffect(() => {
    const i = takeInvite();
    setInvite(i);
    if (!i) setView({ kind: "bad" });
  }, []);

  // The link holds no address: the owner's computer publishes its current one.
  useEffect(() => {
    if (!invite) return;
    const dev = devHint(invite.b);
    if (dev) return setUrl(dev);
    return watchServer(invite.serverUid, setUrl);
  }, [invite]);

  useEffect(() => {
    if (!invite || url === undefined) return;
    if (url === null) return setView({ kind: "offline" });
    let cancelled = false;
    previewInvite(url, invite.invite)
      .then((preview) => !cancelled && setView({ kind: "preview", preview, busy: false, error: null }))
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ShareError) setView(err.status === 404 && !err.body.code ? { kind: "old" } : { kind: "ended", code: String(err.body.code ?? "invalid") });
        else setView({ kind: "offline" });
      });
    return () => {
      cancelled = true;
    };
  }, [invite, url]);

  async function join() {
    if (!invite || !url || view.kind !== "preview") return;
    setView({ ...view, busy: true, error: null });
    try {
      if (!(await requireSignIn("Sign in to join this project"))) return setView({ ...view, busy: false });
      const proof = await writeProof(invite.serverUid);
      const r = await joinInvite(url, invite.invite, proof);
      const dev = devHint(invite.b);
      saveShared(entryId(invite.serverUid, r.projectId), entryFrom(invite.serverUid, r, dev ? null : url, dev ?? undefined));
      try {
        sessionStorage.removeItem(PENDING);
      } catch {}
      location.replace(`/s/${invite.serverUid}/${r.projectId}`);
    } catch (err) {
      if (err instanceof ShareError && err.status === 409 && err.body.owner) return setView({ kind: "own", slug: String(err.body.slug ?? "") });
      if (err instanceof ShareError && err.status === 410) return setView({ kind: "ended", code: String(err.body.code ?? "invalid") });
      setView({ ...view, busy: false, error: (err as Error).message });
    }
  }

  return (
    <div data-ide className="grid min-h-screen place-items-center px-4 text-center text-sm text-ink-300">
      <div className="fixed right-4 top-3">
        <SignIn />
      </div>
      <div className="w-full max-w-sm space-y-4">
        {view.kind === "loading" && <p className="text-ink-400">Opening the invite…</p>}
        {view.kind === "bad" && <p>This invite link is incomplete. Ask for a new one.</p>}
        {view.kind === "offline" && <p>The owner&apos;s computer is offline. This page continues as soon as it is back.</p>}
        {view.kind === "old" && <p>The owner&apos;s Sparkflow is too old to share projects. Ask them to update it.</p>}
        {view.kind === "ended" && (
          <p>
            {view.code === "expired"
              ? "This invite has expired."
              : view.code === "used"
                ? "This invite was already used."
                : view.code === "revoked"
                  ? "This invite was revoked, or you were removed from the project."
                  : "This invite isn't valid."}{" "}
            Ask the owner for a new one.
          </p>
        )}
        {view.kind === "own" && (
          <p>
            This is your own project.{" "}
            <a href={`/${view.slug}`} className="text-spark-400 hover:underline">
              Open it
            </a>
          </p>
        )}
        {view.kind === "preview" && (
          <div className="space-y-4 rounded-xl border border-ink-800 p-6">
            <div className="flex justify-center">
              <Face person={view.preview.owner} />
            </div>
            <p>
              <span className="text-ink-100">{view.preview.owner?.name ?? "Someone"}</span> invites you to {ROLE[view.preview.role] ?? "view"}{" "}
              <span className="text-ink-100">{view.preview.projectName}</span>.
            </p>
            <button
              onClick={join}
              disabled={view.busy}
              className="w-full rounded-lg bg-spark-500 px-4 py-2 font-medium text-white hover:bg-spark-400 disabled:opacity-60"
            >
              {view.busy ? "Joining…" : "Join"}
            </button>
            {view.error && <p className="text-red-400">{view.error}</p>}
          </div>
        )}
        {view.kind !== "preview" && view.kind !== "loading" && (
          <a href="/" className="block text-spark-400 hover:underline">
            Back to Sparkflow
          </a>
        )}
      </div>
    </div>
  );
}

"use client";

import clsx from "clsx";
import { Check, Copy, Link2, Loader2, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CreateInviteBody, Person, Role, ShareListing } from "@/lib/shared/share";
import { requireSignIn } from "@/lib/web/auth";
import { writeProof } from "@/lib/web/share";
import { Avatar } from "./Avatar";

const ROLE_LABEL: Record<Role, string> = { edit: "Can edit", comment: "Can comment", view: "Can view" };
const ROLES: Role[] = ["edit", "comment", "view"];
const EXPIRY: { label: string; value: CreateInviteBody["expiresInDays"] }[] = [
  { label: "1 day", value: 1 },
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "Never", value: null },
];

const until = (t: number | null) => (t === null ? "never expires" : t < Date.now() ? "expired" : `expires ${new Date(t).toLocaleDateString()}`);

/** Plain words for what went wrong: the server's own error, or the usual causes. */
async function failure(r: Response) {
  if (r.status === 404) return "This sparkflow is too old to share apps. Update it, then try again.";
  const j = await r.json().catch(() => null);
  const m = typeof j?.error === "string" ? j.error : "";
  if (/anonymous|ADMIN_ONLY_OPERATION|OPERATION_NOT_ALLOWED/i.test(m)) return "Sharing is turned off on the sign-in service (anonymous accounts are disabled).";
  return m || `Request failed (${r.status})`;
}

export function ShareDialog({ projectId, appName, onClose, onChanged }: { projectId: string; appName: string; onClose: () => void; onChanged?: () => void }) {
  const [share, setShare] = useState<ShareListing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("comment");
  const [days, setDays] = useState<CreateInviteBody["expiresInDays"]>(7);
  const [once, setOnce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const claimed = useRef(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/projects/${projectId}/share`, { cache: "no-store" });
      if (!r.ok) throw new Error(await failure(r));
      const s = (await r.json()) as ShareListing;
      setShare(s);
      return s;
    } catch (e) {
      setError(e instanceof TypeError ? "sparkflow is offline on your Mac." : (e as Error).message);
      return null;
    }
  }, [projectId]);

  // The owner's name and avatar come from a signed proof, once (or again if the server forgot it).
  useEffect(() => {
    void (async () => {
      const s = await load();
      if (!s || s.owner || claimed.current || !s.serverUid) return;
      claimed.current = true;
      if (!(await requireSignIn("Sign in so the people you invite see who shares this app."))) return;
      try {
        const proof = await writeProof(s.serverUid);
        const r = await fetch("/api/share/owner", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ proof }) });
        if (!r.ok) throw new Error(await failure(r));
        await load();
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);

  const call = async (url: string, init: RequestInit) => {
    setError(null);
    try {
      const r = await fetch(url, { ...init, headers: { "content-type": "application/json" } });
      if (!r.ok) throw new Error(await failure(r));
      await load();
      onChanged?.();
      return r;
    } catch (e) {
      setError(e instanceof TypeError ? "sparkflow is offline on your Mac." : (e as Error).message);
      return null;
    }
  };

  const create = async () => {
    setBusy(true);
    setLink(null);
    const body: CreateInviteBody = { role, expiresInDays: days, maxUses: once ? 1 : null };
    const r = await call(`/api/projects/${projectId}/share`, { method: "POST", body: JSON.stringify(body) });
    setBusy(false);
    if (!r) return;
    const j = (await r.json()) as { serverUid: string; inviteId: string; secret: string };
    // The secret lives only in the fragment: it never reaches a server log.
    const local = location.hostname === "localhost" || location.hostname === "127.0.0.1";
    setLink(`${location.origin}/join#${j.serverUid}.${j.inviteId}.${j.secret}${local ? `&b=${location.origin}` : ""}`);
    setCopied(false);
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {}
  };

  const owner: Person = share?.owner ?? { name: "You", avatar: null, role: "owner" };
  const invites = share?.invites.filter((i) => !i.revokedAt) ?? [];
  const members = share?.members.filter((m) => !m.revokedAt) ?? [];

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label={`Share ${appName}`} className="flex max-h-[85vh] w-full max-w-[480px] flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] text-ink-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <h2 className="truncate text-[14px] font-semibold">Share {appName}</h2>
          <button onClick={onClose} aria-label="Close" className="grid size-7 cursor-pointer place-items-center rounded-lg text-ink-400 hover:bg-ink-800 hover:text-ink-100">
            <X size={15} />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 text-[12.5px]">
          {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-300">{error}</p>}
          {!share && !error && <Loader2 className="mx-auto animate-spin text-ink-500" size={18} />}

          <section className="space-y-2">
            <h3 className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">Invite link</h3>
            <div className="flex flex-wrap items-center gap-2">
              <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="select-chevron cursor-pointer rounded-md border border-[var(--line)] bg-ink-900 py-1.5 pl-2.5">
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
              <select value={String(days)} onChange={(e) => setDays(e.target.value === "null" ? null : (Number(e.target.value) as 1 | 7 | 30))} className="select-chevron cursor-pointer rounded-md border border-[var(--line)] bg-ink-900 py-1.5 pl-2.5" aria-label="Expires after">
                {EXPIRY.map((x) => (
                  <option key={x.label} value={String(x.value)}>
                    {x.label}
                  </option>
                ))}
              </select>
              <label className="flex cursor-pointer items-center gap-1.5 text-ink-300">
                <input type="checkbox" checked={once} onChange={(e) => setOnce(e.target.checked)} /> One use
              </label>
              <button onClick={() => void create()} disabled={busy || !share} className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-lg bg-spark-500 px-2.5 py-1.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40">
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />} Create link
              </button>
            </div>
            {role === "edit" && <p className="text-amber-300/90">Editors run the agent and the app&apos;s code on this Mac with your API key. Invite people you trust.</p>}
            {link && (
              <div className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-ink-900 p-1.5">
                <input readOnly value={link} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 bg-transparent px-1 font-mono text-[11px] text-ink-200 outline-none" />
                <button onClick={() => void copy()} className="flex cursor-pointer items-center gap-1 rounded-md bg-ink-800 px-2 py-1 hover:bg-ink-700">
                  {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
                </button>
              </div>
            )}
            {link && <p className="text-ink-500">This link is shown only once.</p>}
          </section>

          {invites.length > 0 && (
            <section className="space-y-1.5">
              <h3 className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">Links</h3>
              {invites.map((i) => (
                <div key={i.id} className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-ink-800/50">
                  <span className="text-ink-200">{ROLE_LABEL[i.role]}</span>
                  <span className="text-ink-500">
                    · {until(i.expiresAt)} · {i.uses}
                    {i.maxUses ? `/${i.maxUses}` : ""} {i.uses === 1 ? "use" : "uses"}
                  </span>
                  <button onClick={() => void call(`/api/projects/${projectId}/share/invites/${i.id}`, { method: "DELETE" })} className="ml-auto cursor-pointer rounded-md px-2 py-0.5 text-ink-400 hover:bg-ink-800 hover:text-red-300">
                    Revoke
                  </button>
                </div>
              ))}
            </section>
          )}

          <section className="space-y-1.5">
            <h3 className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">People</h3>
            <div className="flex items-center gap-2 px-1 py-1">
              <Avatar person={owner} seed="owner" size={24} />
              <span className="truncate text-ink-100">{share?.owner?.name ?? "You"}</span>
              <span className="ml-auto text-ink-500">You · Owner</span>
            </div>
            {members.map((m) => (
              <div key={m.uid} className="flex items-center gap-2 px-1 py-1">
                <Avatar person={m} seed={m.uid} size={24} />
                <div className="min-w-0 flex-1">
                  <input
                    defaultValue={m.name}
                    maxLength={60}
                    aria-label="Name"
                    onBlur={(e) => {
                      const name = e.target.value.trim();
                      if (name && name !== m.name) void call(`/api/projects/${projectId}/share/members/${m.uid}`, { method: "PATCH", body: JSON.stringify({ name }) });
                    }}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                    className="w-full truncate rounded bg-transparent text-ink-100 outline-none focus:bg-ink-900"
                  />
                  {m.email && <p className="truncate text-[11px] text-ink-500">{m.email}</p>}
                </div>
                <select
                  value={m.role}
                  onChange={(e) => void call(`/api/projects/${projectId}/share/members/${m.uid}`, { method: "PATCH", body: JSON.stringify({ role: e.target.value }) })}
                  className="select-chevron cursor-pointer rounded-md border border-[var(--line)] bg-ink-900 py-1 pl-2"
                  aria-label={`${m.name}'s role`}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
                <button onClick={() => void call(`/api/projects/${projectId}/share/members/${m.uid}`, { method: "DELETE" })} title="Remove" aria-label={`Remove ${m.name}`} className="grid size-7 cursor-pointer place-items-center rounded-md text-ink-400 hover:bg-ink-800 hover:text-red-300">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </section>
        </div>
        <p className={clsx("border-t border-[var(--line)] px-4 py-2.5 text-[11.5px] text-ink-500")}>
          Friends reach this app through your computer while sparkflow runs.{share && !share.online ? " It is offline right now." : ""}
        </p>
      </div>
    </div>
  );
}

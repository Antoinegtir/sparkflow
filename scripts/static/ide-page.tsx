"use client";

// Copied to app/ide-shell/page.tsx by `npm run build:static` only. Firebase Hosting serves it for
// every app URL (/<app>/<page>, /p/<id>): it finds the project on your computer and opens the IDE,
// or walks you through starting `sparkflow` first.
import { useCallback, useEffect, useState } from "react";
import { ConnectOnboarding } from "@/app/components/ConnectOnboarding";
import { IDE } from "@/app/components/ide/IDE";
import { SharedShell } from "@/app/components/SharedShell";
import type { ProjectSummary } from "@/lib/shared";
import { backendReady, getBackend, setMode } from "@/lib/web/backend";
import { ensureCloud } from "@/lib/web/cloud";

type Found = { id: string; slug: string; page: string[] };
type State = { kind: "shared"; serverUid: string; projectId: string; page: string[] } | { kind: "loading" } | { kind: "offline" } | { kind: "missing" } | { kind: "demo" } | { kind: "found"; found: Found };

let demoAsked = false;

export default function IdeShell() {
  const [state, setState] = useState<State>({ kind: "loading" });

  const open = useCallback(async () => {
    const parts = location.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    // Someone else's project: it never needs your own computer connected.
    if (parts[0] === "s" && parts[1] && parts[2]) return setState({ kind: "shared", serverUid: parts[1], projectId: parts[2], page: parts.slice(3) });
    // Nothing linked: the cloud, always (signing in if needed). The Mac onboarding is only /connect,
    // reached from "Run on a real simulator"; a Mac chosen there but not running falls back to the cloud.
    if (!getBackend() && parts[0] !== "connect") {
      setMode("cloud");
      await ensureCloud(true);
    }
    if (!getBackend()) return setState({ kind: "offline" });
    // /connect: where the landing sends you when no computer answers; once connected, back to it.
    if (parts[0] === "connect") {
      fetch("/api/projects", { cache: "no-store" })
        .then((r) => (r.ok ? location.replace("/") : setState({ kind: "offline" })))
        .catch(() => setState({ kind: "offline" }));
      return;
    }
    const [key, ...page] = parts[0] === "p" ? parts.slice(1) : parts;
    fetch("/api/projects", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<ProjectSummary[]>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((list) => {
        // The demo is /wander for everyone, whatever its own name in the cloud (wander-2…).
        const p = list.find((x) => x.slug === key) ?? list.find((x) => x.id === key) ?? (key === "wander" ? list.find((x) => x.prompt?.endsWith("(Sparkflow demo app)")) : undefined);
        if (p) return setState({ kind: "found", found: { id: p.id, slug: p.slug, page } });
        // The Wander demo, gone from this computer (apps folder emptied, demo deleted): set it up again.
        if (key === "wander" && !demoAsked) {
          demoAsked = true;
          setState({ kind: "demo" });
          return fetch("/api/demo", { method: "POST" }).then((r) => (r.ok ? void open() : setState({ kind: "missing" })), () => setState({ kind: "missing" }));
        }
        setState({ kind: "missing" });
      })
      .catch(() => setState({ kind: "offline" }));
  }, []);

  // Once we know whether `sparkflow` runs on this computer (then reached directly).
  useEffect(() => void backendReady.then(() => open()), [open]);

  if (state.kind === "shared") return <SharedShell serverUid={state.serverUid} projectId={state.projectId} page={state.page} />;
  if (state.kind === "found") return <IDE id={state.found.id} slug={state.found.slug} initialPage={state.found.page} />;
  if (state.kind === "offline") return <ConnectOnboarding />;
  return (
    <div data-ide className="grid h-screen place-items-center text-center text-sm text-ink-400">
      {state.kind === "missing" ? (
        <div className="space-y-3">
          <p>This app isn&apos;t on the connected computer.</p>
          <a href="/" className="text-spark-400 hover:underline">
            Back to Sparkflow
          </a>
        </div>
      ) : state.kind === "demo" ? (
        "Setting up the Wander demo…"
      ) : (
        "Connecting…"
      )}
    </div>
  );
}

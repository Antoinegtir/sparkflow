"use client";

// Copied to app/ide-shell/page.tsx by `npm run build:static` only. Firebase Hosting serves it for
// every app URL (/<app>/<page>, /p/<id>): it finds the project on your computer and opens the IDE,
// or walks you through starting `sparkflow` first.
import { useCallback, useEffect, useState } from "react";
import { ConnectOnboarding } from "@/app/components/ConnectOnboarding";
import { IDE } from "@/app/components/ide/IDE";
import type { ProjectSummary } from "@/lib/shared";
import { getBackend } from "@/lib/web/backend";

type Found = { id: string; slug: string; page: string[] };
type State = { kind: "loading" } | { kind: "offline" } | { kind: "missing" } | { kind: "found"; found: Found };

export default function IdeShell() {
  const [state, setState] = useState<State>({ kind: "loading" });

  const open = useCallback(() => {
    if (!getBackend()) return setState({ kind: "offline" });
    const parts = location.pathname.split("/").filter(Boolean).map(decodeURIComponent);
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
        const p = list.find((x) => x.slug === key) ?? list.find((x) => x.id === key);
        setState(p ? { kind: "found", found: { id: p.id, slug: p.slug, page } } : { kind: "missing" });
      })
      .catch(() => setState({ kind: "offline" }));
  }, []);

  useEffect(open, [open]);

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
      ) : (
        "Connecting to your computer…"
      )}
    </div>
  );
}

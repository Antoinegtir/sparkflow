"use client";

// Copied to app/ide-shell/page.tsx by `npm run build:static` only. Firebase Hosting serves it for
// every app URL (/<app>/<page>, /p/<id>): it finds the project on your computer and opens the IDE.
import { useEffect, useState } from "react";
import { IDE } from "@/app/components/ide/IDE";
import type { ProjectSummary } from "@/lib/shared";
import { getBackend } from "@/lib/web/backend";

type Found = { id: string; slug: string; page: string[] };

export default function IdeShell() {
  const [found, setFound] = useState<Found | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getBackend()) return setError("Run `npm run remote` on your computer and open the link it prints.");
    const parts = location.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const [key, ...page] = parts[0] === "p" ? parts.slice(1) : parts;
    fetch("/api/projects", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<ProjectSummary[]>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((list) => {
        const p = list.find((x) => x.slug === key) ?? list.find((x) => x.id === key);
        if (!p) return setError("This app isn't on the connected computer.");
        setFound({ id: p.id, slug: p.slug, page });
      })
      .catch(() => setError("Can't reach your computer. Is `npm run remote` still running?"));
  }, []);

  if (found) return <IDE id={found.id} slug={found.slug} initialPage={found.page} />;
  return (
    <div data-ide className="grid h-screen place-items-center text-center text-sm text-ink-400">
      {error ? (
        <div className="space-y-3">
          <p>{error}</p>
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

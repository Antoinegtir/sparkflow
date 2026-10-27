"use client";

import { useEffect, useState } from "react";
import { apiFetch, BACKEND_EVENT } from "@/lib/web/backend";

/** Shown only when the connected server really runs the scripted agent (no Muse Spark key there). */
export function DemoNotice() {
  const [mock, setMock] = useState(false);
  useEffect(() => {
    const load = () =>
      void apiFetch("/api/info")
        .then((r) => (r.ok ? r.json() : null))
        .then((info: { llm?: string } | null) => setMock(info?.llm === "mock"))
        .catch(() => setMock(false));
    load();
    addEventListener(BACKEND_EVENT, load);
    return () => removeEventListener(BACKEND_EVENT, load);
  }, []);
  if (!mock) return null;
  return (
    <p className="relative mx-auto mb-12 max-w-lg px-6 text-center text-xs text-warn/90">
      Demo mode: no Muse Spark API key on your computer, so a scripted agent builds a sample habit tracker. Add one with <code className="font-mono">sparkflow key</code>.
    </p>
  );
}

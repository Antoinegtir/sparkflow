"use client";

import { useEffect, useState } from "react";
import type { DevClientStatus } from "./dev-client";

/** Polls the Sparkflow Dev build while `active`: the first build takes about 6 minutes on iOS, 15 on Android. */
export function useDevClientStatus(active: boolean) {
  const [status, setStatus] = useState<DevClientStatus | null>(null);
  useEffect(() => {
    if (!active) return;
    let stop = false;
    const poll = async () => {
      const s = await fetch("/api/sim/dev-client").then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (!stop) setStatus(s);
      if (!stop) setTimeout(poll, 1000);
    };
    void poll();
    return () => {
      stop = true;
    };
  }, [active]);
  return active ? status : null;
}

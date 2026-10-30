/** A sliding one-minute window per key, with old keys pruned so memory stays bounded. */
export function rateLimiter(max: number, windowMs = 60_000) {
  const hits = new Map<string, number[]>();
  let lastSweep = 0;
  return (key: string) => {
    const now = Date.now();
    if (now - lastSweep > windowMs) {
      lastSweep = now;
      for (const [k, ts] of hits) if (!ts.length || now - ts[ts.length - 1] >= windowMs) hits.delete(k);
    }
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(key, recent);
    return recent.length > max;
  };
}

/** The tunnel's client IP (Cloudflare overwrites any client copy); requests without it come from this machine. */
export const clientKey = (req: Request) => `ip:${req.headers.get("cf-connecting-ip") ?? "local"}`;

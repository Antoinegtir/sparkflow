"use client";

import clsx from "clsx";
import { useState } from "react";
import type { Person } from "@/lib/shared/share";

// Only GitHub's avatar host is trusted: any other src (set by a server or a guest) could track viewers.
const AVATAR_HOST = "https://avatars.githubusercontent.com/";

const initials = (name: string) =>
  name
    .split(/[\s._@-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

/** A stable hue from the seed (uid or "owner"), so a person keeps their color everywhere. */
function hue(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

/** A person's picture: their GitHub avatar, else initials on a color hashed from `seed`. */
export function Avatar({ person, seed, size = 20, ring, className, title }: { person?: Person; seed: string; size?: number; ring?: boolean; className?: string; title?: string }) {
  const [broken, setBroken] = useState(false);
  const src = person?.avatar && person.avatar.startsWith(AVATAR_HOST) && !broken ? person.avatar : null;
  const name = person?.name ?? "?";
  const style = { width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.42)) };
  const cls = clsx("inline-grid shrink-0 place-items-center overflow-hidden rounded-full select-none", ring && "ring-2 ring-spark-500", className);
  if (src)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} title={title ?? name} referrerPolicy="no-referrer" onError={() => setBroken(true)} className={cls} style={style} draggable={false} />;
  return (
    <span title={title ?? name} className={clsx(cls, "font-semibold text-white")} style={{ ...style, background: `hsl(${hue(seed)} 55% 42%)` }}>
      {initials(name)}
    </span>
  );
}

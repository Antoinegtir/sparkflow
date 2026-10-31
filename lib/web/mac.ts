"use client";

import { LOCAL_URL } from "./backend";

/**
 * sparkflow on this Mac, used from the cloud: the app's code stays in the cloud (its Metro there), the
 * Mac only shows it in a Simulator or emulator, through Sparkflow Dev loading the cloud's Metro.
 */
export const MAC_EVENT = "sparkflow-mac";
type Link = { token: string };
let link: Link | null = null;

/** True once sparkflow answers on this computer (its token kept for the calls below). */
export async function findMac(): Promise<boolean> {
  const r = await fetch(`${LOCAL_URL}/api/connect`, { cache: "no-store" })
    .then((x) => (x.ok ? (x.json() as Promise<{ token: string }>) : null))
    .catch(() => null);
  const was = !!link;
  link = r?.token ? { token: r.token } : null;
  if (was !== !!link) dispatchEvent(new Event(MAC_EVENT));
  return !!link;
}

export const macFound = () => !!link;

/** A call to sparkflow on this Mac, straight at localhost. */
export function macFetch(path: string, init: RequestInit = {}) {
  if (!link) return Promise.reject(new Error("sparkflow isn't running on this Mac"));
  const headers = new Headers(init.headers);
  headers.set("x-sparkflow-token", link.token);
  return fetch(LOCAL_URL + path, { ...init, headers });
}

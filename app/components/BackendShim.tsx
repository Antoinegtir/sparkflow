"use client";

import { backendUrl, getBackend, STATIC_SITE } from "@/lib/web/backend";
import { activeShare, activeShareBackend, guestSrc } from "@/lib/web/share";
import { macBackend } from "@/lib/web/mac";

/**
 * Routes the IDE's server calls (`/api/...` in fetch, EventSource, img/iframe/link URLs) to the
 * right computer. On a shared project (/s/...) that is always the owner's server, with the guest
 * key in a header and a ticket in URLs, never this site or your own computer. Elsewhere on the
 * static site (Firebase Hosting) it is the server on your computer. Installed when this module
 * loads, before any component runs.
 */
function install() {
  if (typeof window === "undefined") return;
  const isApi = (u: unknown): u is string => typeof u === "string" && u.startsWith("/api/");
  // In the cloud, the simulator and emulator calls go to sparkflow on this Mac once it's found.
  const isSim = (u: string) => /^\/api\/sim(\/|\?|$)/.test(u);
  const simMac = (u: string) => (STATIC_SITE && isSim(u) && getBackend()?.cloud ? macBackend() : null);
  const rewrite = (value: string) => {
    if (!isApi(value)) return value;
    if (activeShare()) return guestSrc(value);
    const mac = simMac(value);
    if (mac) return `${mac.url}${value}${value.includes("?") ? "&" : "?"}token=${encodeURIComponent(mac.token)}`;
    return STATIC_SITE ? backendUrl(value) : value;
  };

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (!isApi(input)) return nativeFetch(input, init);
    if (activeShare()) {
      const b = activeShareBackend();
      // No fallback: a guest call must not reach this site or the visitor's own server.
      if (!b) return Promise.reject(new Error("The owner's computer is offline."));
      const headers = new Headers(init?.headers);
      headers.set("x-sparkflow-token", b.token);
      return nativeFetch(b.url + input, { ...init, headers, credentials: "omit" });
    }
    const b = simMac(input) ?? (STATIC_SITE ? getBackend() : null);
    if (!b) return nativeFetch(input, init);
    const headers = new Headers(init?.headers);
    headers.set("x-sparkflow-token", b.token);
    return nativeFetch(b.url + input, { ...init, headers });
  };

  // EventSource can't send headers: the owner's token rides in the query. Guests poll instead.
  const NativeES = window.EventSource;
  window.EventSource = class extends NativeES {
    constructor(url: string | URL, init?: EventSourceInit) {
      if (isApi(url) && activeShare()) throw new Error("Shared projects poll for updates.");
      super(isApi(url) && STATIC_SITE ? backendUrl(url) : url, init);
    }
  } as typeof EventSource;

  // src/href, whether set as attributes or as properties: images, previews, downloads.
  const setAttr = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name: string, value: string) {
    return setAttr.call(this, name, name === "src" || name === "href" ? rewrite(value) : value);
  };
  for (const [Ctor, prop] of [
    [HTMLImageElement, "src"],
    [HTMLIFrameElement, "src"],
    [HTMLVideoElement, "src"],
    [HTMLSourceElement, "src"],
    [HTMLAnchorElement, "href"],
  ] as const) {
    const desc = Object.getOwnPropertyDescriptor(Ctor.prototype, prop);
    if (!desc?.set) continue;
    Object.defineProperty(Ctor.prototype, prop, {
      ...desc,
      set(value: string) {
        desc.set!.call(this, rewrite(value));
      },
    });
  }
}

install();

export function BackendShim() {
  return null;
}

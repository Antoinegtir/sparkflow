"use client";

import { backendUrl, getBackend, STATIC_SITE } from "@/lib/web/backend";

/**
 * On the static site (Firebase Hosting) the IDE's server calls (`/api/...` in fetch, EventSource,
 * img/iframe/link URLs) go to the server on your computer instead of the site's own origin, so the
 * address bar stays on the hosted site. Installed when this module loads, before any component runs.
 */
function install() {
  if (typeof window === "undefined" || !STATIC_SITE) return;
  const isApi = (u: unknown): u is string => typeof u === "string" && u.startsWith("/api/");

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const b = getBackend();
    if (!b || !isApi(input)) return nativeFetch(input, init);
    const headers = new Headers(init?.headers);
    headers.set("x-sparkflow-token", b.token);
    return nativeFetch(b.url + input, { ...init, headers });
  };

  // EventSource can't send headers: the token rides in the query.
  const NativeES = window.EventSource;
  window.EventSource = class extends NativeES {
    constructor(url: string | URL, init?: EventSourceInit) {
      super(isApi(url) ? backendUrl(url) : url, init);
    }
  } as typeof EventSource;

  // src/href, whether set as attributes or as properties: images, previews, downloads.
  const setAttr = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name: string, value: string) {
    return setAttr.call(this, name, (name === "src" || name === "href") && isApi(value) ? backendUrl(value) : value);
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
        desc.set!.call(this, isApi(value) ? backendUrl(value) : value);
      },
    });
  }
}

install();

export function BackendShim() {
  return null;
}

"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(pointer: coarse) and (max-width: 1023px)";
const subscribe = (cb: () => void) => {
  const m = matchMedia(QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

/** A phone or small tablet: Sparkflow builds and runs apps on a Mac or Linux computer, not there. */
export function useIsPhone() {
  return useSyncExternalStore(subscribe, () => matchMedia(QUERY).matches, () => false);
}

/** A screen wide enough for the pinned, scroll-driven phone of How it works. */
export function useIsWide() {
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia("(min-width: 1024px)");
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => matchMedia("(min-width: 1024px)").matches,
    () => true,
  );
}

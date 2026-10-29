"use client";

import { useEffect } from "react";
import { patchPresence } from "@/lib/web/presence";

/** Tells the terminal which part of the landing is on screen: the hero, How it works or My apps. */
export function LandingPresence() {
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const h = innerHeight;
      const apps = document.getElementById("apps")?.getBoundingClientRect().top ?? Infinity;
      const how = document.getElementById("how")?.getBoundingClientRect().top ?? Infinity;
      patchPresence({ view: "home", section: apps < h * 0.6 ? "apps" : how < h * 0.85 ? "how" : "hero" });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    // Nothing left over from an app opened before (the prompt box reports on its own).
    patchPresence({ projectId: undefined, page: undefined, mode: undefined, device: undefined });
    update();
    addEventListener("scroll", onScroll, { passive: true });
    return () => {
      removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}

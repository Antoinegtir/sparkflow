"use client";

import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

/** A bouncing arrow at the bottom of the landing's first screen, inviting to scroll; gone once scrolled. */
export function ScrollHint() {
  const [top, setTop] = useState(true);
  // Where the prompt suggestions end (page px), when they reach the bottom of the screen: the arrow then
  // goes under them instead of over them.
  const [under, setUnder] = useState<number | null>(null);
  useEffect(() => {
    const on = () => setTop(scrollY < 40);
    const fit = () => {
      const list = document.querySelector("[data-suggestions]");
      const end = list ? list.getBoundingClientRect().bottom + scrollY : 0;
      setUnder(end + 8 + 40 > innerHeight - 8 ? end + 8 : null);
    };
    on();
    fit();
    addEventListener("scroll", on, { passive: true });
    addEventListener("resize", fit);
    // Fonts arriving, the window's height (the hero scales with it): any change of layout moves the list.
    addEventListener("load", fit);
    const ro = new ResizeObserver(fit);
    ro.observe(document.documentElement);
    const list = document.querySelector("[data-suggestions]");
    if (list) ro.observe(list);
    return () => {
      ro.disconnect();
      removeEventListener("load", fit);
      removeEventListener("scroll", on);
      removeEventListener("resize", fit);
    };
  }, []);
  return (
    <button
      type="button"
      aria-label="Scroll to How it works"
      onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth", block: "start" })}
      style={under !== null ? { top: under } : undefined}
      className={clsx(
        under !== null ? "absolute" : "fixed bottom-2",
        "left-1/2 z-30 grid size-10 -translate-x-1/2 cursor-pointer place-items-center text-white transition-opacity duration-500 hover:opacity-80",
        top ? "opacity-100" : "pointer-events-none opacity-0",
      )}>
      <ChevronDown size={30} strokeWidth={3} className="animate-bounce motion-reduce:animate-none" />
    </button>
  );
}

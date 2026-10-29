"use client";

import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

/** A bouncing arrow at the bottom of the landing's first screen, inviting to scroll; gone once scrolled. */
export function ScrollHint() {
  const [top, setTop] = useState(true);
  useEffect(() => {
    const on = () => setTop(scrollY < 40);
    on();
    addEventListener("scroll", on, { passive: true });
    return () => removeEventListener("scroll", on);
  }, []);
  return (
    <button
      type="button"
      aria-label="Scroll to How it works"
      onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth", block: "start" })}
      className={clsx(
        "fixed bottom-6 left-1/2 z-30 grid size-10 -translate-x-1/2 cursor-pointer place-items-center rounded-full border border-white/10 bg-ink-950/60 text-ink-300 backdrop-blur transition-opacity duration-500 hover:text-ink-100",
        top ? "opacity-100" : "pointer-events-none opacity-0",
      )}>
      <ChevronDown size={18} className="animate-bounce motion-reduce:animate-none" />
    </button>
  );
}

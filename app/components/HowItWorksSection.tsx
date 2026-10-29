"use client";

import { useIsWide } from "@/lib/web/phone";
import { HowItWorks } from "./HowItWorks";
import { ScrollVideo } from "./ScrollVideo";

/**
 * How it works: beside the pinned, scroll-driven glass phone on wide screens; on a phone, straight
 * under the prompt (the phone animation would only leave a tall empty gap there).
 */
export function HowItWorksSection() {
  const wide = useIsWide();
  if (!wide)
    return (
      <section className="px-6 pt-14 pb-10">
        <HowItWorks />
      </section>
    );
  return (
    <ScrollVideo src="/videos/phone.mp4">
      <HowItWorks />
    </ScrollVideo>
  );
}

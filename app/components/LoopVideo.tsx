"use client";

import { useEffect, useRef } from "react";

/**
 * A muted decorative loop. Safari can refuse autoplay (Low Power Mode, power saving): then it starts
 * on the first tap, key or scroll instead of showing a play button.
 */
export function LoopVideo({ src, className }: { src: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    const retry = () => {
      void v.play().then(stop, () => {});
    };
    const stop = () => events.forEach((e) => window.removeEventListener(e, retry));
    void v.play().catch(() => events.forEach((e) => window.addEventListener(e, retry, { passive: true })));
    return stop;
  }, []);
  return <video ref={ref} className={className} src={src} autoPlay muted loop playsInline preload="auto" disablePictureInPicture />;
}

"use client";

import { useEffect, useRef } from "react";

// Vidéo WebM dont la lecture suit le scroll : la section fait `height` de haut,
// la vidéo reste collée à l'écran et currentTime suit la progression.
export function ScrollVideo({ src, height = "300vh", className }: { src: string; height?: string; className?: string }) {
  const section = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = section.current!;
    const v = video.current!;
    let target = 0;
    let current = 0;
    let raf = 0;

    const onScroll = () => {
      const r = el.getBoundingClientRect();
      const range = r.height - window.innerHeight;
      target = Math.min(1, Math.max(0, -r.top / range));
    };

    // Lissage pour éviter les à-coups quand le scroll saute
    const tick = () => {
      current += (target - current) * 0.15;
      if (v.duration && Math.abs(v.currentTime - current * v.duration) > 0.01) {
        v.currentTime = current * v.duration;
      }
      raf = requestAnimationFrame(tick);
    };

    onScroll();
    tick();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div ref={section} style={{ height }} className="relative">
      <div className="sticky top-0 flex h-screen items-center justify-center">
        <video ref={video} src={src} muted playsInline preload="auto" className={className} />
      </div>
    </div>
  );
}

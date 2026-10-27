"use client";

import { useEffect, useRef } from "react";

/** Video box size: square clip, as large as fits comfortably. */
const SIZE = "min(70vh, 640px)";
/** Vertical squash of the edge-on phone at the top of the page (thinner white edge); width is never changed. */
const MIN_SCALE = 0.03;
/** How fast it un-squashes: back to full height after 1/GROW_SPEED of the way to the middle. */
const GROW_SPEED = 6;
/** Width of the upright phone inside the square clip (measured on the last frame). */
const PHONE_RATIO = 0.294;
/** Width of the content beside the phone, and the gap between them. */
const SIDE_W = 520;
const GAP = 20;
/** Nudge of the whole phone + content group to the right, in px (optical centering). */
const NUDGE = 20;
/** How much lower than the top of the phone the content first appears (vh), clear of the hero above. */
const SIDE_DROP_VH = 23;

/**
 * Once upright, the phone and the content that follows sit side by side, GAP px apart,
 * centered together. The phone moves by half of (content + gap) whatever its own size.
 * Below lg the content takes the full width under it and the phone stays centered.
 */
function shiftFor(width: number) {
  return width < 1024 ? 0 : (SIDE_W + GAP) / 2 - NUDGE;
}

/**
 * Apple-style scroll scrubbing: the clip doesn't play by itself, each scroll position
 * shows one frame. The clip's first frame (the phone seen edge-on, a thin bar at the
 * clip's middle) sits right under the content above, squashed vertically so its white
 * edge reads as a thin separator. While it rises to the middle of the screen it un-squashes
 * back to its real proportions; there it is pinned and the clip plays frame by frame as
 * the phone stands up, then scrolls away. The WebM is all keyframes, so seeking
 * to any frame is instant.
 */
/** Scroll distance (in viewport heights) for the phone to stand up once pinned, then to slide left. */
const ROTATE_VH = 0.04;
const SLIDE_VH = 0.1;

export function ScrollVideo({ src, className, children }: { src: string; className?: string; children?: React.ReactNode }) {
  const section = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const after = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const v = video.current;
    const el = section.current;
    if (!v || !el) return;
    let target = 0; // video progress 0..1
    let shown = 0;
    let grow = 0; // 0..1 while the flat phone rises to the middle of the screen
    let grown = 0;
    let slide = 0; // 0..1 once the phone is upright, while it is still pinned
    let slid = 0;
    let shift = shiftFor(innerWidth);
    let raf = 0;
    // Scroll assist: the transition (phone standing up, then sliding left) has nothing to read,
    // so when the user stops inside it we glide to the next resting point in their direction.
    let zone: [number, number] = [0, 0];
    let lastY = scrollY;
    let dir = 1;
    let idle: ReturnType<typeof setTimeout> | undefined;
    let gliding = false;
    let glideRaf = 0;
    // Scroll speed (px/ms), smoothed over the last events, so the glide can pick it up as-is.
    let speed = 0;
    let lastT = performance.now();
    /**
     * Glide that carries on the user's own momentum: it starts at their current speed (no pause,
     * no ease-in) and decelerates evenly to a soft stop on the resting point (cubic Hermite curve).
     */
    const glide = (to: number) => {
      const from = scrollY;
      const dist = to - from;
      // Only keep the speed if it goes the right way; a minimum keeps very slow stops from dragging.
      const v0 = Math.sign(dist) * Math.max(0.6, speed * Math.sign(dist));
      // Constant deceleration from v0 to 0 covers dist in 2 * dist / v0.
      const duration = Math.min(1200, Math.max(280, (2 * dist) / v0));
      const t0 = performance.now();
      gliding = true;
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / duration);
        const t2 = t * t;
        const t3 = t2 * t;
        // Starts at speed v0, lands on `to` with zero speed.
        const y = from * (2 * t3 - 3 * t2 + 1) + v0 * duration * (t3 - 2 * t2 + t) + to * (3 * t2 - 2 * t3);
        scrollTo(0, y);
        if (t < 1 && gliding) glideRaf = requestAnimationFrame(step);
        else gliding = false;
      };
      glideRaf = requestAnimationFrame(step);
    };
    // Any user input during the glide hands control straight back.
    const interrupt = () => {
      if (!gliding) return;
      gliding = false;
      cancelAnimationFrame(glideRaf);
    };
    const settle = () => {
      const y = scrollY;
      if (gliding || y <= zone[0] || y >= zone[1]) return;
      // Down: just past the slide, with the timeline in place. Up: back to the top, the phone a thin divider.
      glide(dir > 0 ? zone[1] + innerHeight * 0.06 : zone[0]);
    };
    const measure = () => {
      // The phone stays flat (a separator line) until the video is pinned in the middle of
      // the screen, stands up while pinned, and is fully upright when it starts to scroll away.
      shift = shiftFor(innerWidth);
      const top = el.getBoundingClientRect().top + scrollY;
      const stick = innerHeight / 2 - v.offsetHeight / 2;
      const start = top - stick;
      // Before that point the flat phone only un-squashes; the clip starts once it is back to scale.
      grow = start > 0 ? Math.min(1, Math.max(0, (scrollY * GROW_SPEED) / start)) : 1;
      // The phone starts turning as soon as it is back to full height, and is upright a
      // little after it gets pinned (earlier and quicker than spreading it over the pin).
      const from = Math.max(0, start / GROW_SPEED);
      const to = start + innerHeight * ROTATE_VH;
      target = to > from ? Math.min(1, Math.max(0, (scrollY - from) / (to - from))) : 0;
      // Once upright, it slides left; whatever follows (children) then scrolls in beside it.
      slide = Math.min(1, Math.max(0, (scrollY - to) / (innerHeight * SLIDE_VH)));
      // The whole animation: the flat divider un-squashing from the top of the page, the clip
      // (frame 0 to the last one) and the slide that follows it.
      zone = [0, to + innerHeight * SLIDE_VH];
    };
    const onScroll = () => {
      measure();
      const now = performance.now();
      if (scrollY !== lastY) dir = scrollY > lastY ? 1 : -1;
      if (!gliding) speed = speed * 0.4 + ((scrollY - lastY) / Math.max(1, now - lastT)) * 0.6;
      lastY = scrollY;
      lastT = now;
      clearTimeout(idle);
      // Take over as soon as the scroll stops (a couple of frames without events).
      if (!gliding) idle = setTimeout(settle, 45);
    };
    const tick = () => {
      raf = requestAnimationFrame(tick);
      // Ease toward the scroll position so fast flicks stay smooth.
      shown += (target - shown) * 0.1;
      // No easing on the squash: it follows the scroll exactly, so the divider never lags into a thick bar.
      grown = grow;
      slid += (slide - slid) * 0.1;
      // While squashed into the divider, always show frame 0 (the phone seen edge-on): a lagging,
      // half-turned frame squashed flat is what made the line change width and shake on the way up.
      if (grow < 1 || grown < 0.98) shown = Math.min(shown, target);
      if (grown < 0.98) shown = 0;
      // After it stands up, the phone slides into the middle of the left column.
      if (after.current) {
        // The content only shows up once the phone has almost reached its spot, so the two
        // never cross: it fades in and eases from the right and slightly below.
        const k = Math.min(1, Math.max(0, (slid - 0.7) / 0.3));
        const e = 1 - (1 - k) ** 3;
        after.current.style.opacity = String(e);
        after.current.style.transform = `translate(${(1 - e) * 40}px, ${(1 - e) * 24}px)`;
      }
      v.style.transform = `translateX(${-shift * slid}px) scaleY(${MIN_SCALE + (1 - MIN_SCALE) * grown})`;
      // Skip while the previous seek is still decoding: queuing seeks is what makes it stutter.
      if (v.duration && !v.seeking && Math.abs(v.currentTime - shown * v.duration) > 0.01) {
        v.currentTime = Math.min(v.duration - 0.04, shown * v.duration);
      }
    };
    measure();
    raf = requestAnimationFrame(tick);
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("wheel", interrupt, { passive: true });
    addEventListener("touchstart", interrupt, { passive: true });
    addEventListener("keydown", interrupt);
    addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("scroll", onScroll);
      clearTimeout(idle);
      cancelAnimationFrame(glideRaf);
      removeEventListener("wheel", interrupt);
      removeEventListener("touchstart", interrupt);
      removeEventListener("keydown", interrupt);
      removeEventListener("resize", measure);
    };
  }, []);
  return (
    // Pulled up by half the clip so its middle line (the edge-on phone) lands just below what's above.
    // The phone stays pinned for as long as the section lasts: children (on the right) scroll past it.
    <div ref={section} className="pointer-events-none relative" style={{ minHeight: `calc(${SIZE} + 70vh)`, marginTop: `calc(${SIZE} / -2 - 8px)` }}>
      {/* Sticky makes its own stacking context: blend it as a whole so the clip's black drops out. */}
      <div className="pointer-events-none sticky flex justify-center mix-blend-screen" style={{ top: `calc(50vh - ${SIZE} / 2)` }}>
        <video
          ref={video}
          src={src}
          muted
          playsInline
          preload="auto"
          className={className}
          style={{ width: SIZE, height: SIZE, transform: `scaleY(${MIN_SCALE})`, willChange: "transform" }}
        />
      </div>
      {children && (
        // Hidden until the phone has slid left (fades in with it, so they never overlap); its top
        // then sits level with the top of the pinned phone.
        <div
          ref={after}
          className="scroll-video-side pointer-events-auto relative px-6 pb-[20vh] opacity-0 lg:px-0"
          style={
            {
              marginTop: `calc(${(ROTATE_VH + SLIDE_VH) * 100 + SIDE_DROP_VH}vh - ${SIZE})`,
              "--side-w": `${SIDE_W}px`,
              "--phone-w": `calc(${SIZE} * ${PHONE_RATIO})`,
              "--gap": `${GAP}px`,
              "--nudge": `${NUDGE}px`,
            } as React.CSSProperties
          }>
          {children}
        </div>
      )}
    </div>
  );
}

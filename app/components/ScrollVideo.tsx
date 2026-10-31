"use client";

import { useEffect, useRef } from "react";
import { preload } from "react-dom";
import { PhoneSteps } from "./PhoneSteps";

/** How much bigger than its first size the phone is drawn (its screen's content grows with it). */
const PHONE_SCALE = 1.5;
/** Video box size: square clip, as large as fits comfortably. */
const SIZE = `min(${70 * PHONE_SCALE}vh, ${640 * PHONE_SCALE}px)`;
/** What the box grew by over its first size: the section makes room for it above and below. */
const GROWTH = `(${SIZE} - min(70vh, 640px))`;
/** Vertical squash of the edge-on phone at the top of the page (thinner white edge); width is never changed. */
const MIN_SCALE = 0.03;
/** How fast it un-squashes: back to full height after 1/GROW_SPEED of the way to the middle. */
const GROW_SPEED = 6;
/** Width of the upright phone inside the square clip (measured on the last frame). */
const PHONE_RATIO = 0.294;
/** The phone's screen inside it: share of the phone's width, and of the clip's height. */
const SCREEN_W = 0.93;
const SCREEN_H = 0.6;
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
  // Fetched from the HTML's head (a preload link in the static page), so the download starts before
  // hydration; the effect's fetch() then reuses it (same CORS mode, so it isn't downloaded twice).
  preload(src, { as: "fetch", crossOrigin: "anonymous" });
  const section = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const after = useRef<HTMLDivElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const glass = useRef<HTMLDivElement>(null);
  const island = useRef<HTMLDivElement>(null);
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
      const v0 = Math.sign(dist) * Math.max(1.6, speed * Math.sign(dist));
      // Constant deceleration from v0 to 0 covers dist in 2 * dist / v0.
      const duration = Math.min(650, Math.max(240, (2 * dist) / v0));
      // The momentum's share of the curve, capped so a short glide never overshoots the stop and comes back.
      const m = Math.sign(dist) * Math.min(Math.abs(v0 * duration), Math.abs(dist) * 2);
      const t0 = performance.now();
      gliding = true;
      glideDir = Math.sign(dist);
      // The landing's CSS smooth scrolling would turn each frame's jump into its own animation (Safari).
      document.documentElement.style.scrollBehavior = "auto";
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / duration);
        const t2 = t * t;
        const t3 = t2 * t;
        // Starts at speed v0, lands on `to` with zero speed.
        const y = from * (2 * t3 - 3 * t2 + 1) + m * (t3 - 2 * t2 + t) + to * (3 * t2 - 2 * t3);
        // Two-number form: Safari doesn't know behavior "instant".
        scrollTo(scrollX, y);
        if (t < 1 && gliding) glideRaf = requestAnimationFrame(step);
        else stop();
      };
      glideRaf = requestAnimationFrame(step);
    };
    let glideDir = 0;
    const stop = () => {
      gliding = false;
      cancelAnimationFrame(glideRaf);
      document.documentElement.style.scrollBehavior = "";
    };
    // Any user input during the glide hands control straight back, except Safari's trackpad momentum:
    // its trailing wheel events (same direction) would otherwise cancel the glide as soon as it starts.
    const interrupt = (e?: Event) => {
      if (!gliding) return;
      if (e instanceof WheelEvent && Math.sign(e.deltaY) === glideDir) return;
      stop();
    };
    const settle = () => {
      // Not on phones and tablets: a finger scroll has its own momentum, a glide on top fights it.
      if (innerWidth < 1024 || matchMedia("(pointer: coarse)").matches) return;
      const y = scrollY;
      // Down: past the slide, with step 1 at 37% of the screen height, same spot as the
      // "How it works" link. Up: back to the top, the phone a thin divider.
      const how = document.getElementById("how");
      // Exactly where the browser scrolls for that link: the anchor's top minus its scroll-margin.
      // Without the slide-in offset the steps still have while fading in (up to 24px lower): where they settle.
      const slideIn = after.current ? new DOMMatrixReadOnly(getComputedStyle(after.current).transform).f : 0;
      const rest = how ? how.getBoundingClientRect().top - slideIn + y - parseFloat(getComputedStyle(how).scrollMarginTop) : zone[1] + innerHeight * 0.06;
      if (gliding || y <= zone[0] || y >= rest - 2) return;
      glide(dir > 0 ? rest : zone[0]);
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
      // Not loaded yet: nothing to show, and nothing to ease toward (it lands on the spot when it loads).
      // Also while a seek is pending (Safari reports metadata only then): a stalled seek can then be re-asked.
      if (v.readyState >= 2 || v.seeking) shown += (target - shown) * 0.1;
      // No easing on the squash: it follows the scroll exactly, so the divider never lags into a thick bar.
      grown = grow;
      slid += (slide - slid) * 0.1;
      // While squashed into the divider, always show frame 0 (the phone seen edge-on): a lagging,
      // half-turned frame squashed flat is what made the line change width and shake on the way up.
      if (grow < 1 || grown < 0.98) shown = Math.min(shown, target);
      if (grown < 0.98) shown = 0;
      // After it stands up, the content fades in beside it.
      if (after.current) {
        // The content only shows up once the phone has almost reached its spot, so the two
        // never cross: it fades in and eases from the right and slightly below.
        const k = Math.min(1, Math.max(0, (slid - 0.7) / 0.3));
        const e = 1 - (1 - k) ** 3;
        after.current.style.opacity = String(e);
        // The live screen lights up inside the phone together with the content.
        if (screen.current) {
          screen.current.style.opacity = String(e);
          screen.current.style.pointerEvents = e > 0.5 ? "auto" : "none";
          // Slow fade-in once aside, quick fade-out as soon as the user scrolls back up (the phone turns back).
          if (glass.current) {
            const on = e > 0.9;
            glass.current.style.transitionDuration = on ? "1000ms" : "200ms";
            glass.current.style.opacity = on ? "1" : "0";
          }
          if (island.current) {
            const on = e > 0.9;
            const st = island.current.style;
            // Overshooting curve for the bounce, shortly after the white screen starts fading in; hides at once.
            st.transition = on
              ? "transform 600ms cubic-bezier(.34,1.8,.5,1) 300ms, opacity 150ms ease-out 300ms"
              : "transform 150ms ease-in, opacity 150ms ease-in";
            st.opacity = on ? "1" : "0";
            st.transform = `translateX(-50%) scale(${on ? 1 : 0.3})`;
          }
        }
        after.current.style.transform = `translate(${(1 - e) * 40}px, ${(1 - e) * 24}px)`;
      }
      // The phone stays centred; the content beside it adapts instead.
      v.style.transform = `scaleY(${MIN_SCALE + (1 - MIN_SCALE) * grown})`;
      // Skip while the previous seek is still decoding: queuing seeks is what makes it stutter.
      // A seek still pending after 400 ms is stuck (Safari): it is asked again.
      const stuck = v.seeking && performance.now() - seekAt > 400;
      const want = Math.min(v.duration - 0.04, shown * v.duration);
      if (v.duration && (stuck || (!v.seeking && Math.abs(v.currentTime - want) > 0.01))) {
        seekAt = performance.now();
        // The same time as the pending seek counts as no seek for WebKit: nudged.
        v.currentTime = stuck && Math.abs(v.currentTime - want) < 0.001 ? Math.max(0, want - 0.001) : want;
      }
    };
    measure();
    // Loaded late (slow connection), once the page is already scrolled into the turn: no turning from
    // edge-on to catch up, the phone shows up straight at where the scroll is (facing, when past it).
    const late = () => {
      if (target > 0) shown = target;
    };
    if (v.readyState < 2) v.addEventListener("loadeddata", late, { once: true });
    // Safari sometimes never loads a video that doesn't play (Low Power Mode, a tab restored from the
    // back-forward cache) and can stall seeking into ranges it hasn't fetched: the phone then stays on
    // frame 0, edge-on. The whole clip (a few hundred KB) is fetched once and played from memory, and
    // a muted play-then-pause makes Safari decode it.
    let blobUrl = "";
    let disposed = false;
    const kick = () => {
      if (disposed || v.readyState >= 2) return;
      const p = v.play();
      if (p) p.then(() => v.pause(), () => {});
    };
    // Play refused (Low Power Mode): a seek still makes Safari fetch and decode a frame. Kept for the
    // load() after a back-forward cache restore.
    const prime = () => {
      if (v.readyState < 2 && v.currentTime === 0) v.currentTime = 0.001;
    };
    v.addEventListener("loadedmetadata", prime);
    // The source is set once, here (not in the markup): swapping it later would blank the phone for a moment.
    const use = (url: string) => {
      if (disposed || v.getAttribute("src")) return;
      v.src = url;
      v.load();
      kick();
    };
    // Streamed instead if the download is slow or fails.
    const ac = new AbortController();
    const fallback = setTimeout(() => {
      ac.abort();
      use(src);
    }, 4000);
    // Aborted on unmount too (phones and narrow windows unmount the phone after hydration).
    void fetch(src, { signal: ac.signal })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((b) => {
        clearTimeout(fallback);
        if (disposed || v.getAttribute("src")) return;
        blobUrl = URL.createObjectURL(b);
        use(blobUrl);
      })
      .catch(() => {
        clearTimeout(fallback);
        use(src);
      });
    // When the last seek was asked: one Safari never finishes (`seeking` stuck) is asked again (see tick).
    let seekAt = 0;
    raf = requestAnimationFrame(tick);
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("wheel", interrupt, { passive: true });
    addEventListener("touchstart", interrupt, { passive: true });
    addEventListener("keydown", interrupt);
    addEventListener("resize", measure);
    // Back from the back-forward cache: the page's scroll may have moved, and Safari may have dropped the video.
    const onShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      measure();
      if (v.readyState < 2) {
        v.load();
        kick();
      }
    };
    addEventListener("pageshow", onShow);
    return () => {
      disposed = true;
      ac.abort();
      clearTimeout(fallback);
      v.removeEventListener("loadedmetadata", prime);
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      removeEventListener("pageshow", onShow);
      cancelAnimationFrame(raf);
      v.removeEventListener("loadeddata", late);
      removeEventListener("scroll", onScroll);
      clearTimeout(idle);
      stop();
      removeEventListener("wheel", interrupt);
      removeEventListener("touchstart", interrupt);
      removeEventListener("keydown", interrupt);
      removeEventListener("resize", measure);
    };
  }, [src]);
  return (
    // Pulled up by half the clip so its middle line (the edge-on phone) lands just below what's above,
    // less half of what the phone grew so the taller phone stands up clear of the prompts above.
    // The phone stays pinned for as long as the section lasts: children (on the right) scroll past it,
    // and a spacer at the end (not padding: a sticky box stops at its parent's content) keeps it pinned
    // until the last step has been read; what comes next is pulled back up over that spacer.
    <div
      ref={section}
      className="pointer-events-none relative"
      style={{ minHeight: `calc(${SIZE} + 70vh)`, marginTop: `calc(${SIZE} / -2 - 8px + ${GROWTH} / 2)`, marginBottom: `calc(-1 * ${GROWTH} / 3)` }}>
      {/* Sticky makes its own stacking context: blend it as a whole so the clip's black drops out. */}
      <div className="pointer-events-none sticky flex justify-center mix-blend-screen" style={{ top: `calc(50vh - ${SIZE} / 2)` }}>
        <video
          ref={video}
          muted
          playsInline
          preload="auto"
          className={className}
          style={{ width: SIZE, height: SIZE, transform: `scaleY(${MIN_SCALE})`, willChange: "transform" }}
        />
      </div>
      {children && (
        // Live screen over the phone's glass: a second sticky layer at the same spot (outside the
        // blended one, which would wash it out), pulled back up by its own height.
        <div className="pointer-events-none sticky z-10 hidden justify-center lg:flex" style={{ top: `calc(50vh - ${SIZE} / 2)`, height: SIZE, marginTop: `calc(-1 * ${SIZE})` }}>
          <div className="grid place-items-center" style={{ width: SIZE, height: SIZE }}>
            <div
              ref={screen}
              className="relative overflow-hidden opacity-0"
              style={{ width: `calc(${SIZE} * ${PHONE_RATIO} * ${SCREEN_W})`, height: `calc(${SIZE} * ${SCREEN_H})`, borderRadius: `calc(${SIZE} * 0.042)` }}>
              {/* White screen lighting up slowly once the phone has slid aside. */}
              <div ref={glass} className="absolute inset-0 bg-white opacity-0 transition-opacity ease-out" />
              {/* Laid out at the first size, then scaled with the phone: the scenes keep their proportions. A
                  transform, not CSS zoom, which Chrome (standardized zoom) and Safari size differently. */}
              <div className="relative" style={{ width: `${100 / PHONE_SCALE}%`, height: `${100 / PHONE_SCALE}%`, transform: `scale(${PHONE_SCALE})`, transformOrigin: "0 0" }}>
                <PhoneSteps />
              </div>
              {/* Dynamic Island: pops in with a bounce once the white screen has faded in. */}
              <div ref={island} className="pointer-events-none absolute left-1/2 top-[2.2%] h-[4.2%] w-[32%] rounded-full bg-black opacity-0" style={{ transform: "translateX(-50%) scale(0.3)" }} />
            </div>
          </div>
        </div>
      )}
      {children && (
        // Hidden until the phone has slid left (fades in with it, so they never overlap); its top
        // then sits level with the top of the pinned phone.
        <div
          ref={after}
          className="scroll-video-side pointer-events-auto relative px-6 pb-[8vh] opacity-0 lg:px-0"
          style={
            {
              // The bigger phone takes longer to slide aside (its middle is pinned lower): the steps
              // start later by as much, so step 1 (where the scroll assist stops) shows once it has.
              marginTop: `calc(${(ROTATE_VH + SLIDE_VH) * 100 + SIDE_DROP_VH}vh - ${SIZE} + ${GROWTH} / 2)`,
              "--side-w": `${SIDE_W}px`,
              "--phone-w": `calc(${SIZE} * ${PHONE_RATIO})`,
              "--gap": `${GAP}px`,
              "--nudge": `${NUDGE}px`,
            } as React.CSSProperties
          }>
          {children}
        </div>
      )}
      <div aria-hidden style={{ height: `calc(${GROWTH} + 6vh)` }} />
    </div>
  );
}

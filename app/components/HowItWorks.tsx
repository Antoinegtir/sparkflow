"use client";

import clsx from "clsx";
import { Eye, Hammer, Map as MapIcon, MessageSquareText, MousePointerClick, RefreshCcw, Rocket } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AsciiField } from "./AsciiField";
import { brandIcon } from "./BrandIcons";
import { STEP_EVENT } from "./PhoneSteps";

/** The process, step by step, as shown on the landing's vertical timeline. */
const STEPS = [
  {
    icon: MessageSquareText,
    kicker: "01 · Describe",
    title: "Say it, sketch it, or show it",
    body: "Write a sentence, drop a photo of a paper sketch or a screenshot, or just talk. Muse Spark understands all three, and SAM 3.1 picks out every button, card and list on a sketch so nothing gets lost.",
    tags: ["Muse Spark", "Voice", "SAM 3.1"],
  },
  {
    icon: MapIcon,
    kicker: "02 · Plan",
    title: "A real plan before any code",
    body: "The Planner decides the screens, how you move between them, the data each one shows and the theme. Every screen gets a short list of things you can check on a screenshot, like “three habit rows, a check on each”. That list is how Sparkflow knows a screen is right.",
    tags: ["Screens", "Navigation", "Acceptance criteria"],
  },
  {
    icon: Hammer,
    kicker: "03 · Build",
    title: "Real React Native, screen by screen",
    body: "The Builder writes an Expo app in TypeScript with real tools: it reads and edits files, runs the type checker and fixes its own errors. Every change is a git commit you can compare or restore.",
    tags: ["React Native", "Expo", "TypeScript", "git"],
  },
  {
    icon: Eye,
    kicker: "04 · Look",
    title: "Then it opens the app and looks at it",
    body: "Sparkflow runs the app on the web, in the iOS Simulator and in the Android emulator, takes a screenshot and reads the accessibility tree. Muse Spark checks each item of the list by looking, along with contrast, touch targets and text that overflows.",
    tags: ["iOS Simulator", "Android emulator", "Vision", "Accessibility"],
  },
  {
    icon: RefreshCcw,
    kicker: "05 · Fix",
    title: "When something's off, it fixes it",
    body: "A screen that fails goes back to the Builder with its screenshot and the exact items that failed. It tries again until every item passes, then moves on to the next screen. You watch each page fill in live.",
    tags: ["Verify, fix, repeat"],
  },
  {
    icon: MousePointerClick,
    kicker: "06 · Point and talk",
    title: "Point at it and say what to change",
    body: "Click anything on the live phone, a button or a whole card, and say “bigger, in blue”. Sparkflow finds the component, the file and the line, makes the change and takes a new screenshot. Every version stays on a timeline.",
    tags: ["Show and tell", "Versions", "iPhone and iPad"],
  },
  {
    icon: Rocket,
    kicker: "07 · Ship",
    title: "On your phone, then on the stores",
    body: "Scan the QR code to try it in Expo Go, build the real app with its own name for the Simulator or the emulator, or send it to TestFlight and Google Play. Export the code whenever you want: nothing is locked in.",
    tags: ["Expo Go", "TestFlight", "Google Play", "Bring your project"],
  },
];

/**
 * "How it works": a vertical timeline. The line fills as you scroll, each dot lights up
 * when its step reaches 45% of the screen height, and the step slides in.
 */
export function HowItWorks() {
  const root = useRef<HTMLDivElement>(null);
  const [fill, setFill] = useState(0);
  const [reached, setReached] = useState(-1);
  // The rail runs from the first step's dot to the last one's, not past it.
  const [rail, setRail] = useState({ top: 96, height: 0 });
  // The pinned phone follows the step being read.
  useEffect(() => {
    dispatchEvent(new CustomEvent(STEP_EVENT, { detail: Math.max(0, reached) }));
  }, [reached]);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const mid = innerHeight * 0.45;
        const dots = [...el.querySelectorAll<HTMLElement>("[data-step]")];
        // Dot centres (31px dots at the top of each step), relative to the timeline.
        const first = dots[0].getBoundingClientRect().top - r.top + 15;
        const last = dots[dots.length - 1].getBoundingClientRect().top - r.top + 15;
        setRail((o) => (o.top === first && o.height === last - first ? o : { top: first, height: last - first }));
        setFill(Math.min(1, Math.max(0, (mid - r.top - first + 15) / (last - first))));
        setReached(dots.reduce((n, d, i) => (d.getBoundingClientRect().top < mid ? i : n), -1));
      });
    };
    measure();
    addEventListener("scroll", measure, { passive: true });
    addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("scroll", measure);
      removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div>
      {/* Placed beside the pinned phone by ScrollVideo. */}
      <div ref={root} className="relative w-full">
        <p className="hiw-title landing-head mb-12 text-3xl font-semibold text-ink-100">How it works</p>
        {/* The title and a summary of the steps, on the other side of the phone. */}
        <nav className="hiw-summary">
          <div className="sticky top-[calc(50vh-180px)] text-right">
            {/* Just as wide as its text: the ASCII field sits right beside it, on the left. */}
            <div className="relative ml-auto w-max">
            <p className="landing-head mb-8 text-3xl font-semibold text-ink-100">How it works</p>
            <ol className="flex flex-col gap-3">
              {STEPS.map(({ kicker, title }, i) => (
                <li key={kicker}>
                  {/* Goes to that step: the timeline, the phone and this list follow the scroll. */}
                  <button
                    type="button"
                    onClick={() => root.current?.querySelectorAll<HTMLElement>("[data-step]")[i]?.scrollIntoView({ behavior: "smooth", block: "start" })}
                    className={clsx(
                      "group cursor-pointer text-right transition-all duration-300 hover:-translate-x-1 hover:text-ink-100",
                      i === reached ? "text-ink-100" : i < reached ? "text-ink-400" : "text-ink-600",
                    )}>
                    <span className={clsx("mr-3 font-mono text-[11px] tracking-[0.18em] transition-colors group-hover:text-spark-400", i <= reached ? "text-spark-400" : "text-ink-600")}>{kicker.slice(0, 2)}</span>
                    <span className="text-[14px]">{title}</span>
                  </button>
                </li>
              ))}
            </ol>
            {/* Fills the dark space left of the summary: an ASCII motif for the step being read. Out of
                the flow, so the pinned summary keeps its size. */}
            <div className="absolute right-full top-1/2 mr-8 -translate-y-1/2">
              <AsciiField step={Math.max(0, reached)} />
            </div>
            </div>
          </div>
        </nav>
        {/* Rail and its scroll-driven fill. */}
        <div className="absolute left-[15px] w-px bg-ink-700" style={{ top: rail.top, height: rail.height }} />
        <div
          className="absolute left-[15px] w-px bg-gradient-to-b from-spark-400 to-spark-500 transition-[height] duration-150"
          style={{ top: rail.top, height: rail.height * fill }}
        />
        <ol className="flex flex-col gap-14">
          {STEPS.map(({ icon: Icon, kicker, title, body, tags }, i) => {
            const on = i <= reached;
            return (
              // The first step is the anchor of the "How it works" link: it lands at 37% of the screen height.
              <li key={kicker} id={i === 0 ? "how" : undefined} data-step className="relative scroll-mt-[37vh] pl-14">
                <span
                  className={clsx(
                    "absolute left-0 top-0 grid h-[31px] w-[31px] place-items-center rounded-full border transition-all duration-500",
                    on
                      ? "border-spark-400 bg-spark-500 text-white shadow-[0_0_0_6px_color-mix(in_oklab,var(--color-spark-500)_18%,transparent)]"
                      : "border-ink-600 bg-ink-900 text-ink-500",
                  )}>
                  {/* The last step reached: confetti, again each time you scroll back to it. */}
                  {i === STEPS.length - 1 && i === reached && <Confetti />}
                  {/* The step being read: a ring that keeps spreading out from its dot. */}
                  {i === reached && <span className="absolute inset-0 animate-ping rounded-full border-2 border-spark-400 [animation-duration:1.6s]" />}
                  <Icon size={15} />
                </span>
                <div
                  className={clsx(
                    "transition-all duration-700 ease-out",
                    on ? "translate-y-0 opacity-100" : "translate-y-6 opacity-30",
                  )}>
                  <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-spark-400">{kicker}</div>
                  <h3 className="landing-head mt-2 text-xl font-semibold text-ink-100">{title}</h3>
                  <p className="mt-3 text-[14.5px] leading-relaxed text-ink-400">{body}</p>
                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-500">
                    {tags.map((t) => (
                      <span key={t} className="flex items-center gap-1.5">
                        {brandIcon(t) ?? <span className={clsx("h-1 w-1 rounded-full", on ? "bg-spark-400" : "bg-ink-600")} />}
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

const CONFETTI_COLORS = ["#3b82f6", "#60a5fa", "#a78bfa", "#f472b6", "#facc15", "#34d399"];
/** A burst of confetti from the parent's centre (fixed per mount, so it doesn't change on re-render). */
function Confetti() {
  const [pieces] = useState(() =>
    Array.from({ length: 36 }, (_, i) => {
      const angle = (i / 36) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 60 + Math.random() * 110;
      return {
        x: `${Math.cos(angle) * dist}px`,
        y: `${Math.sin(angle) * dist - 40}px`,
        r: `${Math.round(Math.random() * 720 - 360)}deg`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        round: i % 3 === 0,
        delay: `${Math.random() * 120}ms`,
      };
    }),
  );
  return (
    <span className="pointer-events-none absolute left-1/2 top-1/2 z-10" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className={clsx("hiw-confetti absolute -ml-1 -mt-1 h-2 w-1.5", p.round && "w-2 rounded-full")}
          style={{ background: p.color, animationDelay: p.delay, ["--x" as string]: p.x, ["--y" as string]: p.y, ["--r" as string]: p.r }}
        />
      ))}
    </span>
  );
}

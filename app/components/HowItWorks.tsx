"use client";

import clsx from "clsx";
import { Eye, Hammer, Map as MapIcon, MessageSquareText, MousePointerClick, RefreshCcw, Rocket } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { STEP_EVENT } from "./PhoneSteps";

/** The process, step by step, as shown on the landing's vertical timeline. */
const STEPS = [
  {
    icon: MessageSquareText,
    kicker: "01 · Describe",
    title: "Say what you want, however you like",
    body: "Type a sentence, drop a paper sketch or a screenshot, or record a voice memo. Muse Spark reads all three. SAM 3.1 cuts the sketch into buttons, cards and lists so nothing on the page is missed.",
    tags: ["Muse Spark", "Voice", "SAM 3.1"],
  },
  {
    icon: MapIcon,
    kicker: "02 · Plan",
    title: "A plan you could hand to a designer",
    body: "The Planner turns your idea into screens, navigation, a data model and a theme. Every screen gets visual acceptance criteria: things you can check on a single screenshot, like “three habit cards with a check button each”.",
    tags: ["Screens", "Navigation", "Acceptance criteria"],
  },
  {
    icon: Hammer,
    kicker: "03 · Build",
    title: "Real React Native, written screen by screen",
    body: "The Builder writes Expo and React Native code with real tools: it reads and edits files, runs the type checker and fixes its own errors. Every iteration is a git commit, so any version can be compared, diffed or restored.",
    tags: ["React Native", "Expo", "TypeScript", "git"],
  },
  {
    icon: Eye,
    kicker: "04 · Look",
    title: "Then it opens the app and looks at it",
    body: "Sparkflow runs what it just built, on the web, in the iOS Simulator and in the Android emulator. It takes a screenshot, reads the accessibility tree and the console, and Muse Spark checks each criterion with its own eyes, plus contrast, touch targets and overflow.",
    tags: ["iOS Simulator", "Android emulator", "Vision", "Accessibility"],
  },
  {
    icon: RefreshCcw,
    kicker: "05 · Fix",
    title: "Wrong? It sees why and fixes it",
    body: "A failing screen goes back to the Builder with the rejected screenshot and the exact list of what is off. It tries again until the screen passes, and only then moves on. You watch every page fill in live.",
    tags: ["Verify, fix, repeat"],
  },
  {
    icon: MousePointerClick,
    kicker: "06 · Point and talk",
    title: "Change anything by pointing at it",
    body: "Click a button on the live iPhone and say “bigger, in blue”. Sparkflow finds the component, the file and the line, edits your code and recaptures the page. Versions stack up on a timeline with before and after.",
    tags: ["Show and tell", "Versions", "iPhone and iPad"],
  },
  {
    icon: Rocket,
    kicker: "07 · Ship",
    title: "Your code, on your phone",
    body: "Scan the QR code to open the app in Expo Go, export the source, or import your own React Native project and let Sparkflow work on it in place. Nothing is locked in.",
    tags: ["Expo Go", "Export", "Bring your project"],
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
        setFill(Math.min(1, Math.max(0, (mid - r.top) / r.height)));
        const dots = [...el.querySelectorAll<HTMLElement>("[data-step]")];
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
          </div>
        </nav>
        {/* Rail and its scroll-driven fill. */}
        <div className="absolute bottom-0 left-[15px] top-24 w-px bg-ink-700" />
        <div
          className="absolute left-[15px] top-24 w-px bg-gradient-to-b from-spark-400 to-spark-500 transition-[height] duration-150"
          style={{ height: `calc((100% - 6rem) * ${fill})` }}
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
                        <span className={clsx("h-1 w-1 rounded-full", on ? "bg-spark-400" : "bg-ink-600")} />
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

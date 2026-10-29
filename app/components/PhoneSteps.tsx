"use client";

import clsx from "clsx";
import { Camera, Check, FileImage, Loader2, Mic, MousePointer2, RotateCcw, Sparkles, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { AppStoreLogo, PlayStoreLogo } from "./BrandIcons";
import { InstallIcon } from "./InstallIcon";

/** HowItWorks announces the step reaching the middle of the screen; the pinned phone shows it. */
export const STEP_EVENT = "sparkflow:hiw-step";

const HABITS = ["Read 20 pages", "Morning walk", "Drink water"];

/**
 * A short scene played in a loop: the phase moves on after each duration (ms), back to 0 after the last.
 * Each step of the phone is one such scene.
 */
function useScene(durations: number[]) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setPhase((p) => (p + 1) % durations.length), durations[phase]);
    return () => clearTimeout(t);
  }, [phase, durations]);
  return phase;
}

/** Text typed out once, a character at a time, from when `on` turns true. */
function useTyped(text: string, on: boolean, ms = 38) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!on) return setN(0);
    const t = setInterval(() => setN((x) => (x >= text.length ? x : x + 1)), ms);
    return () => clearInterval(t);
  }, [text, on, ms]);
  return text.slice(0, n);
}

const Caret = ({ dark }: { dark?: boolean }) => <span className={clsx("ml-px inline-block h-3 w-px translate-y-0.5 animate-pulse", dark ? "bg-neutral-900" : "bg-white")} />;

const Dots = () => (
  <span className="inline-flex gap-0.5">
    {[0, 1, 2].map((i) => (
      <span key={i} className="size-1 animate-bounce rounded-full bg-neutral-400" style={{ animationDelay: `${i * 120}ms` }} />
    ))}
  </span>
);

// ---- 01 · Describe: a sentence, a sketch, a voice memo, and the answer ----

const DESCRIBE = [2600, 1100, 1700, 900, 2600];
function Describe() {
  const phase = useScene(DESCRIBE);
  const typed = useTyped("A habit tracker with streaks and a weekly chart", phase === 0, 42);
  return (
    <div className="flex h-full flex-col justify-end gap-2 px-2.5 py-3">
      <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-spark-500 px-3 py-2 text-[11px] leading-snug text-white">
        {phase === 0 ? typed : "A habit tracker with streaks and a weekly chart"}
        {phase === 0 && <Caret />}
      </div>
      {phase >= 1 && (
        <div className="hiw-pop ml-auto flex items-center gap-2 rounded-xl border border-black/10 bg-white p-1.5 shadow-sm">
          {/* A photo of a paper sketch: a phone screen drawn in pencil on ruled paper, a little askew. */}
          <div className="h-12 w-9 shrink-0 -rotate-3 overflow-hidden rounded-[3px] bg-[#f7f2e6] shadow-[0_1px_3px_rgba(0,0,0,.18)]">
            <svg viewBox="0 0 30 40" className="h-full w-full" aria-hidden>
              {/* Ruled lines and the margin. */}
              <g stroke="#9ec1e0" strokeWidth=".35" opacity=".7">
                {[6, 11, 16, 21, 26, 31, 36].map((y) => (
                  <path key={y} d={`M0 ${y}h30`} />
                ))}
              </g>
              <path d="M4 0v40" stroke="#e8a3a3" strokeWidth=".35" />
              <g fill="none" stroke="#4a4438" strokeWidth=".8" strokeLinecap="round" strokeLinejoin="round">
                {/* The phone, its title, three habit rows with a check circle each, a bar chart. */}
                <path d="M8.4 3.2c4.6-.3 9.2-.2 13.6.1.6 2.6.6 30.5.2 33.4-4.3.4-9.4.4-13.9.1-.5-3.3-.4-30.9.1-33.6z" />
                <path d="M10.5 6.8h5.2" strokeWidth="1.1" />
                <path d="M10.2 10.3h9.6v3.1h-9.6zM10.3 15.2h9.5v3h-9.4zM10.2 20h9.6v3.1h-9.6z" />
                <circle cx="18.3" cy="11.8" r=".8" />
                <circle cx="18.3" cy="16.7" r=".8" />
                <circle cx="18.3" cy="21.5" r=".8" />
                <path d="M11 32.5v-3M13.4 32.5v-5M15.8 32.5v-2.2M18.2 32.5v-4.2M10.4 32.6h9" />
              </g>
            </svg>
          </div>
          <div className="pr-1 text-[9px] leading-tight text-neutral-600">
            <div className="flex items-center gap-1 font-medium text-neutral-900">
              <FileImage size={9} /> sketch.jpg
            </div>
            {phase >= 2 ? <span className="text-emerald-600">3 rows · 1 chart found</span> : "reading…"}
          </div>
        </div>
      )}
      {phase >= 2 && (
        <div className="hiw-pop flex items-center gap-2 overflow-hidden rounded-full bg-black/8 px-3 py-2">
          <Mic size={12} className="shrink-0 text-spark-400" />
          <div className="flex h-4 min-w-0 flex-1 items-center gap-[3px] overflow-hidden">
            {Array.from({ length: 18 }, (_, i) => (
              <span key={i} className={clsx("w-[3px] shrink-0 rounded-full bg-spark-400/80", phase === 2 ? "hiw-wave" : "h-[30%]")} style={{ animationDelay: `${i * 70}ms` }} />
            ))}
          </div>
          <span className="shrink-0 font-mono text-[8.5px] text-neutral-500">0:04</span>
        </div>
      )}
      {phase >= 3 && (
        <div className="hiw-pop max-w-[88%] rounded-2xl rounded-bl-md bg-black/6 px-3 py-2 text-[10.5px] leading-snug text-neutral-800">
          {phase === 3 ? (
            <Dots />
          ) : (
            <>
              <Sparkles size={10} className="mr-1 inline text-spark-500" />
              Got it: 4 screens, a streak on every habit and a chart of the week.
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---- 02 · Plan: four screens, each its own layout, the links between them, then what one must show ----

/** A screen of the plan as a tiny wireframe: its name and a sketch of what it holds. */
function PlanCard({ name, children, delay, lit }: { name: string; children: React.ReactNode; delay: number; lit?: boolean }) {
  return (
    <div className={clsx("hiw-pop rounded-lg border bg-white p-1.5 shadow-sm transition-colors duration-500", lit ? "border-spark-400 ring-2 ring-spark-400/25" : "border-black/10")} style={{ animationDelay: `${delay}ms` }}>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[8.5px] font-semibold text-neutral-900">{name}</span>
        <span className="h-1 w-1 rounded-full bg-black/15" />
      </div>
      <div className="h-[34px]">{children}</div>
    </div>
  );
}

const bar = "rounded-sm bg-black/12";
const PLAN = [1500, 1200, 3200];
function Plan() {
  const phase = useScene(PLAN);
  const criteria = ["Three habit rows, a check on each", "A progress bar for the day", "A streak count on every habit"];
  return (
    <div className="flex h-full flex-col justify-center gap-2.5 px-2.5 py-3">
      <div className="flex items-baseline justify-between px-0.5">
        <span className="text-[11px] font-bold text-neutral-900">Plan</span>
        <span className="text-[8px] text-neutral-500">4 screens · tabs</span>
      </div>
      <div className="relative grid grid-cols-2 gap-x-3 gap-y-3">
        <PlanCard name="Today" delay={0} lit={phase === 2}>
          <div className="space-y-[3px]">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-1">
                <span className={clsx("size-[7px] rounded-full border", i === 0 ? "border-spark-500 bg-spark-500" : "border-black/25")} />
                <span className={clsx(bar, "h-[5px] flex-1")} />
              </div>
            ))}
          </div>
        </PlanCard>
        <PlanCard name="Stats" delay={140}>
          <div className="flex h-full items-end gap-[3px] px-0.5 pb-0.5">
            {[40, 65, 30, 85, 55, 100, 70].map((h, i) => (
              <span key={i} className="flex-1 rounded-t-[2px] bg-spark-400/70" style={{ height: `${h}%` }} />
            ))}
          </div>
        </PlanCard>
        <PlanCard name="Habit" delay={280}>
          <div className="flex h-full items-center gap-1.5">
            <span className="text-[15px] font-bold leading-none text-spark-500">12</span>
            <div className="flex-1 space-y-[3px]">
              <span className={clsx(bar, "block h-[4px] w-full")} />
              <span className={clsx(bar, "block h-[4px] w-2/3")} />
            </div>
          </div>
        </PlanCard>
        <PlanCard name="Settings" delay={420}>
          <div className="space-y-[4px]">
            {[true, false, true].map((on, i) => (
              <div key={i} className="flex items-center gap-1">
                <span className={clsx(bar, "h-[4px] flex-1")} />
                <span className={clsx("flex h-[7px] w-[12px] items-center rounded-full p-[1px]", on ? "justify-end bg-emerald-400" : "bg-black/15")}>
                  <span className="size-[5px] rounded-full bg-white" />
                </span>
              </div>
            ))}
          </div>
        </PlanCard>
        {/* Navigation: Today opens Stats and a Habit; drawn in once the screens are there. */}
        <span className={clsx("pointer-events-none absolute left-1/2 top-[24%] h-[2px] w-3 -translate-x-1/2 origin-left rounded-full bg-spark-500 transition-transform duration-500", phase >= 1 ? "scale-x-100" : "scale-x-0")} />
        <span className={clsx("pointer-events-none absolute left-[24%] top-1/2 h-3 w-[2px] -translate-y-1/2 origin-top rounded-full bg-spark-500 transition-transform duration-500 delay-200", phase >= 1 ? "scale-y-100" : "scale-y-0")} />
      </div>
      {/* What Today must show: checked on its screenshot later. */}
      <div className={clsx("rounded-lg border border-black/10 bg-black/[0.03] p-2 transition-opacity duration-300", phase === 2 ? "opacity-100" : "opacity-0")}>
        <p className="mb-1 text-[8px] font-semibold uppercase tracking-wide text-neutral-500">Today must show</p>
        <div className="space-y-1">
          {criteria.map((c, i) => (
            <div key={c} className={clsx("flex items-start gap-1.5 text-[9px] leading-snug text-neutral-700 transition-all duration-300", phase === 2 ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0")} style={{ transitionDelay: `${200 + i * 250}ms` }}>
              <span className="mt-[1px] grid size-3 shrink-0 place-items-center rounded-full bg-spark-500 text-white">
                <Check size={7} strokeWidth={3} />
              </span>
              {c}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- 03 · Build: the code written, the type check, the commit ----

const BUILD_LINES = [
  ["<Screen>", "text-sky-700"],
  ['  <Header title="Today" />', "text-sky-700"],
  ["  <ProgressBar value={done} />", "text-sky-700"],
  ["  {habits.map((h) => (", "text-violet-700"],
  ["    <HabitRow habit={h} />", "text-sky-700"],
  ["  ))}", "text-violet-700"],
  ["</Screen>", "text-sky-700"],
] as const;
const BUILD = [2300, 1200, 2200];
function Build() {
  const phase = useScene(BUILD);
  return (
    <div className="flex h-full flex-col justify-center px-2.5 py-3 font-mono text-[9px] leading-relaxed">
      <div className="mb-2 flex items-center gap-1 text-[8.5px] text-neutral-500">
        <span className="rounded bg-black/6 px-1.5 py-0.5">app/(tabs)/index.tsx</span>
      </div>
      {/* Keyed by the loop: the lines type out again each time round. */}
      <div key={phase === 0 ? "typing" : "done"}>
        {BUILD_LINES.map(([l, color], i) => (
          <div key={i} className={clsx("truncate whitespace-pre", color, phase === 0 && "hiw-type")} style={{ animationDelay: `${i * 280}ms` }}>
            <span className="mr-2 text-neutral-400">{i + 1}</span>
            {l}
          </div>
        ))}
      </div>
      <div className="mt-3 h-4 text-[9.5px]">
        {phase === 1 && (
          <span className="hiw-pop flex items-center gap-1.5 text-neutral-500">
            <Loader2 size={11} className="animate-spin" /> tsc --noEmit
          </span>
        )}
        {phase === 2 && (
          <span className="hiw-pop flex items-center gap-1.5 text-emerald-600">
            <Check size={11} /> Type check passed · commit a1f3c9e
          </span>
        )}
      </div>
    </div>
  );
}

// ---- 04 · Look: the app runs, a screenshot, each criterion checked ----

/** A tiny Today screen; `done` toggles on tap, which the visitor can try. */
function MiniApp({ highlight, onTap, done, big }: { highlight?: number; onTap?: (i: number) => void; done: boolean[]; big?: number }) {
  return (
    <div className="px-2.5 py-3">
      <div className="text-[13px] font-bold text-neutral-900">Today</div>
      <div className="text-[8.5px] text-neutral-500">{done.filter(Boolean).length} of 3 done</div>
      <div className="mt-2 h-1 overflow-hidden rounded bg-black/10">
        <div className="h-full bg-spark-500 transition-all duration-500" style={{ width: `${(done.filter(Boolean).length / 3) * 100}%` }} />
      </div>
      <div className="mt-2 space-y-1.5">
        {HABITS.map((h, i) => (
          <button
            key={h}
            type="button"
            onClick={() => onTap?.(i)}
            className={clsx(
              "flex w-full cursor-pointer items-center justify-between rounded-lg px-2 text-left text-neutral-900 transition-all duration-500",
              big === i ? "bg-sky-500 py-2.5 text-[11px] font-semibold text-white" : "bg-black/6 py-1.5 text-[10px]",
              highlight === i && "ring-2 ring-sky-400",
            )}>
            {h}
            <span className={clsx("grid size-3.5 place-items-center rounded-full border transition", done[i] ? "border-spark-500 bg-spark-500 text-white" : big === i ? "border-white/70" : "border-black/30")}>
              {done[i] && <Check size={8} />}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

const LOOK = [700, 400, 650, 650, 650, 1800];
function Look() {
  const phase = useScene(LOOK);
  const [done, setDone] = useState([true, false, false]);
  const checks = ["Header reads “Today”", "Three habit rows", "Progress bar"];
  return (
    <div className="relative h-full">
      <MiniApp done={done} onTap={(i) => setDone((d) => d.map((x, j) => (j === i ? !x : x)))} />
      {/* The screenshot: a flash, then the scan runs down the page. */}
      <div className={clsx("pointer-events-none absolute inset-0 bg-white transition-opacity duration-200", phase === 1 ? "opacity-80" : "opacity-0")} />
      {phase >= 2 && <div className="hiw-scan pointer-events-none absolute inset-x-0 h-8 bg-gradient-to-b from-transparent via-sky-400/25 to-transparent" />}
      <div className="absolute left-2.5 top-1 flex items-center gap-1 text-[8px] text-neutral-500">
        <Camera size={9} /> {phase === 0 ? "iOS Simulator" : "Screenshot taken"}
      </div>
      <div className="absolute inset-x-2.5 bottom-3 space-y-1">
        {checks.map((c, i) => {
          const state = phase < 2 ? "wait" : phase - 2 > i ? "ok" : phase - 2 === i ? "busy" : "wait";
          return (
            <div key={c} className={clsx("flex items-center gap-1.5 rounded-md bg-white/90 px-2 py-1 text-[9px] shadow-sm backdrop-blur transition-opacity", state === "wait" ? "opacity-40" : "opacity-100", state === "ok" ? "text-emerald-600" : "text-neutral-600")}>
              {state === "busy" ? <Loader2 size={9} className="animate-spin" /> : state === "ok" ? <Check size={9} /> : <span className="size-[9px] rounded-full border border-neutral-300" />} {c}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- 05 · Fix: the check fails on the screen, the fix is sent back, the screen passes ----

const FIX = [1600, 1700, 1300, 2000];
function Fix() {
  const phase = useScene(FIX);
  const fixed = phase >= 2;
  return (
    <div className="relative flex h-full flex-col px-2.5 py-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold text-neutral-900">Today</span>
        <span className={clsx("rounded-full px-1.5 py-0.5 font-mono text-[7.5px] transition-colors", phase === 3 ? "bg-emerald-500/15 text-emerald-700" : "bg-black/6 text-neutral-500")}>attempt {fixed ? 2 : 1}</span>
      </div>
      <div className="mt-2 space-y-1.5">
        {HABITS.map((h) => (
          <div key={h} className="rounded-lg bg-black/6 px-2 py-1.5 text-[10px] text-neutral-800">
            {h}
          </div>
        ))}
      </div>
      {/* The add button, measured by the check: too small, then the right size. */}
      <div className="relative ml-auto mr-1 mt-3 grid size-11 place-items-center">
        <span className={clsx("grid place-items-center rounded-full bg-spark-500 text-white shadow-md transition-all duration-700", fixed ? "size-11 text-[16px]" : "size-7 text-[12px]")}>+</span>
        <span
          className={clsx(
            "absolute rounded-full border-[1.5px] border-dashed transition-all duration-700",
            fixed ? "inset-0 border-emerald-500" : "inset-2 border-red-500",
            phase === 1 || phase === 2 ? "opacity-0" : "opacity-100",
          )}
        />
        <span className={clsx("absolute -left-9 top-1/2 -translate-y-1/2 rounded px-1 font-mono text-[7.5px] text-white transition-colors", fixed ? "bg-emerald-500" : "bg-red-500", phase === 1 || phase === 2 ? "opacity-0" : "opacity-100")}>
          {fixed ? "44×44" : "28×28"}
        </span>
      </div>
      {/* What the check says, and what the Builder changes. */}
      <div className="mt-auto">
        {phase === 0 && (
          <div className="hiw-pop flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-[9px] leading-snug text-red-700">
            <X size={10} className="mt-[1px] shrink-0" />
            <span>
              <b className="font-semibold">Touch target too small.</b> The add button is 28×28, it needs 44×44.
            </span>
          </div>
        )}
        {(phase === 1 || phase === 2) && (
          <div className="hiw-pop overflow-hidden rounded-lg border border-black/10 bg-[#0b0d12] font-mono text-[8px] leading-relaxed">
            <div className="flex items-center gap-1 border-b border-white/10 px-2 py-1 text-[7.5px] text-ink-400">
              <RotateCcw size={8} /> Builder · AddButton.tsx
            </div>
            <div className="bg-red-500/15 px-2 text-red-300">- {"<Fab size={28} />"}</div>
            <div className={clsx("bg-emerald-500/15 px-2 text-emerald-300 transition-opacity duration-300", phase === 2 ? "opacity-100" : "opacity-0")}>+ {"<Fab size={44} />"}</div>
          </div>
        )}
        {phase === 3 && (
          <div className="hiw-pop flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[9px] text-emerald-700">
            <Check size={10} className="shrink-0" />
            <span>
              <b className="font-semibold">Verified.</b> On to the next screen.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- 06 · Point and talk: click a row, say the change, see it ----

const POINT = [1300, 600, 2100, 700, 2300];
function Point() {
  const phase = useScene(POINT);
  const [done, setDone] = useState([true, false, false]);
  const [applied, setApplied] = useState<boolean | null>(null);
  const said = useTyped("Make this row bigger, in blue", phase === 2, 45);
  // The scene applies the change at its end; a tap on the button decides instead.
  const big = applied ?? phase === 4;
  return (
    <div className="relative h-full">
      <MiniApp done={done} highlight={phase >= 1 && !big ? 1 : undefined} big={big ? 1 : undefined} onTap={(i) => setDone((d) => d.map((x, j) => (j === i ? !x : x)))} />
      {phase === 0 && <MousePointer2 size={14} className="hiw-cursor pointer-events-none absolute fill-white text-black" />}
      {phase === 1 && <MousePointer2 size={14} className="pointer-events-none absolute left-[55%] top-[42%] fill-white text-black" />}
      <div className="absolute inset-x-2.5 bottom-3">
        <div className="mb-1.5 flex min-h-[26px] items-center gap-1.5 rounded-xl bg-black/8 px-2.5 py-1.5 text-[9.5px] text-neutral-600">
          <Mic size={10} className={clsx("shrink-0", phase === 2 ? "text-spark-500" : "text-neutral-400")} />
          {phase === 2 ? (
            <span>
              “{said}
              <Caret dark />
            </span>
          ) : phase >= 3 ? (
            "“Make this row bigger, in blue”"
          ) : (
            "Click something, then say what to change"
          )}
        </div>
        <button
          type="button"
          onClick={() => setApplied(!big)}
          className={clsx("flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl py-2 text-[10px] font-semibold text-white transition-all", big ? "bg-sky-500" : "bg-spark-500")}>
          {phase === 3 && applied === null ? (
            <>
              <Loader2 size={10} className="animate-spin" /> HabitRow.tsx:14
            </>
          ) : big ? (
            "Done · tap to undo"
          ) : (
            "Tap to apply"
          )}
        </button>
      </div>
    </div>
  );
}

// ---- 07 · Ship: on your phone, a real build, the stores ----

const SHIP = [2400, 3400, 2400];
function Ship() {
  const phase = useScene(SHIP);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-2.5 py-3 text-center">
      {phase === 0 && (
        <div className="hiw-pop flex flex-col items-center gap-2">
          <div className="relative overflow-hidden rounded-xl border border-black/10 bg-white p-2">
            <QRCodeSVG value="https://expo.dev" size={88} />
            <div className="hiw-scan pointer-events-none absolute inset-x-0 h-6 bg-gradient-to-b from-transparent via-spark-400/40 to-transparent" />
          </div>
          <p className="text-[10px] text-neutral-600">Scan with Expo Go</p>
        </div>
      )}
      {phase === 1 && (
        // The real app installing on the iPhone, like on iOS: the icon fills in, then appears.
        <div className="hiw-pop flex w-full flex-col items-center gap-1.5 text-neutral-900 [&_.text-ink-200]:text-neutral-900 [&_.text-sm]:text-[10.5px] [&_.text-sm]:font-semibold">
          <InstallIcon replay={0} label="MyApp" />
          <p className="text-[8.5px] text-neutral-500">Release build · on the iPhone</p>
        </div>
      )}
      {phase === 2 && (
        <div className="w-full space-y-1.5">
          {[
            { logo: <AppStoreLogo className="size-5" />, name: "TestFlight", note: "Build 12 uploaded" },
            { logo: <PlayStoreLogo className="size-5" />, name: "Google Play", note: "Internal testing" },
          ].map((s, i) => (
            <div key={s.name} className="hiw-pop flex items-center gap-2 rounded-xl border border-black/10 bg-white px-2.5 py-2 text-left shadow-sm" style={{ animationDelay: `${i * 350}ms` }}>
              {s.logo}
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold text-neutral-900">{s.name}</div>
                <div className="text-[8.5px] text-neutral-500">{s.note}</div>
              </div>
              <Check size={11} className="text-emerald-500" />
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-1.5 text-[9px]">
        <span className="rounded-full bg-black/8 px-2 py-0.5 text-neutral-600">Export .zip</span>
        <span className="rounded-full bg-black/8 px-2 py-0.5 text-neutral-600">Your code</span>
      </div>
    </div>
  );
}

const SCREENS = [Describe, Plan, Build, Look, Fix, Point, Ship];

/** What the pinned phone shows for the step being read, plus dots to jump between them. */
export function PhoneSteps() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const on = (e: Event) => setStep(Math.max(0, Math.min(SCREENS.length - 1, (e as CustomEvent<number>).detail)));
    addEventListener(STEP_EVENT, on);
    return () => removeEventListener(STEP_EVENT, on);
  }, []);
  const Screen = SCREENS[step];
  return (
    <div className="relative flex h-full flex-col text-left">
      <div key={step} className="hiw-pop min-h-0 flex-1 overflow-hidden pt-6">
        <Screen />
      </div>
      <div className="flex shrink-0 justify-center gap-1.5 pb-7 pt-2">
        {SCREENS.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Show step ${i + 1}`}
            onClick={() => setStep(i)}
            className={clsx("h-1.5 cursor-pointer rounded-full transition-all", i === step ? "w-4 bg-spark-400" : "w-1.5 bg-black/25 hover:bg-black/50")}
          />
        ))}
      </div>
    </div>
  );
}

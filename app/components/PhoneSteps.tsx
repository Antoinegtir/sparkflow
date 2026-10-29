"use client";

import clsx from "clsx";
import { Check, Mic, MousePointer2, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";

/** HowItWorks announces the step reaching the middle of the screen; the pinned phone shows it. */
export const STEP_EVENT = "sparkflow:hiw-step";

const HABITS = ["Read 20 pages", "Morning walk", "Drink water"];

function Describe() {
  const text = "A habit tracker with streaks and a weekly chart";
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((x) => (x >= text.length + 18 ? 0 : x + 1)), 55);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex h-full flex-col justify-end gap-3 p-3">
      <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-spark-500 px-3 py-2 text-[11px] leading-snug text-white">
        {text.slice(0, n)}
        <span className="ml-px inline-block h-3 w-px translate-y-0.5 animate-pulse bg-white" />
      </div>
      <div className="flex items-center gap-2 overflow-hidden rounded-full bg-black/8 px-3 py-2">
        <Mic size={12} className="shrink-0 text-spark-400" />
        {/* As many bars as fit: the wave stays inside the chip. */}
        <div className="flex h-4 min-w-0 flex-1 items-center gap-[3px] overflow-hidden">
          {Array.from({ length: 18 }, (_, i) => (
            <span key={i} className="hiw-wave w-[3px] shrink-0 rounded-full bg-spark-400/80" style={{ animationDelay: `${i * 70}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Plan() {
  const screens = ["Today", "Stats", "Habit", "Settings"];
  return (
    <div className="grid h-full grid-cols-2 content-center gap-2 p-3">
      {screens.map((s, i) => (
        <div key={s} className="hiw-pop rounded-xl border border-black/10 bg-black/5 p-2" style={{ animationDelay: `${i * 180}ms` }}>
          <div className="text-[10px] font-semibold text-neutral-900">{s}</div>
          <div className="mt-1.5 space-y-1">
            <div className="h-1 w-3/4 rounded bg-black/20" />
            <div className="h-1 w-1/2 rounded bg-black/15" />
            <div className="h-4 rounded bg-spark-500/30" />
          </div>
        </div>
      ))}
      <p className="col-span-2 mt-1 text-center text-[9.5px] text-neutral-500">4 screens · 11 acceptance criteria</p>
    </div>
  );
}

function Build() {
  const lines = ["<Screen>", '  <Header title="Today" />', "  <ProgressBar value={done} />", "  {habits.map((h) => (", "    <HabitRow habit={h} />", "  ))}", "</Screen>"];
  return (
    <div className="flex h-full flex-col justify-center p-3 font-mono text-[9px] leading-relaxed">
      {lines.map((l, i) => (
        <div key={i} className="hiw-type truncate whitespace-pre text-sky-700" style={{ animationDelay: `${i * 260}ms` }}>
          <span className="mr-2 text-neutral-400">{i + 1}</span>
          {l}
        </div>
      ))}
      <div className="hiw-pop mt-3 flex items-center gap-1.5 text-[9.5px] text-emerald-600" style={{ animationDelay: "2000ms" }}>
        <Check size={11} /> Type check passed · commit a1f3c9e
      </div>
    </div>
  );
}

/** A tiny Today screen; `done` toggles on tap, which the visitor can try. */
function MiniApp({ highlight, onTap, done }: { highlight?: number; onTap?: (i: number) => void; done: boolean[] }) {
  return (
    <div className="p-3">
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
              "flex w-full cursor-pointer items-center justify-between rounded-lg bg-black/6 px-2 py-1.5 text-left text-[10px] text-neutral-900 transition",
              highlight === i && "ring-2 ring-sky-400",
            )}>
            {h}
            <span className={clsx("grid size-3.5 place-items-center rounded-full border transition", done[i] ? "border-spark-500 bg-spark-500" : "border-black/30")}>
              {done[i] && <Check size={8} />}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Look() {
  const [done, setDone] = useState([true, false, false]);
  const checks = ["Header reads “Today”", "Three habit rows", "Progress bar"];
  return (
    <div className="relative h-full">
      <MiniApp done={done} onTap={(i) => setDone((d) => d.map((x, j) => (j === i ? !x : x)))} />
      <div className="hiw-scan pointer-events-none absolute inset-x-0 h-8 bg-gradient-to-b from-transparent via-sky-400/25 to-transparent" />
      <div className="absolute inset-x-3 bottom-3 space-y-1">
        {checks.map((c, i) => (
          <div key={c} className="hiw-pop flex items-center gap-1.5 rounded-md bg-white/85 shadow-sm px-2 py-1 text-[9px] text-emerald-600 backdrop-blur" style={{ animationDelay: `${600 + i * 400}ms` }}>
            <Check size={9} /> {c}
          </div>
        ))}
      </div>
    </div>
  );
}

function Fix() {
  const [fixed, setFixed] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setFixed((f) => !f), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-3 text-center">
      <div className={clsx("grid place-items-center rounded-lg bg-spark-500 text-[10px] text-white transition-all duration-500", fixed ? "size-11" : "size-7")}>+</div>
      <div className={clsx("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9.5px] transition-colors duration-500", fixed ? "bg-emerald-500/15 text-emerald-600" : "bg-red-500/15 text-red-600")}>
        {fixed ? <Check size={10} /> : <X size={10} />}
        {fixed ? "Touch target 44×44" : "Touch target 28×28 (needs 44)"}
      </div>
      <p className="text-[9px] text-neutral-500">{fixed ? "Verified, moving on" : "Sent back to the Builder…"}</p>
    </div>
  );
}

function Point() {
  const [blue, setBlue] = useState(false);
  return (
    <div className="relative h-full">
      <MiniApp done={[true, false, false]} highlight={1} />
      <MousePointer2 size={14} className="hiw-cursor absolute fill-white text-black" />
      <div className="absolute inset-x-3 bottom-3">
        <div className="mb-1.5 rounded-xl bg-black/8 px-2.5 py-1.5 text-[9.5px] text-neutral-600">“Make this row bigger, in blue”</div>
        <button
          type="button"
          onClick={() => setBlue((b) => !b)}
          className={clsx("w-full cursor-pointer rounded-xl py-2 text-[10px] font-semibold text-white transition-all", blue ? "bg-sky-500 py-3" : "bg-spark-500")}>
          {blue ? "Done · tap to undo" : "Tap to apply"}
        </button>
      </div>
    </div>
  );
}

function Ship() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
      <div className="rounded-xl border border-black/10 bg-white p-2">
        <QRCodeSVG value="https://expo.dev" size={92} />
      </div>
      <p className="text-[10px] text-neutral-600">Scan with Expo Go</p>
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
      <div key={step} className="hiw-pop min-h-0 flex-1 overflow-hidden px-1.5 pt-6">
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

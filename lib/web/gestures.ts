import { openHidStream, touch } from "./idb";

type Gesture = { stream: Awaited<ReturnType<typeof openHidStream>>; last: { x: number; y: number }; watchdog: ReturnType<typeof setTimeout> };
const g = globalThis as unknown as { __sparkflowGestures?: Map<string, Gesture> };
const gestures = (g.__sparkflowGestures ??= new Map());

const WATCHDOG_MS = 5000;

function arm(key: string, ges: Gesture) {
  clearTimeout(ges.watchdog);
  // If the client vanishes mid-gesture (its lift lost on the way), lift the finger: a finger left
  // down holds the screen and no other touch gets through.
  ges.watchdog = setTimeout(() => {
    if (gestures.get(key) !== ges) return;
    ges.stream.write(touch(ges.last.x, ges.last.y, "UP"));
    ges.stream.end();
    gestures.delete(key);
  }, WATCHDOG_MS);
}

/**
 * Live finger: one HID stream from touch-down to lift. Moves are repeated DOWN presses at new points, so iOS
 * sees a real velocity and scrolls with momentum.
 */
export async function gesture(udid: string, phase: "down" | "move" | "up", x: number, y: number, id = udid) {
  const key = `${udid}:${id}`;
  if (phase === "down") {
    const prev = gestures.get(key);
    if (prev) {
      prev.stream.write(touch(prev.last.x, prev.last.y, "UP"));
      prev.stream.end();
      clearTimeout(prev.watchdog);
    }
    const stream = await openHidStream(udid);
    const ges: Gesture = { stream, last: { x, y }, watchdog: setTimeout(() => {}, 0) };
    gestures.set(key, ges);
    stream.write(touch(x, y, "DOWN"));
    arm(key, ges);
    return;
  }
  const ges = gestures.get(key);
  if (!ges) return;
  ges.last = { x, y };
  if (phase === "move") {
    ges.stream.write(touch(x, y, "DOWN"));
    arm(key, ges);
  } else {
    ges.stream.write(touch(x, y, "UP"));
    ges.stream.end();
    clearTimeout(ges.watchdog);
    gestures.delete(key);
  }
}

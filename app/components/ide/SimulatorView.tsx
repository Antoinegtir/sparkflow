"use client";

import clsx from "clsx";
import type { SimFind } from "./LayoutTree";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSimDevice } from "@/lib/web/sim-device";
import { DevicePicker } from "./DevicePicker";
import { CupertinoSpinner as Spinner } from "./ui";

type Area = { x: number; y: number; width: number; height: number };
export type SimPick = { testId: string; text: string; area: Area };
type El = { type: string; label: string | null; id: string | null; frame: { x: number; y: number; width: number; height: number } } | null;

/**
 * Live iOS Simulator: MJPEG stream through idb (else 1 fps frames), touches and trackpad scrolling forwarded as
 * real finger gestures, two-way page sync with the IDE, an inspect layer and a frozen mode for captures.
 */
/**
 * Where an element is on the Simulator's screen (see /api/sim/[udid]/find). Not found: its nearest
 * parent that is, up to the whole screen, so a pick always outlines something.
 */
async function findOnScreen(udid: string, f: SimFind | undefined, wholeFallback = true, first = true): Promise<{ union: Area; frames: Area[] } | null> {
  if (!f || (f.whole && !first && !wholeFallback)) return null;
  if (f.whole || f.ids.length || f.texts.length) {
    const q = new URLSearchParams([...f.ids.map((v) => ["id", v]), ...f.texts.map((v) => ["text", v]), ...(f.whole ? [["whole", "1"]] : [])]);
    const found = await fetch(`/api/sim/${udid}/find?${q}`)
      .then((r) => r.json())
      .catch(() => null);
    if (found?.union) return found;
  }
  return findOnScreen(udid, f.fallback, wholeFallback, false);
}

export function SimulatorView({
  page,
  onPageChange,
  frozen,
  frozenLabel,
  inspect,
  onPick,
  highlights,
  selected,
}: {
  page?: { title: string; parent?: string } | null;
  onPageChange?: (p: { title: string; parent?: string; tab?: number }) => void;
  frozen?: boolean;
  frozenLabel?: string;
  inspect?: boolean;
  onPick?: (p: SimPick) => void;
  highlights?: { find: SimFind; each: boolean } | null;
  /** The elements in the prompt: a picked area (fractions of the screen) or what to find, outlined in blue. */
  selected?: { area?: Area; find?: SimFind }[];
}) {
  const { supported, device, loaded } = useSimDevice();
  const canvas = useRef<HTMLCanvasElement>(null);
  const seq = useRef(0);
  const painted = useRef(0);
  const pending = useRef<Blob | null>(null);
  const frozenRef = useRef(frozen);
  const shown = useRef<string | null>(null);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<{ el: NonNullable<El>; box: Area } | null>(null);
  const [boxes, setBoxes] = useState<Area[]>([]);
  const [selBoxes, setSelBoxes] = useState<Area[]>([]);
  const udid = device?.udid;
  const points = device?.points ?? null;

  frozenRef.current = frozen;

  const paint = useCallback(async (blob: Blob) => {
    if (frozenRef.current) {
      pending.current = blob;
      return;
    }
    const n = ++seq.current;
    const bmp = await createImageBitmap(blob).catch(() => null);
    // An older frame decoded late must never paint over a newer one.
    if (!bmp || n < painted.current) return bmp?.close();
    painted.current = n;
    const c = canvas.current;
    if (!c) return bmp.close();
    if (c.width !== bmp.width || c.height !== bmp.height) {
      c.width = bmp.width;
      c.height = bmp.height;
    }
    c.getContext("2d")!.drawImage(bmp, 0, 0);
    bmp.close();
  }, []);

  useEffect(() => {
    if (!frozen && pending.current) {
      void paint(pending.current);
      pending.current = null;
      shown.current = null;
    }
  }, [frozen, paint]);

  // Frames: MJPEG stream parsed client-side (newest frame only), or 1 fps polling.
  useEffect(() => {
    if (!udid) return;
    let alive = true;
    let ctrl: AbortController | null = null;
    // Through the Cloudflare tunnel a streamed body can be held back with nothing arriving: if the
    // stream gives no frame in time, switch to fetching screenshots back to back.
    let polling = false;
    const stream = async () => {
      while (alive) {
        if (document.hidden) {
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }
        if (!device?.stream || polling) {
          const r = await fetch(`/api/sim/${udid}/frame`, { cache: "no-store" }).catch(() => null);
          if (r?.ok) await paint(await r.blob());
          await new Promise((r) => setTimeout(r, polling ? 60 : 1000));
          continue;
        }
        ctrl = new AbortController();
        // The server writes the first boundary at once: no byte at all means the tunnel holds the
        // body back. (No frame alone means nothing: frames only come when the screen changes.)
        let got = false;
        const c = ctrl;
        const watchdog = setTimeout(() => {
          if (got) return;
          polling = true;
          c.abort();
        }, 2500);
        // Meanwhile one screenshot, so an idle screen shows up at once.
        void fetch(`/api/sim/${udid}/frame`, { cache: "no-store" })
          .then((r) => (r.ok ? r.blob() : null))
          .then((b) => {
            if (b && !got) void paint(b);
          })
          .catch(() => {});
        try {
          const res = await fetch(`/api/sim/${udid}/stream`, { signal: ctrl.signal });
          const reader = res.body!.getReader();
          let buf = new Uint8Array(0);
          for (;;) {
            const { value, done } = await reader.read();
            if (done || !alive) break;
            got = true;
            const next = new Uint8Array(buf.length + value.length);
            next.set(buf);
            next.set(value, buf.length);
            buf = next;
            let last: Uint8Array | null = null;
            for (;;) {
              let s = -1;
              for (let i = 0; i < buf.length - 1; i++) if (buf[i] === 0xff && buf[i + 1] === 0xd8) { s = i; break; }
              if (s < 0) break;
              let e = -1;
              for (let i = s + 2; i < buf.length - 1; i++) if (buf[i] === 0xff && buf[i + 1] === 0xd9) { e = i + 2; break; }
              if (e < 0) {
                buf = buf.slice(s);
                break;
              }
              last = buf.slice(s, e);
              buf = buf.slice(e);
            }
            if (last) void paint(new Blob([last as Uint8Array<ArrayBuffer>], { type: "image/jpeg" }));
          }
        } catch {}
        clearTimeout(watchdog);
        if (alive) await new Promise((r) => setTimeout(r, 500));
      }
    };
    void stream();
    return () => {
      alive = false;
      ctrl?.abort();
    };
  }, [udid, device?.stream, paint]);

  /** Client position → device points. */
  const toPoints = (clientX: number, clientY: number) => {
    const c = canvas.current!;
    const r = c.getBoundingClientRect();
    const w = points?.width ?? c.width / 3;
    const h = points?.height ?? c.height / 3;
    return { x: ((clientX - r.left) / r.width) * w, y: ((clientY - r.top) / r.height) * h, w, h, r };
  };

  // IDE → simulator page sync: the tab is tapped in plain view, the stream keeps showing the app.
  useEffect(() => {
    if (!udid || !page) return;
    const key = `${page.parent ?? ""}/${page.title}`;
    if (shown.current === key) return;
    shown.current = key;
    void fetch(`/api/sim/${udid}/tab`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(page) }).catch(() => {});
  }, [udid, page]);

  // Simulator → IDE: after each lift, ask which page is showing.
  const afterLift = useCallback(() => {
    if (!udid || !onPageChange) return;
    setTimeout(async () => {
      const r = await fetch(`/api/sim/${udid}/tab`).then((x) => x.json()).catch(() => null);
      const sel = r?.selected as { title: string; parent?: string; tab?: number } | null;
      if (!sel) return;
      const key = `${sel.parent ?? ""}/${sel.title}`;
      if (key === shown.current) return;
      shown.current = key;
      onPageChange(sel);
    }, 450);
  }, [udid, onPageChange]);

  // ---- touches ----
  // Live finger (idb): every gesture of this view goes through one ordered queue.
  const live = useRef<GestureSender | null>(null);
  if (udid && device?.stream && live.current?.udid !== udid) live.current = gestureSender(udid, () => afterLiftRef.current());
  const afterLiftRef = useRef(afterLift);
  afterLiftRef.current = afterLift;
  // Without idb: clicks and drags are replayed as a tap or a swipe on release.
  const down = useRef<{ x: number; y: number; px: number; py: number; t: number } | null>(null);
  const flash = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 3000);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!udid || frozen || inspect) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    const p = toPoints(e.clientX, e.clientY);
    const id = Date.now() + Math.random();
    setRipples((r) => [...r, { id, x: e.clientX - p.r.left, y: e.clientY - p.r.top }]);
    setTimeout(() => setRipples((r) => r.filter((x) => x.id !== id)), 500);
    if (live.current) return live.current.down(p);
    down.current = { x: p.x, y: p.y, px: e.clientX, py: e.clientY, t: performance.now() };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.buttons && live.current?.active) live.current.move(toPoints(e.clientX, e.clientY));
  };
  const onPointerUp = async (e: React.PointerEvent) => {
    if (live.current) return live.current.up(toPoints(e.clientX, e.clientY));
    const start = down.current;
    down.current = null;
    if (!start || !udid) return;
    const end = toPoints(e.clientX, e.clientY);
    const duration = (performance.now() - start.t) / 1000;
    const moved = Math.hypot(e.clientX - start.px, e.clientY - start.py) > 6;
    const body = moved ? { swipe: { x: start.x, y: start.y, x2: end.x, y2: end.y, duration: Math.max(0.1, duration) } } : { tap: { x: start.x, y: start.y, duration } };
    const r = await fetch(`/api/sim/${udid}/input`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    if (r && !r.ok) flash((await r.json().catch(() => ({}))).error ?? "Input failed");
    afterLift();
  };

  // Trackpad / mouse wheel → a finger dragging the content (both axes), in the same queue as the
  // touches. The finger lifts 120 ms after the last wheel event; if it would leave the screen it
  // lifts and starts again from where the scroll began. Native listener: the page behind must not scroll.
  const blocked = useRef(false);
  blocked.current = !!frozen || !!inspect;
  useEffect(() => {
    const el = canvas.current;
    const sender = live.current;
    if (!el || !sender) return;
    let wheel: { start: Pt; finger: Pt } | null = null;
    let lift: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (blocked.current) return;
      const p = toPoints(e.clientX, e.clientY);
      const k = p.w / p.r.width; // CSS px → device points
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? p.r.height : 1;
      if (!wheel) {
        // Keep clear of the status bar and the home-indicator edge.
        const start = { x: clamp(p.x, 30, p.w - 30), y: clamp(p.y, 90, p.h - 110) };
        wheel = { start, finger: { ...start } };
        sender.down(start);
      }
      const w = wheel;
      const next = { x: w.finger.x - e.deltaX * unit * k, y: w.finger.y - e.deltaY * unit * k };
      if (next.x < 10 || next.x > p.w - 10 || next.y < 40 || next.y > p.h - 40) {
        sender.up(w.finger);
        w.finger = { ...w.start };
        sender.down(w.start);
      } else {
        w.finger = next;
        sender.move(next);
      }
      clearTimeout(lift);
      lift = setTimeout(() => {
        if (wheel) sender.up(wheel.finger);
        wheel = null;
      }, 120);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      clearTimeout(lift);
      if (wheel) sender.up(wheel.finger);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [udid, device?.stream, loaded]);

  // ---- inspect layer ----
  const last = useRef(0);
  const onInspectMove = async (e: React.MouseEvent) => {
    if (!udid || Date.now() - last.current < 120) return;
    last.current = Date.now();
    const p = toPoints(e.clientX, e.clientY);
    const el: El = await fetch(`/api/sim/${udid}/element?x=${Math.round(p.x)}&y=${Math.round(p.y)}`).then((r) => r.json()).catch(() => null);
    // Unnamed big containers: fall back to a box around the pointer. A big image or a labelled element is itself.
    const named = !!el && (!!el.label || el.type === "Image" || el.type === "Button");
    if (!el || (!named && (el.frame.width * el.frame.height) / (p.w * p.h) > 0.35)) {
      const w = 180;
      const h = 150;
      const box = { x: Math.max(0, Math.min(p.w - w, p.x - w / 2)), y: Math.max(0, Math.min(p.h - h, p.y - h / 2)), width: w, height: h };
      setHover({ el: { type: "Area", label: null, id: null, frame: box }, box });
    } else setHover({ el, box: el.frame });
  };

  // Highlight elements hovered in the Layout tree.
  const hoverKey = JSON.stringify(highlights ?? null);
  useEffect(() => {
    if (!udid || !highlights) return setBoxes([]);
    let alive = true;
    // A hover that finds nothing better than the whole screen outlines nothing.
    void findOnScreen(udid, highlights.find, false).then((j) => alive && setBoxes(j ? (highlights.each ? j.frames : [j.union]) : []));
    return () => {
      alive = false;
    };
  }, [udid, hoverKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Outline the elements in the prompt: picked ones where they were picked, Layout ones by their texts.
  const selKey = JSON.stringify(selected ?? []);
  useEffect(() => {
    const list = selected ?? [];
    if (!udid || !points || !list.length) return setSelBoxes([]);
    let alive = true;
    void Promise.all(
      list.map(async (s): Promise<Area[]> => {
        if (s.area) return [{ x: s.area.x * points.width, y: s.area.y * points.height, width: s.area.width * points.width, height: s.area.height * points.height }];
        if (!s.find) return [];
        const j = await findOnScreen(udid, s.find);
        return j ? [j.union] : [];
      }),
    ).then((r) => alive && setSelBoxes(r.flat()));
    return () => {
      alive = false;
    };
  }, [udid, selKey, points?.width, points?.height]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loaded && !supported) return <Message text="The iOS Simulator needs macOS with Xcode; the Android emulator needs the Android SDK (adb)." />;
  if (loaded && !device)
    return (
      // Fits the phone's screen: the text wraps, the list takes the width and scrolls.
      <div className="flex h-full w-full min-w-0 flex-col gap-3 overflow-y-auto px-4 pt-14 pb-8 text-center">
        <p className="text-[12.5px] leading-snug text-ink-400">No simulator or emulator is running. Pick one to boot it: it shows up here once it's ready.</p>
        <DevicePicker inline />
      </div>
    );
  if (!loaded) return <Message text="Connecting to the simulator…" />;

  const pct = (b: Area) => ({ left: `${(b.x / (points?.width ?? 1)) * 100}%`, top: `${(b.y / (points?.height ?? 1)) * 100}%`, width: `${(b.width / (points?.width ?? 1)) * 100}%`, height: `${(b.height / (points?.height ?? 1)) * 100}%` });

  return (
    <div className="relative h-full w-full touch-none select-none bg-black">
      <canvas
        ref={canvas}
        className={clsx("h-full w-full object-fill", inspect ? "cursor-crosshair" : "cursor-pointer")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={(e) => live.current?.up(toPoints(e.clientX, e.clientY))}
        onMouseMove={inspect ? onInspectMove : undefined}
        onMouseLeave={() => setHover(null)}
        onClick={() => {
          if (!inspect || !hover || !onPick || !points) return;
          const b = hover.box;
          const el = hover.el;
          const testId = el.id || el.label?.split(",")[0]?.trim() || `${el.type} ${Math.round(b.width)}×${Math.round(b.height)}`;
          onPick({ testId, text: el.label ?? "", area: { x: b.x / points.width, y: b.y / points.height, width: b.width / points.width, height: b.height / points.height } });
        }}
      />
      {ripples.map((r) => (
        <span key={r.id} className="animate-tap pointer-events-none absolute size-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/50" style={{ left: r.x, top: r.y }} />
      ))}
      {inspect && hover && points && !selBoxes.some((b) => Math.abs(b.x - hover.box.x) < 2 && Math.abs(b.y - hover.box.y) < 2 && Math.abs(b.width - hover.box.width) < 2) && (
        <div className="pointer-events-none absolute rounded-md border-2 border-spark-400 bg-spark-500/10" style={pct(hover.box)}>
          <span className="absolute -top-5 left-0 rounded bg-spark-500 px-1.5 text-[10px] font-semibold whitespace-nowrap text-white">{hover.el.label || hover.el.type}</span>
        </div>
      )}
      {points &&
        boxes.map((b, i) => <div key={i} className="pointer-events-none absolute rounded-md border-2 border-spark-400 bg-spark-500/10" style={pct(b)} />)}
      {/* Selected: solid blue, above the lighter hover (an element just picked stays under the pointer). */}
      {points &&
        selBoxes.map((b, i) => <div key={`s${i}`} className="pointer-events-none absolute rounded-md border-2 border-spark-500 bg-spark-500/10" style={pct(b)} />)}
      {frozen && (
        <div className="absolute inset-0 grid place-items-center bg-black/30 backdrop-blur-md">
          <div className="flex flex-col items-center gap-3">
            <Spinner />
            <span className="text-[12px] font-medium text-white">{frozenLabel ?? "Capturing pages…"}</span>
          </div>
        </div>
      )}
      {error && <div className="absolute inset-x-3 bottom-3 rounded-lg bg-black/80 px-3 py-2 text-center text-[11.5px] text-white">{error}</div>}
    </div>
  );
}

function Message({ text }: { text: string }) {
  return <div className="grid h-full place-items-center p-6 text-center text-[12.5px] text-ink-400">{text}</div>;
}

type Pt = { x: number; y: number };
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

interface GestureSender {
  udid: string;
  readonly active: boolean;
  down(p: Pt): void;
  move(p: Pt): void;
  up(p: Pt): void;
}

/**
 * Sends live touch gestures to the server in order, one request at a time: a touch-down never
 * overtakes the lift before it, even through the tunnel. Moves are coalesced: while a request is
 * in flight only the latest pointer position is kept, so a fast drag never builds a backlog.
 */
function gestureSender(udid: string, onLift?: () => void): GestureSender {
  let queue: Promise<unknown> = Promise.resolve();
  let id: string | null = null;
  let pending: Pt | null = null;
  let scheduled = false;
  const post = (gid: string, phase: "down" | "move" | "up", p: Pt) =>
    fetch(`/api/sim/${udid}/gesture`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: gid, phase, x: p.x, y: p.y }),
      keepalive: phase === "up",
    }).catch(() => {});
  return {
    udid,
    get active() {
      return id !== null;
    },
    down(p) {
      const gid = Math.random().toString(36).slice(2, 10);
      id = gid;
      pending = null;
      queue = queue.then(() => post(gid, "down", p));
    },
    move(p) {
      if (!id) return;
      pending = p;
      if (scheduled) return;
      scheduled = true;
      const gid = id;
      queue = queue.then(async () => {
        scheduled = false;
        const q = pending;
        pending = null;
        if (q) await post(gid, "move", q);
      });
    },
    up(p) {
      if (!id) return;
      const gid = id;
      id = null;
      pending = null;
      queue = queue.then(() => post(gid, "up", p)).then(() => onLift?.());
    },
  };
}

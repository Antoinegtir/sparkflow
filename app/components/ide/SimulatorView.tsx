"use client";

import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSimDevice } from "@/lib/web/sim-device";
import { CupertinoSpinner as Spinner } from "./ui";

type Area = { x: number; y: number; width: number; height: number };
export type SimPick = { testId: string; text: string; area: Area };
type El = { type: string; label: string | null; id: string | null; frame: { x: number; y: number; width: number; height: number } } | null;

/**
 * Live iOS Simulator: MJPEG stream through idb (else 1 fps frames), touches and trackpad scrolling forwarded as
 * real finger gestures, two-way page sync with the IDE, an inspect layer and a frozen mode for captures.
 */
export function SimulatorView({
  page,
  onPageChange,
  frozen,
  frozenLabel,
  inspect,
  onPick,
  highlights,
}: {
  page?: { title: string; parent?: string } | null;
  onPageChange?: (p: { title: string; parent?: string }) => void;
  frozen?: boolean;
  frozenLabel?: string;
  inspect?: boolean;
  onPick?: (p: SimPick) => void;
  highlights?: { texts: string[]; each: boolean } | null;
}) {
  const { supported, device, loaded } = useSimDevice();
  const canvas = useRef<HTMLCanvasElement>(null);
  const seq = useRef(0);
  const painted = useRef(0);
  const pending = useRef<Blob | null>(null);
  const frozenRef = useRef(frozen);
  const [navigating, setNavigating] = useState(false);
  const navRef = useRef(false);
  const shown = useRef<string | null>(null);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<{ el: NonNullable<El>; box: Area } | null>(null);
  const [boxes, setBoxes] = useState<Area[]>([]);
  const udid = device?.udid;
  const points = device?.points ?? null;

  frozenRef.current = frozen;

  const paint = useCallback(async (blob: Blob) => {
    if (frozenRef.current || navRef.current) {
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
        let got = false;
        const c = ctrl;
        const watchdog = setTimeout(() => {
          if (got) return;
          polling = true;
          c.abort();
        }, 2500);
        try {
          const res = await fetch(`/api/sim/${udid}/stream`, { signal: ctrl.signal });
          const reader = res.body!.getReader();
          let buf = new Uint8Array(0);
          for (;;) {
            const { value, done } = await reader.read();
            if (done || !alive) break;
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
            if (last) {
              got = true;
              void paint(new Blob([last as Uint8Array<ArrayBuffer>], { type: "image/jpeg" }));
            }
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

  // IDE → simulator page sync, hidden behind a spinner so scripted taps are never shown.
  useEffect(() => {
    if (!udid || !page) return;
    const key = `${page.parent ?? ""}/${page.title}`;
    if (shown.current === key) return;
    shown.current = key;
    navRef.current = true;
    setNavigating(true);
    void fetch(`/api/sim/${udid}/tab`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(page) })
      .catch(() => {})
      .finally(() =>
        setTimeout(() => {
          navRef.current = false;
          setNavigating(false);
          if (pending.current) {
            void paint(pending.current);
            pending.current = null;
          }
        }, 350),
      );
  }, [udid, page, paint]);

  // Simulator → IDE: after each lift, ask which page is showing.
  const afterLift = useCallback(() => {
    if (!udid || !onPageChange) return;
    setTimeout(async () => {
      const r = await fetch(`/api/sim/${udid}/tab`).then((x) => x.json()).catch(() => null);
      const sel = r?.selected as { title: string; parent?: string } | null;
      if (!sel) return;
      const key = `${sel.parent ?? ""}/${sel.title}`;
      if (key === shown.current) return;
      shown.current = key;
      onPageChange(sel);
    }, 450);
  }, [udid, onPageChange]);

  // ---- touches ----
  const gesture = useRef<{ id: string; start: { x: number; y: number; t: number }; moved: boolean; inflight: boolean; queued: { x: number; y: number } | null } | null>(null);
  const sendGesture = async (phase: "down" | "move" | "up", x: number, y: number) => {
    const g = gesture.current;
    if (!g || !udid) return;
    await fetch(`/api/sim/${udid}/gesture`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: g.id, phase, x, y }), keepalive: phase === "up" }).catch(() => {});
  };
  const flash = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 3000);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!udid || frozen || inspect) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const p = toPoints(e.clientX, e.clientY);
    gesture.current = { id: Math.random().toString(36).slice(2), start: { x: p.x, y: p.y, t: Date.now() }, moved: false, inflight: false, queued: null };
    const id = Date.now();
    setRipples((r) => [...r, { id, x: e.clientX - p.r.left, y: e.clientY - p.r.top }]);
    setTimeout(() => setRipples((r) => r.filter((x) => x.id !== id)), 500);
    if (device?.stream) void sendGesture("down", p.x, p.y);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || !e.buttons) return;
    const p = toPoints(e.clientX, e.clientY);
    if (Math.hypot(p.x - g.start.x, p.y - g.start.y) > 2) g.moved = true;
    if (!device?.stream) return;
    // Coalesce: only the latest position is sent while a request is in flight.
    if (g.inflight) return void (g.queued = { x: p.x, y: p.y });
    g.inflight = true;
    void sendGesture("move", p.x, p.y).finally(() => {
      g.inflight = false;
      if (g.queued) {
        const q = g.queued;
        g.queued = null;
        void sendGesture("move", q.x, q.y);
      }
    });
  };
  const onPointerUp = async (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || !udid) return;
    gesture.current = null;
    const p = toPoints(e.clientX, e.clientY);
    if (device?.stream) await sendGesture("up", p.x, p.y);
    else {
      const duration = (Date.now() - g.start.t) / 1000;
      const moved = Math.hypot(p.x - g.start.x, p.y - g.start.y) > 6;
      const body = moved ? { swipe: { x: g.start.x, y: g.start.y, x2: p.x, y2: p.y, duration: Math.max(0.1, duration) } } : { tap: { x: p.x, y: p.y, duration } };
      const r = await fetch(`/api/sim/${udid}/input`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
      if (r && !r.ok) flash((await r.json().catch(() => ({}))).error ?? "Input failed");
    }
    afterLift();
  };

  // Trackpad / wheel → a finger drag on both axes, away from the status bar and home indicator.
  const wheel = useRef<{ id: string; x: number; y: number; sx: number; sy: number; timer?: ReturnType<typeof setTimeout> } | null>(null);
  const onWheel = (e: React.WheelEvent) => {
    if (!udid || frozen || inspect || !device?.stream) return;
    const p = toPoints(e.clientX, e.clientY);
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? p.r.height : 1;
    const scale = p.w / p.r.width;
    const dx = -e.deltaX * unit * scale;
    const dy = -e.deltaY * unit * scale;
    const clampX = (x: number) => Math.max(30, Math.min(p.w - 30, x));
    const clampY = (y: number) => Math.max(90, Math.min(p.h - 110, y));
    let w = wheel.current;
    const send = (phase: "down" | "move" | "up", x: number, y: number) =>
      fetch(`/api/sim/${udid}/gesture`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: w!.id, phase, x, y }) }).catch(() => {});
    if (!w) {
      const sx = clampX(p.x);
      const sy = clampY(p.y);
      w = wheel.current = { id: Math.random().toString(36).slice(2), x: sx, y: sy, sx, sy };
      void send("down", sx, sy);
    }
    let nx = w.x + dx;
    let ny = w.y + dy;
    if (nx < 5 || nx > p.w - 5 || ny < 40 || ny > p.h - 40) {
      // Re-grip: lift and start again from where the gesture began.
      void send("up", w.x, w.y);
      w.id = Math.random().toString(36).slice(2);
      nx = w.sx + dx;
      ny = w.sy + dy;
      void send("down", w.sx, w.sy);
    }
    w.x = nx;
    w.y = ny;
    void send("move", nx, ny);
    clearTimeout(w.timer);
    w.timer = setTimeout(() => {
      const cur = wheel.current;
      wheel.current = null;
      if (cur) void send("up", cur.x, cur.y).then(afterLift);
    }, 120);
  };

  // ---- inspect layer ----
  const last = useRef(0);
  const onInspectMove = async (e: React.MouseEvent) => {
    if (!udid || Date.now() - last.current < 120) return;
    last.current = Date.now();
    const p = toPoints(e.clientX, e.clientY);
    const el: El = await fetch(`/api/sim/${udid}/element?x=${Math.round(p.x)}&y=${Math.round(p.y)}`).then((r) => r.json()).catch(() => null);
    // Images and custom views come back as big containers: fall back to a box around the pointer.
    if (!el || (el.frame.width * el.frame.height) / (p.w * p.h) > 0.35) {
      const w = 180;
      const h = 150;
      const box = { x: Math.max(0, Math.min(p.w - w, p.x - w / 2)), y: Math.max(0, Math.min(p.h - h, p.y - h / 2)), width: w, height: h };
      setHover({ el: { type: "Area", label: null, id: null, frame: box }, box });
    } else setHover({ el, box: el.frame });
  };

  // Highlight elements hovered in the Layout tree.
  useEffect(() => {
    if (!udid || !highlights?.texts.length) return setBoxes([]);
    const q = highlights.texts.map((t) => `text=${encodeURIComponent(t)}`).join("&");
    fetch(`/api/sim/${udid}/find?${q}`)
      .then((r) => r.json())
      .then((j) => setBoxes(j?.frames ? (highlights.each ? j.frames : [j.union]) : []))
      .catch(() => setBoxes([]));
  }, [udid, highlights]);

  if (loaded && !supported) return <Message text="The iOS Simulator needs macOS with Xcode." />;
  if (loaded && !device) return <Message text="No simulator is booted. Run `npx expo run:ios` in your project, then come back." />;
  if (!loaded) return <Message text="Connecting to the simulator…" />;

  const pct = (b: Area) => ({ left: `${(b.x / (points?.width ?? 1)) * 100}%`, top: `${(b.y / (points?.height ?? 1)) * 100}%`, width: `${(b.width / (points?.width ?? 1)) * 100}%`, height: `${(b.height / (points?.height ?? 1)) * 100}%` });

  return (
    <div className="relative h-full w-full touch-none select-none bg-black" onWheel={onWheel}>
      <canvas
        ref={canvas}
        className={clsx("h-full w-full object-contain", inspect ? "cursor-crosshair" : "cursor-pointer")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
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
      {inspect && hover && points && (
        <div className="pointer-events-none absolute rounded-md border-2 border-violet-500 bg-violet-500/10" style={pct(hover.box)}>
          <span className="absolute -top-5 left-0 rounded bg-violet-500 px-1.5 text-[10px] font-semibold whitespace-nowrap text-white">{hover.el.label || hover.el.type}</span>
        </div>
      )}
      {points &&
        boxes.map((b, i) => <div key={i} className="pointer-events-none absolute rounded-md border-2 border-violet-500 bg-violet-500/10" style={pct(b)} />)}
      {(frozen || navigating) && (
        <div className="absolute inset-0 grid place-items-center bg-black/30 backdrop-blur-md">
          <div className="flex flex-col items-center gap-3">
            <Spinner />
            {frozen && <span className="text-[12px] font-medium text-white">{frozenLabel ?? "Capturing pages…"}</span>}
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

import * as android from "./android";
import { videoStream } from "./idb";

type Listener = (jpeg: Buffer) => void;
type Broadcast = { listeners: Set<Listener>; last: Buffer | null; stop?: () => void; idle?: ReturnType<typeof setTimeout>; starting: boolean };

const g = globalThis as unknown as { __sparkflowScreens?: Map<string, Broadcast> };
const screens = (g.__sparkflowScreens ??= new Map());

const SOI = Buffer.from([0xff, 0xd8]);
const EOI = Buffer.from([0xff, 0xd9]);

/**
 * One idb video stream per simulator, shared by every viewer: idb serves a single stream at a time and a second
 * one silently ends the first. fps 0 means frames only when the screen changes; the last frame is replayed to
 * new viewers. Restarts on end while someone watches; stops 3 s after the last viewer leaves.
 */
export function subscribeScreen(udid: string, listener: Listener) {
  let b = screens.get(udid);
  if (!b) {
    b = { listeners: new Set(), last: null, starting: false };
    screens.set(udid, b);
  }
  clearTimeout(b.idle);
  b.listeners.add(listener);
  if (b.last) listener(b.last);
  if (!b.stop && !b.starting) start(udid, b);
  return () => {
    b!.listeners.delete(listener);
    if (!b!.listeners.size) {
      b!.idle = setTimeout(() => {
        if (b!.listeners.size) return;
        b!.stop?.();
        b!.stop = undefined;
        b!.last = null;
        screens.delete(udid);
      }, 3000);
    }
  };
}

/** Android: the emulator's video stream, or screenshots back to back (sent only when the screen changed) without ffmpeg. */
function android_(udid: string, b: Broadcast) {
  b.starting = true;
  const send = (jpeg: Buffer) => {
    b.last = jpeg;
    for (const l of b.listeners) l(jpeg);
  };
  void android
    .videoFrames(udid, send)
    .catch(() => null)
    .then((stop) => {
      b.starting = false;
      // Everyone left while it was starting.
      if (stop && screens.get(udid) !== b) return stop();
      if (!stop) return poll(udid, b);
      b.stop = stop;
      // The video only has frames when the screen changes: a still screen starts from a screenshot.
      void android.frame(udid, "jpeg").then((jpeg) => !b.last && send(jpeg), () => {});
    });
}

function poll(udid: string, b: Broadcast) {
  let ended = false;
  b.stop = () => void (ended = true);
  void (async () => {
    while (!ended) {
      const jpeg = await android.frame(udid, "jpeg").catch(() => null);
      if (ended) break;
      if (jpeg && !b.last?.equals(jpeg)) {
        b.last = jpeg;
        for (const l of b.listeners) l(jpeg);
      }
      await new Promise((r) => setTimeout(r, jpeg ? 120 : 1000));
    }
  })();
}

function start(udid: string, b: Broadcast) {
  if (android.isAndroidId(udid)) return android_(udid, b);
  b.starting = true;
  void videoStream(udid)
    .then((call) => {
      b.starting = false;
      let buf = Buffer.alloc(0);
      let ended = false;
      b.stop = () => {
        ended = true;
        try {
          call.write({ stop: {} });
          call.end();
          call.cancel();
        } catch {}
      };
      call.on("data", (msg) => {
        const data = msg.payload?.data;
        if (!data) return;
        buf = Buffer.concat([buf, data]);
        for (;;) {
          const s = buf.indexOf(SOI);
          if (s < 0) break;
          const e = buf.indexOf(EOI, s + 2);
          if (e < 0) {
            buf = buf.subarray(s);
            break;
          }
          const frame = Buffer.from(buf.subarray(s, e + 2));
          buf = buf.subarray(e + 2);
          b.last = frame;
          for (const l of b.listeners) l(frame);
        }
      });
      const restart = (ms: number) => {
        if (ended) return;
        ended = true;
        b.stop = undefined;
        if (b.listeners.size) setTimeout(() => !b.stop && start(udid, b), ms);
      };
      call.on("end", () => restart(300));
      call.on("error", () => restart(1000));
    })
    .catch(() => {
      b.starting = false;
      if (b.listeners.size) setTimeout(() => start(udid, b), 1000);
    });
}

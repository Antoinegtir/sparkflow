import { subscribeScreen } from "@/lib/web/screen-stream";
import { errorResponse, type RouteCtx } from "@/lib/web/server";
import { assertUdid } from "@/lib/web/simulator";

export const dynamic = "force-dynamic";

/** MJPEG over multipart/x-mixed-replace. The boundary follows each frame: otherwise the browser waits for the next one, which never comes on an idle screen. */
export async function GET(req: Request, { params }: RouteCtx<{ udid: string }>) {
  let udid: string;
  try {
    udid = assertUdid((await params).udid);
  } catch (err) {
    return errorResponse(err);
  }
  let unsubscribe = () => {};
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("--sfframe\r\n"));
      unsubscribe = subscribeScreen(udid, (jpeg) => {
        try {
          controller.enqueue(new TextEncoder().encode(`Content-Type: image/jpeg\r\nContent-Length: ${jpeg.length}\r\n\r\n`));
          controller.enqueue(new Uint8Array(jpeg));
          controller.enqueue(new TextEncoder().encode("\r\n--sfframe\r\n"));
        } catch {}
      });
      req.signal.addEventListener("abort", () => {
        unsubscribe();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      unsubscribe();
    },
  });
  return new Response(stream, { headers: { "content-type": "multipart/x-mixed-replace; boundary=sfframe", "cache-control": "no-store" } });
}

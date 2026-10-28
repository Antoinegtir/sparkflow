import { z } from "zod";
import { errorResponse, type RouteCtx } from "@/lib/web/server";
import { noteTap } from "@/lib/web/native-tabs";
import { assertUdid, sendInput } from "@/lib/web/simulator";

export const dynamic = "force-dynamic";

const Input = z.union([
  z.object({ tap: z.object({ x: z.number(), y: z.number(), duration: z.number().optional() }) }),
  z.object({ swipe: z.object({ x: z.number(), y: z.number(), x2: z.number(), y2: z.number(), duration: z.number().optional() }) }),
  z.object({ text: z.string().max(500) }),
]);

export async function POST(req: Request, { params }: RouteCtx<{ udid: string }>) {
  try {
    const udid = assertUdid((await params).udid);
    const input = Input.parse(await req.json());
    await sendInput(udid, input);
    if ("tap" in input) noteTap(udid, input.tap.x, input.tap.y);
    return Response.json({ ok: true });
  } catch (err) {
    if ((err as { status?: number }).status === 501) return Response.json({ error: (err as Error).message }, { status: 501 });
    return errorResponse(err);
  }
}

import { handle, orchestrator, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request, { params }: RouteCtx) => {
  const { device, scheme } = (await req.json()) as { device?: string; scheme?: string };
  if (!device) return Response.json({ error: "device is required" }, { status: 400 });
  return Response.json({ captured: await orchestrator().captureDevice((await params).id, device, scheme === "dark") });
});

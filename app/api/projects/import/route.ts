import { z } from "zod";
import { handle, orchestrator } from "@/lib/web/server";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  const { dir } = z.object({ dir: z.string().min(1) }).parse(await req.json());
  return Response.json(await orchestrator().importNative(dir), { status: 201 });
});

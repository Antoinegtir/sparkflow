import { z } from "zod";
import { currentPage, goToTab, openSubPage } from "@/lib/web/native-tabs";
import { assertUdid } from "@/lib/web/simulator";
import { handle, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, { params }: RouteCtx<{ udid: string }>) => Response.json({ selected: await currentPage(assertUdid((await params).udid)).catch(() => null) }));

export const POST = handle(async (req: Request, { params }: RouteCtx<{ udid: string }>) => {
  const udid = assertUdid((await params).udid);
  const { title, parent } = z.object({ title: z.string(), parent: z.string().optional() }).parse(await req.json());
  const found = parent ? await openSubPage(udid, parent, title) : await goToTab(udid, title);
  return Response.json({ found });
});

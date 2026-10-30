import { z } from "zod";
import { currentPage, goToTab, openSubPage } from "@/lib/web/native-tabs";
import { assertUdid } from "@/lib/web/simulator";
import { bestRoute, idsIn, visibleIds } from "@/lib/web/page-match";
import { handle, orchestrator, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

/**
 * The page on screen. With `project`, a generated app's page is also told by its content (the testIDs
 * on screen against each page's file): `route` is then the page itself, whatever its tab is called.
 */
export const GET = handle(async (req: Request, { params }: RouteCtx<{ udid: string }>) => {
  const udid = assertUdid((await params).udid);
  const project = new URL(req.url).searchParams.get("project");
  const [selected, route] = await Promise.all([currentPage(udid).catch(() => null), project ? routeOnScreen(udid, project).catch(() => null) : null]);
  return Response.json({ selected, route });
});

async function routeOnScreen(udid: string, project: string) {
  const o = orchestrator();
  const state = await o.getState(project);
  if (state.native) return null;
  const pages = await Promise.all(
    state.order
      .map((r) => state.screens[r])
      .filter((s) => s?.file)
      .map(async (s) => ({ route: s.route, ids: idsIn(await o.readProjectFile(project, s.file).catch(() => "")) })),
  );
  return bestRoute(await visibleIds(udid), pages);
}

export const POST = handle(async (req: Request, { params }: RouteCtx<{ udid: string }>) => {
  const udid = assertUdid((await params).udid);
  const { title, parent, tab } = z.object({ title: z.string(), parent: z.string().optional(), tab: z.number().optional() }).parse(await req.json());
  const found = parent ? await openSubPage(udid, parent, title) : await goToTab(udid, title, tab);
  return Response.json({ found });
});

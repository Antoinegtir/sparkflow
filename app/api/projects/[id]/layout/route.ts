import { handle, orchestrator, type RouteCtx } from "@/lib/web/server";
import { parseJsx, type ScreenDecl } from "@/lib/web/jsx-tree";

export const dynamic = "force-dynamic";

const CODE = /\.(tsx|jsx|ts|js)$/;
const SKIP = /^(ios|android|node_modules|scripts|\.expo)\//;

/** Component tree of a page's file. Native pages: the file that declares the component behind <X.Screen name=title>. */
export const GET = handle(async (req: Request, { params }: RouteCtx) => {
  const { id } = await params;
  const url = new URL(req.url);
  const o = orchestrator();
  const state = await o.getState(id);
  const route = url.searchParams.get("route");
  let file = url.searchParams.get("file");
  let component: string | null = null;

  if (!file && route) {
    const screen = state.screens[route];
    if (!state.native) {
      file = screen?.file ?? null;
    } else if (screen) {
      const files = (await o.listProjectFiles(id)).filter((f) => CODE.test(f) && !SKIP.test(f)).slice(0, 120);
      const parsed = await Promise.all(files.map(async (f) => ({ f, ...parseJsx(await o.readProjectFile(id, f).catch(() => ""), f) })));
      const allDecls = parsed.flatMap((p) => p.screens.map((s) => ({ ...s, f: p.f })));
      let decl: (ScreenDecl & { f: string }) | undefined = allDecls.find((s) => s.name.toLowerCase() === screen.title.toLowerCase());
      // A tab that is itself a stack: follow into its first nested screen, at most 3 hops.
      for (let hop = 0; decl && hop < 3; hop++) {
        const owner = parsed.find((p) => p.components.some((c) => c.name === decl!.component));
        const nested = owner?.screens[0];
        if (!owner || !nested || nested.component === decl.component) break;
        decl = { ...nested, f: owner.f };
      }
      if (decl) {
        component = decl.component;
        file = parsed.find((p) => p.components.some((c) => c.name === decl!.component))?.f ?? null;
      }
      file ??= files.find((f) => /^App\.(tsx|jsx)$/.test(f)) ?? null;
    }
  }
  if (!file) return Response.json({ file: null, component: null, components: [], screens: [] });
  const source = await o.readProjectFile(id, file);
  const { components, screens, defaultName } = parseJsx(source, file);
  // Generated pages: the page component is the file's default export, else its first capitalized one
  // (a helper like TripCard can come before the page).
  if (!component && !state.native) component = components.find((c) => c.name === defaultName)?.name ?? components.find((c) => /^[A-Z]/.test(c.name))?.name ?? null;
  return Response.json({ file, component, components, screens });
});

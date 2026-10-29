import { z } from "zod";
import { handle, orchestrator, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colors are #RRGGBB");
const Settings = z.object({
  name: z.string().trim().min(1, "The app needs a name").max(60),
  version: z.string().regex(/^\d+(\.\d+){0,2}$/, "Version like 1.0.0"),
  bundleIdentifier: z.string().regex(/^[A-Za-z][\w-]*(\.[A-Za-z][\w-]*)+$/, "Bundle ID like com.company.app"),
  androidPackage: z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, "Package like com.company.app (lowercase)"),
  orientation: z.enum(["portrait", "landscape", "default"]),
  appearance: z.enum(["automatic", "light", "dark"]),
  splashBackground: hex,
  iconBackground: hex,
});

export const GET = handle(async (_req: Request, { params }: RouteCtx) => Response.json(await orchestrator().appSettings((await params).id)));

/** Form data: `settings` (JSON) and optional `icon` / `splash` images. */
export const POST = handle(async (req: Request, { params }: RouteCtx) => {
  const form = await req.formData();
  const parsed = Settings.safeParse(JSON.parse(String(form.get("settings") ?? "{}")));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid settings" }, { status: 400 });
  const file = async (k: string) => {
    const f = form.get(k);
    if (!f || typeof f === "string") return undefined;
    if (f.size > 15 * 1024 * 1024) throw new Error("Images are limited to 15 MB");
    return Buffer.from(await f.arrayBuffer());
  };
  await orchestrator().updateAppSettings((await params).id, parsed.data, { icon: await file("icon"), splash: await file("splash") });
  return Response.json({ ok: true });
});

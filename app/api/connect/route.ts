import { readFile, writeFile } from "node:fs/promises";

export const dynamic = "force-dynamic";

/**
 * The tunnel address and token of the running `sparkflow`, for the hosted site open in a browser on
 * this same computer (it polls http://localhost:3002/api/connect while you start it). Only answered
 * to requests made from this machine: through the tunnel (cf-connecting-ip) it doesn't exist.
 * Readable cross-origin only by the allowed sites (proxy.ts).
 */
export async function GET(req: Request) {
  if (req.headers.has("cf-connecting-ip")) return new Response(null, { status: 404 });
  const file = process.env.SPARKFLOW_CONNECTION;
  const data = file ? await readFile(file, "utf8").catch(() => null) : null;
  if (!data) return Response.json({ error: "Not connected yet" }, { status: 503 });
  // An open Sparkflow tab picked up the link: `sparkflow` then doesn't open a second one.
  await writeFile(`${file}.claimed`, "").catch(() => {});
  return new Response(data, { headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

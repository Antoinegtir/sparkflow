import { z } from "zod";
import type { Person } from "@/lib/shared/share";
import { requireOwner } from "@/lib/share/actor";
import { readProof, setOwner } from "@/lib/share/firebase";
import { handle } from "@/lib/web/server";

export const dynamic = "force-dynamic";

/** The owner's own name and avatar, taken from a signed-in proof, never from the request body. */
export const POST = handle(async (req: Request) => {
  requireOwner(req);
  const { proof } = z.object({ proof: z.string().regex(/^[A-Za-z0-9_-]{22,64}$/) }).parse(await req.json());
  const ident = await readProof(proof).catch(() => null);
  if (!ident) return Response.json({ error: "Sign-in could not be verified", code: "proof" }, { status: 401 });
  const o = await setOwner(ident);
  // Only the public part: the owner's uid and email stay on this Mac.
  const out: Person = { name: o.name, avatar: o.avatar, ...(o.gh ? { gh: o.gh } : {}), role: "owner" };
  return Response.json(out);
});

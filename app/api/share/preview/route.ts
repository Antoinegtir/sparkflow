import { clientKey, rateLimiter } from "@/lib/share/limit";
import { z } from "zod";
import type { PreviewResult } from "@/lib/shared/share";
import { readOwner } from "@/lib/share/firebase";
import { previewInvite } from "@/lib/share/store";
import { handle, orchestrator } from "@/lib/web/server";

export const dynamic = "force-dynamic";

// Public route: a small per-IP limit so invite secrets can't be guessed in bulk.
const limited = rateLimiter(10);

/** What an invite opens (project name, owner, role), shown before the guest joins. */
export const POST = handle(async (req: Request) => {
  if (limited(clientKey(req))) return Response.json({ error: "Too many requests" }, { status: 429 });
  const { invite } = z.object({ invite: z.string().max(200) }).parse(await req.json());
  const found = await previewInvite(invite);
  if (!found) return Response.json({ error: "Invite not found" }, { status: 404 });
  const state = await orchestrator().getState(found.projectId);
  const o = readOwner(found.projectId);
  const out: PreviewResult = { projectName: state.name, owner: o ? { name: o.name, avatar: o.avatar, ...(o.gh ? { gh: o.gh } : {}), role: "owner" } : null, role: found.role };
  return Response.json(out);
});

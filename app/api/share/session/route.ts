import { clientKey, rateLimiter } from "@/lib/share/limit";
import { z } from "zod";
import { appSlugs } from "@/lib/shared/slug";
import { ERR, type JoinResult } from "@/lib/shared/share";
import { readOwner } from "@/lib/share/firebase";
import { identify, PROOF } from "@/lib/share/identify";
import { findMember, issueKey } from "@/lib/share/store";
import { handle, orchestrator } from "@/lib/web/server";

export const dynamic = "force-dynamic";

// Public route: 10/min per IP and per uid.
const limited = rateLimiter(10);
const tooMany = () => Response.json({ error: "Too many requests" }, { status: 429 });

/** A new key for an existing member (another device, or a key that expired), proven by a Firestore proof. */
export const POST = handle(async (req: Request) => {
  if (limited(clientKey(req))) return tooMany();
  const body = z.object({ projectId: z.string().max(80), ...PROOF }).parse(await req.json());
  const ident = await identify(body);
  if (!ident) return Response.json({ error: "Sign-in could not be verified", code: "proof" }, { status: 401 });
  if (limited(`uid:${ident.uid}`)) return tooMany();
  const member = await findMember(body.projectId, ident.uid);
  if (!member || member.revokedAt) return Response.json({ error: "You don't have access to this project", code: ERR.notMember }, { status: 403 });
  const key = await issueKey(body.projectId, ident.uid);
  const state = await orchestrator().getState(body.projectId);
  const o = readOwner(body.projectId);
  const out: JoinResult = {
    key,
    projectId: body.projectId,
    slug: appSlugs(await orchestrator().listProjects()).get(body.projectId) ?? body.projectId,
    name: state.name,
    role: member.role,
    me: ident.uid,
    owner: o ? { name: o.name, avatar: o.avatar, ...(o.gh ? { gh: o.gh } : {}), role: "owner" } : { name: "Owner", avatar: null, role: "owner" },
  };
  return Response.json(out);
});

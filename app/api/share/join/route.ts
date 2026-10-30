import { clientKey, rateLimiter } from "@/lib/share/limit";
import { z } from "zod";
import { appSlugs } from "@/lib/shared/slug";
import type { JoinResult, Person } from "@/lib/shared/share";
import { readOwner, readProof, type ProofIdentity } from "@/lib/share/firebase";
import { issueKey, redeemInvite } from "@/lib/share/store";
import { handle, orchestrator } from "@/lib/web/server";

export const dynamic = "force-dynamic";

// Public route: 10/min per IP and per uid, so one account can't hammer invites from many IPs.
const limited = rateLimiter(10);
const tooMany = () => Response.json({ error: "Too many requests" }, { status: 429 });

const slugOf = async (id: string) => appSlugs(await orchestrator().listProjects()).get(id) ?? id;
const ownerPerson = async (): Promise<Person> => {
  const o = readOwner();
  return o ? { name: o.name, avatar: o.avatar, ...(o.gh ? { gh: o.gh } : {}), role: "owner" } : { name: "Owner", avatar: null, role: "owner" };
};

/** Redeems an invite for the guest proven by a Firestore proof, and hands back a key for this project. */
export const POST = handle(async (req: Request) => {
  if (limited(clientKey(req))) return tooMany();
  const body = z.object({ invite: z.string().max(200), proof: z.string().regex(/^[A-Za-z0-9_-]{22,64}$/) }).parse(await req.json());
  let ident: ProofIdentity;
  try {
    ident = await readProof(body.proof);
  } catch {
    return Response.json({ error: "Sign-in could not be verified", code: "proof" }, { status: 401 });
  }
  if (limited(`uid:${ident.uid}`)) return tooMany();
  const r = await redeemInvite(body.invite, ident);
  // A new member can read the project's cloud copy (its pages while this Mac is off).
  if (!("error" in r) && !("owner" in r)) orchestrator().cloudSync(r.projectId);
  if ("error" in r) return Response.json({ error: "This invite no longer works", code: r.error }, { status: 410 });
  if ("owner" in r) {
    // The owner opened their own link: send them to the project itself.
    return Response.json({ owner: true, slug: await slugOf(r.projectId) }, { status: 409 });
  }
  const key = await issueKey(r.projectId, ident.uid);
  const state = await orchestrator().getState(r.projectId);
  const out: JoinResult = { key, projectId: r.projectId, slug: await slugOf(r.projectId), name: state.name, role: r.role, me: ident.uid, owner: await ownerPerson() };
  return Response.json(out);
});

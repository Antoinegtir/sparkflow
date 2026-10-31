import { z } from "zod";
import { CLOUD } from "@/lib/cloud/mode";
import { identityFromIdToken } from "@/lib/cloud/identity";
import { readProof, type ProofIdentity } from "./firebase";

/**
 * How a guest proves who they are: on a Mac, a one-time Firestore proof only that Mac can read; in the
 * cloud (no Firebase account of its own), their ID token, checked with Firebase.
 */
export const PROOF = {
  proof: z.string().regex(/^[A-Za-z0-9_-]{22,64}$/).optional(),
  idToken: z.string().min(20).max(4000).optional(),
};

export async function identify(body: { proof?: string; idToken?: string }): Promise<ProofIdentity | null> {
  if (CLOUD) return body.idToken ? identityFromIdToken(body.idToken) : null;
  if (!body.proof) return null;
  return readProof(body.proof).catch(() => null);
}

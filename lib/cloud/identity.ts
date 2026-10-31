import { FIREBASE_CONFIG } from "@/lib/shared/firebase-config";
import type { ProofIdentity } from "@/lib/share/firebase";

/**
 * Who a Firebase ID token belongs to, asked to Firebase itself (accounts:lookup), never trusted as sent.
 * A real account only (GitHub or Google). In the cloud this replaces the Mac's Firestore proofs.
 */
export async function identityFromIdToken(idToken: string): Promise<(ProofIdentity & { avatar?: string }) | null> {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_CONFIG.apiKey}`, {
    method: "POST",
    headers: { "content-type": "application/json", Referer: "https://sparkflow-ai.web.app/" },
    body: JSON.stringify({ idToken }),
  }).catch(() => null);
  const user = res?.ok ? (await res.json()).users?.[0] : null;
  const providers: { providerId: string; rawId?: string }[] = user?.providerUserInfo ?? [];
  if (!user?.localId || !providers.some((p) => p.providerId === "github.com" || p.providerId === "google.com")) return null;
  return {
    uid: user.localId,
    gh: providers.find((p) => p.providerId === "github.com")?.rawId ?? "",
    email: user.email ?? "",
    ...(user.displayName ? { name: String(user.displayName).slice(0, 80) } : {}),
    ...(user.photoUrl ? { avatar: String(user.photoUrl) } : {}),
  };
}

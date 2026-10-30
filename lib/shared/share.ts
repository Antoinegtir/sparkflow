import { z } from "zod";

/** Sharing a project with other people: roles, the people shown on avatars, and the API shapes. */
export type Role = "edit" | "comment" | "view";
export type AnyRole = Role | "owner";

export interface Person {
  name: string;
  avatar: string | null;
  gh?: string;
  role: AnyRole;
  /** Removed from the project; kept so their old comments still show a face. */
  former?: true;
}

export interface Access {
  role: AnyRole;
  /** "owner" | uid */
  me: string;
  projectId: string;
  /** Key "owner" | uid */
  people: Record<string, Person>;
  sharing: boolean;
}

export const BoardOpSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("text"), item: z.any() }),
  z.object({ op: z.literal("group"), item: z.any() }),
  z.object({
    op: z.literal("comment"),
    item: z.object({ id: z.string(), x: z.number(), y: z.number(), text: z.string().max(4000), route: z.string().optional(), sent: z.boolean().optional() }).strict(),
  }),
  z.object({ op: z.literal("remove"), id: z.string() }),
]);
/** At most 50 per POST. */
export type BoardOp = z.infer<typeof BoardOpSchema>;
export const MAX_BOARD_OPS = 50;

export interface SharedEntry {
  serverUid: string;
  projectId: string;
  key: string | null;
  uid: string;
  role: Role;
  name: string;
  slug: string;
  url: string | null;
  owner: Person;
  joinedAt: number;
  devUrl?: string;
}

export interface JoinResult {
  key: string;
  projectId: string;
  slug: string;
  name: string;
  role: Role;
  me: string;
  owner: Person;
}

export interface PreviewResult {
  projectName: string;
  owner: Person | null;
  role: Role;
}

export interface ShareListing {
  serverUid: string | null;
  online: boolean;
  owner: Person | null;
  invites: { id: string; role: Role; createdAt: number; expiresAt: number | null; maxUses: number | null; uses: number; revokedAt: number | null }[];
  members: (Person & { uid: string; email: string; joinedAt: number; via: string; revokedAt: number | null })[];
}

export interface CreateInviteBody {
  role: Role;
  expiresInDays: 1 | 7 | 30 | null;
  maxUses: 1 | null;
}

export const ERR = { key: "key", expired: "expired", revoked: "revoked", role: "role", notMember: "not-member", origin: "origin" } as const;

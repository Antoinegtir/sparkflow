"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Access, AnyRole } from "@/lib/shared/share";

/** Your own projects: you are the owner and nobody else is there. */
export const OWNER_ACCESS: Access = { role: "owner", me: "owner", projectId: "", people: {}, sharing: false };

const AccessContext = createContext<Access>(OWNER_ACCESS);

export function AccessProvider({ value, children }: { value: Access; children: ReactNode }) {
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export const useAccess = () => useContext(AccessContext);

const RANK: Record<AnyRole, number> = { view: 0, comment: 1, edit: 2, owner: 3 };
const NEEDS: Record<"agent" | "canvas" | "comment" | "files.write" | "owner", AnyRole> = {
  agent: "edit",
  canvas: "edit",
  "files.write": "edit",
  comment: "comment",
  owner: "owner",
};

/** What the UI offers; the owner's server enforces the same rules on its side. */
export function can(access: Access, action: keyof typeof NEEDS): boolean {
  return RANK[access.role] >= RANK[NEEDS[action]];
}

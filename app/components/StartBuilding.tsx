"use client";

import { requireSignIn } from "@/lib/web/auth";
import { STATIC_SITE } from "@/lib/web/backend";

/** Topbar CTA: sign in first on the hosted site, then back to the prompt, ready to type. */
export function StartBuilding() {
  async function go() {
    if (STATIC_SITE && !(await requireSignIn("Sign in to start building."))) return;
    scrollTo({ top: 0, behavior: "smooth" });
    document.getElementById("composer")?.focus({ preventScroll: true });
  }
  return (
    <button type="button" onClick={go} className="cursor-pointer rounded-lg bg-spark-500 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-spark-400">
      Start building
    </button>
  );
}

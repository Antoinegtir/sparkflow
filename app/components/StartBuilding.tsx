"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";
import { requireSignIn, watchUser } from "@/lib/web/auth";
import { STATIC_SITE } from "@/lib/web/backend";

/** Topbar CTA: sign in first on the hosted site, then back to the prompt, ready to type. */
export function StartBuilding() {
  // Signed in on a phone, the bar keeps just the avatar: the prompt is right below.
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => watchUser((u) => setSignedIn(!!u)), []);
  async function go() {
    if (STATIC_SITE && !(await requireSignIn("Sign in to start building."))) return;
    scrollTo({ top: 0, behavior: "smooth" });
    document.getElementById("composer")?.focus({ preventScroll: true });
  }
  return (
    <button
      type="button"
      onClick={go}
      className={clsx("cursor-pointer whitespace-nowrap rounded-lg bg-spark-500 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-spark-400", signedIn && "hidden md:inline-flex")}>
      Start building
    </button>
  );
}

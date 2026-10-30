// Static landing for Firebase Hosting: the server-only routes (API, IDE, proxy) are set aside
// during the export, then put back. The site reaches them on your computer (`npm run remote`).
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";

// The proxy test imports proxy.ts, which the static export sets aside.
const ASIDE = ["app/api", "app/[app]", "app/p", "app/s", "proxy.ts", "tests/share-proxy.test.ts", "tests/cloud-proxy.test.ts"];
const STASH = ".static-stash";
rmSync(STASH, { recursive: true, force: true });
mkdirSync(STASH);
const moved = [];
try {
  for (const p of ASIDE) {
    if (!existsSync(p)) continue;
    const to = `${STASH}/${p.replaceAll("/", "__")}`;
    renameSync(p, to);
    moved.push([p, to]);
  }
  // The IDE as one client page: Firebase rewrites every app URL to it (firebase.json).
  mkdirSync("app/ide-shell", { recursive: true });
  copyFileSync("scripts/static/ide-page.tsx", "app/ide-shell/page.tsx");
  execSync("next build", {
    stdio: "inherit",
    env: { ...process.env, STATIC_EXPORT: "1", NEXT_PUBLIC_STATIC: "1", NEXT_DIST_DIR: ".next-static" },
  });
} finally {
  rmSync("app/ide-shell", { recursive: true, force: true });
  for (const [p, to] of moved) renameSync(to, p);
  rmSync(STASH, { recursive: true, force: true });
}

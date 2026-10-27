// Cuts a release: bumps package.json, commits, tags vX.Y.Z and pushes. GitHub Actions
// (.github/workflows/release.yml) then builds and publishes it for install.sh.
//
//   npm run release -- patch | minor | major | 1.2.3
import { execSync } from "node:child_process";

const bump = process.argv[2] ?? "patch";
const run = (cmd) => execSync(cmd, { stdio: "inherit" });
if (execSync("git status --porcelain").toString().trim()) {
  console.error("Commit or stash your changes first.");
  process.exit(1);
}
run(`npm version ${bump} -m "Release v%s"`);
run("git push --follow-tags");
const v = JSON.parse(execSync("cat package.json").toString()).version;
console.log(`\nv${v} pushed. The release appears once the workflow finishes: https://github.com/Antoinegtir/sparkflow/actions`);

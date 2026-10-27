// Runs the eval prompts through the orchestrator and writes eval/results/<iso>.json. Pass ids to run a subset.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { getOrchestrator } from "../lib/agent/orchestrator";

const cases: { id: string; prompt: string }[] = JSON.parse(await readFile(new URL("../eval/prompts.json", import.meta.url), "utf8"));
const only = process.argv.slice(2);
const orch = getOrchestrator();
const results = [];

for (const c of cases.filter((x) => !only.length || only.includes(x.id))) {
  const t0 = Date.now();
  const meta = await orch.createProject({ prompt: c.prompt });
  console.log(`\n▶ ${c.id} (${meta.id})`);
  const status = await new Promise<string>((resolve) => {
    void orch.streamEvents(meta.id, 0, (e) => {
      if (e.type === "screen_status" && (e.status === "done" || e.status === "failed")) console.log(`  ${e.status === "done" ? "✓" : "✗"} ${e.route} v${e.version} (attempt ${e.attempt ?? 1})`);
      if (e.type === "run_status" && e.status !== "running") resolve(e.status);
    });
  });
  const s = await orch.getState(meta.id);
  const screens = s.order.map((r) => s.screens[r]);
  const passed = screens.filter((x) => x.status === "done");
  results.push({
    id: c.id,
    project: meta.id,
    status,
    passed: passed.length,
    total: screens.length,
    firstTry: passed.filter((x) => x.attempt <= 1).length,
    avgAttempts: screens.length ? screens.reduce((a, x) => a + Math.max(1, x.attempt), 0) / screens.length : 0,
    costUsd: s.usage.costUsd,
    minutes: (Date.now() - t0) / 60000,
    message: s.timeline.filter((t) => t.kind === "agent").at(-1)?.text ?? "",
  });
  const r = results.at(-1)!;
  console.log(`  ${r.passed}/${r.total} passed · ${r.firstTry} first try · $${r.costUsd.toFixed(3)} · ${r.minutes.toFixed(1)} min`);
}

await mkdir(new URL("../eval/results/", import.meta.url), { recursive: true });
const out = new URL(`../eval/results/${new Date().toISOString().replace(/[:.]/g, "-")}.json`, import.meta.url);
await writeFile(out, JSON.stringify(results, null, 2));
console.log(`\nWrote ${out.pathname}`);
process.exit(0);

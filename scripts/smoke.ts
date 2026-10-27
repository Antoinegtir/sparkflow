// Headless end-to-end run (mock LLM + local sandbox by default). Exit 0 only when the run ends "done".
import { getOrchestrator } from "../lib/agent/orchestrator";

process.env.SPARKFLOW_LLM ??= "mock";
process.env.SPARKFLOW_SANDBOX ??= "local";

const orch = getOrchestrator();
const t0 = Date.now();
const at = () => `${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s`;
const meta = await orch.createProject({ prompt: "A habit tracker with streaks and weekly stats" });
console.log(`${at()} project ${meta.id}`);

const done = new Promise<string>((resolve) => {
  orch.streamEvents(meta.id, 0, (e) => {
    if (e.type === "log") console.log(`${at()} ${e.level === "error" ? "!" : " "} ${e.message}`);
    else if (e.type === "plan") console.log(`${at()} plan: ${e.plan.screens.map((s) => s.route).join(", ")}`);
    else if (e.type === "screen_status") console.log(`${at()} ${e.route} → ${e.status} v${e.version}`);
    else if (e.type === "screenshot") console.log(`${at()} shot ${e.url}`);
    else if (e.type === "preview_ready") console.log(`${at()} preview ${e.webUrl}`);
    else if (e.type === "run_status" && e.status !== "running") resolve(e.status);
  });
});
const status = await done;
const s = await orch.getState(meta.id);
console.log("\nScreen                 Status    Ver  Criteria");
for (const r of s.order) {
  const sc = s.screens[r];
  const crit = sc.verdict ? `${sc.verdict.criteria.filter((c) => c.pass).length}/${sc.verdict.criteria.length}` : "-";
  console.log(`${r.padEnd(22)} ${sc.status.padEnd(9)} v${sc.version}   ${crit}  a11y ${sc.quality?.score ?? "-"}`);
}
console.log(`\n${status} · $${s.usage.costUsd.toFixed(3)} · ${s.usage.calls} calls · ${at()}`);
console.log(`IDE: http://localhost:3001/p/${meta.id}`);
process.exit(status === "done" ? 0 : 1);

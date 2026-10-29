import { Presence, type PresenceReport } from "@/lib/shared";
import { handle, orchestrator } from "@/lib/web/server";

export const dynamic = "force-dynamic";

const g = globalThis as unknown as { __sparkflowPresence?: { presence: Presence; at: number } };

/** The open Sparkflow tab says where it is (page, project, scroll, prompt being typed). */
export const POST = handle(async (req: Request) => {
  g.__sparkflowPresence = { presence: Presence.parse(await req.json()), at: Date.now() };
  return Response.json({ ok: true });
});

const STEP: Record<string, string> = { sandbox: "Preparing the project", planner: "Planning the pages", builder: "Building", verifier: "Checking" };

/** For the `sparkflow` terminal screen: where the tab is, and the state of its project. */
export const GET = handle(async () => {
  const last = g.__sparkflowPresence;
  const report: PresenceReport = { presence: last?.presence ?? null, age: last ? Date.now() - last.at : Infinity, apps: 0 };
  report.apps = (await orchestrator().listProjects().catch(() => [])).length;
  const id = last?.presence.projectId;
  const s = id ? await orchestrator().getState(id).catch(() => null) : null;
  if (s) {
    const page = s.phaseRoute ? s.screens[s.phaseRoute]?.title : undefined;
    report.project = {
      name: s.name,
      status: s.status,
      phase: s.phase,
      step: STEP[s.phase] ? `${STEP[s.phase]}${page && s.phase !== "planner" && s.phase !== "sandbox" ? ` ${page}` : ""}` : undefined,
      done: s.order.filter((r) => s.screens[r]?.status === "done").length,
      total: s.order.length,
      costUsd: s.usage.costUsd,
    };
  }
  return Response.json({ ...report, age: Number.isFinite(report.age) ? report.age : null });
});

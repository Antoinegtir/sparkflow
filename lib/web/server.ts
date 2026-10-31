import { ZodError } from "zod";
import { BusyError, getOrchestrator } from "../agent/orchestrator";

export const orchestrator = getOrchestrator;

export type RouteCtx<P extends Record<string, string> = { id: string }> = { params: Promise<P> };

export function errorResponse(err: unknown) {
  // lib/share/actor throws ready-made 401/403 responses.
  if (err instanceof Response) return err;
  if (err instanceof BusyError) return Response.json({ error: err.message }, { status: 409 });
  if (err instanceof ZodError) return Response.json({ error: err.issues.map((i) => i.message).join("; ") }, { status: 400 });
  const message = String((err as Error)?.message ?? err);
  if (/not found/i.test(message)) return Response.json({ error: message }, { status: 404 });
  // A call for a Simulator that was just shut down (the page still showed it): expected, not logged.
  if (/as it is not booted|not booted/i.test(message)) return Response.json({ error: "The device isn't running" }, { status: 409 });
  console.error("[sparkflow]", err);
  return Response.json({ error: message }, { status: 500 });
}

/** Wraps a handler so every thrown error becomes a JSON response. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

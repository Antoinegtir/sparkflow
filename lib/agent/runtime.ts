import {
  applyEvent,
  initialState,
  type AgentEvent,
  type ProjectMeta,
  type ProjectState,
  type StoredEvent,
} from "../shared";
import type { Sandbox } from "../sandbox/types";
import type { ProjectStore } from "./store";
import type { UsageMeter } from "./usage";

const RING = 3000;

/** In-memory state of one project: folded state, listeners, recent events, the running job. */
export class ProjectRuntime {
  state: ProjectState;
  listeners = new Set<(e: StoredEvent) => void>();
  ring: StoredEvent[] = [];
  private writes: Promise<void> = Promise.resolve();
  idle: Promise<void> = Promise.resolve();
  running = false;
  abort?: AbortController;
  meter?: UsageMeter;
  sandbox?: Sandbox;
  sandboxP?: Promise<Sandbox>;

  constructor(
    public meta: ProjectMeta,
    events: StoredEvent[],
    private store: ProjectStore,
  ) {
    this.state = events.reduce(applyEvent, initialState(meta));
    this.ring = events.slice(-RING);
  }

  emit = (event: AgentEvent) => {
    const ev = { ...event, seq: this.state.lastSeq + 1, ts: Date.now() } as StoredEvent;
    this.state = applyEvent(this.state, ev);
    this.ring.push(ev);
    if (this.ring.length > RING) this.ring.splice(0, this.ring.length - RING);
    // Writes are chained so events.jsonl keeps seq order.
    this.writes = this.writes.then(() => this.store.appendEvent(this.meta.id, ev)).catch((err) => console.error("[sparkflow] event write failed", err));
    for (const l of this.listeners) {
      try {
        l(ev);
      } catch {}
    }
    return ev;
  };

  log = (message: string, route?: string, level: "info" | "error" = "info") => this.emit({ type: "log", level, message, route });

  flush() {
    return this.writes;
  }
}

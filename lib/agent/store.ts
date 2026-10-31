import { appendFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MediaInput, ProjectMeta, StoredEvent } from "../shared";
import { stateDir } from "../sandbox/util";

const ID = /^[a-z0-9-]+$/;
const safeShot = (name: string) => name.replace(/[^a-zA-Z0-9_.-]/g, "_");

/** Projects on disk: .sparkflow/projects/<id>/{meta.json, events.jsonl, shots/, inputs/}. Swappable for a database behind the same methods. */
export class ProjectStore {
  root = path.join(stateDir(), "projects");

  dir(id: string) {
    if (!ID.test(id)) throw new Error("Project not found");
    return path.join(this.root, id);
  }

  async list(): Promise<ProjectMeta[]> {
    await mkdir(this.root, { recursive: true });
    const ids = (await readdir(this.root)).filter((d) => ID.test(d));
    const metas = await Promise.all(ids.map((id) => this.readMeta(id).catch(() => null)));
    return metas.filter((m): m is ProjectMeta => !!m).sort((a, b) => b.createdAt - a.createdAt);
  }

  async create(meta: ProjectMeta) {
    await mkdir(path.join(this.dir(meta.id), "shots"), { recursive: true });
    await this.updateMeta(meta);
  }

  async readMeta(id: string): Promise<ProjectMeta> {
    try {
      return JSON.parse(await readFile(path.join(this.dir(id), "meta.json"), "utf8"));
    } catch {
      throw new Error("Project not found");
    }
  }

  async updateMeta(meta: ProjectMeta) {
    await writeFile(path.join(this.dir(meta.id), "meta.json"), JSON.stringify(meta, null, 2));
  }

  async appendEvent(id: string, ev: StoredEvent) {
    await appendFile(path.join(this.dir(id), "events.jsonl"), JSON.stringify(ev) + "\n");
  }

  async readEvents(id: string): Promise<StoredEvent[]> {
    const text = await readFile(path.join(this.dir(id), "events.jsonl"), "utf8").catch(() => "");
    return text
      .split("\n")
      .filter(Boolean)
      .flatMap((l) => {
        try {
          return [JSON.parse(l) as StoredEvent];
        } catch {
          return [];
        }
      });
  }

  async saveShot(id: string, name: string, png: Buffer) {
    const file = safeShot(name);
    await mkdir(path.join(this.dir(id), "shots"), { recursive: true });
    await writeFile(path.join(this.dir(id), "shots", file), png);
    return `/api/projects/${id}/shots/${file}`;
  }

  async listShots(id: string) {
    return readdir(path.join(this.dir(id), "shots")).catch(() => [] as string[]);
  }

  /** A project brought over from another Sparkflow (the cloud, a Mac): its meta and history replace these. */
  async replace(meta: ProjectMeta, events: string) {
    await mkdir(path.join(this.dir(meta.id), "shots"), { recursive: true });
    await this.updateMeta(meta);
    await writeFile(path.join(this.dir(meta.id), "events.jsonl"), events);
  }

  readShot(id: string, name: string) {
    return readFile(path.join(this.dir(id), "shots", safeShot(name)));
  }

  async saveInput(id: string, kind: "image" | "audio", input: MediaInput) {
    await mkdir(path.join(this.dir(id), "inputs"), { recursive: true });
    await writeFile(path.join(this.dir(id), "inputs", `${kind}.json`), JSON.stringify(input));
  }

  async readInput(id: string, kind: "image" | "audio"): Promise<MediaInput | undefined> {
    try {
      return JSON.parse(await readFile(path.join(this.dir(id), "inputs", `${kind}.json`), "utf8"));
    } catch {
      return undefined;
    }
  }

  delete(id: string) {
    return rm(this.dir(id), { recursive: true, force: true });
  }
}

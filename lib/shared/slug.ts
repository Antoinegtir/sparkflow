/** "My Habit App!" → "my-habit-app" (accents dropped). */
export const slugify = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "app";

/** URL name of every project: its slugified name, with -2, -3… for later projects of the same name. */
export function appSlugs(projects: { id: string; name: string; createdAt: number }[]) {
  const out = new Map<string, string>();
  const taken = new Map<string, number>();
  for (const p of [...projects].sort((a, b) => a.createdAt - b.createdAt)) {
    const base = slugify(p.name);
    const n = (taken.get(base) ?? 0) + 1;
    taken.set(base, n);
    out.set(p.id, n === 1 ? base : `${base}-${n}`);
  }
  return out;
}

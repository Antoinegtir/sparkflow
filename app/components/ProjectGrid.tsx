import { Plus, Smartphone } from "lucide-react";

type Project = { name: string; screens: number; updated: string; hue: number };

// Données d'exemple tant qu'il n'y a pas de backend.
const PROJECTS: Project[] = [
  { name: "Habit tracker", screens: 4, updated: "2 min ago", hue: 210 },
  { name: "Recipe book", screens: 5, updated: "1 h ago", hue: 160 },
  { name: "Budget", screens: 3, updated: "Yesterday", hue: 280 },
];

/** Projets récents, sous la section « How it works ». */
export function ProjectGrid() {
  return (
    <section className="relative mx-auto max-w-5xl px-6 pb-24">
      <h2 className="landing-head mb-6 text-2xl font-semibold text-ink-100">Your projects</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button className="grid aspect-[4/5] place-items-center rounded-2xl border border-dashed border-ink-600 text-ink-400 transition hover:border-spark-400 hover:text-spark-400">
          <span className="flex flex-col items-center gap-2 text-sm">
            <Plus size={20} /> New app
          </span>
        </button>
        {PROJECTS.map((p) => (
          <article key={p.name} className="group flex aspect-[4/5] flex-col overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 transition hover:border-ink-600">
            <div
              className="grid flex-1 place-items-center"
              style={{ background: `radial-gradient(circle at 50% 30%, hsl(${p.hue} 80% 55% / .25), transparent 70%)` }}>
              <Smartphone size={44} strokeWidth={1.2} className="text-ink-300 transition group-hover:scale-105" />
            </div>
            <div className="border-t border-ink-800 p-3">
              <p className="text-sm font-medium text-ink-100">{p.name}</p>
              <p className="mt-0.5 text-xs text-ink-500">
                {p.screens} screens · {p.updated}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

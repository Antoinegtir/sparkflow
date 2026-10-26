import { FolderOpen } from "lucide-react";

/** Lien discret sous la zone de saisie pour partir d'un projet existant. */
export function ImportNative() {
  return (
    <button className="mx-auto mt-8 flex items-center gap-2 border-b border-ink-600 pb-2 text-sm text-ink-400 transition hover:border-ink-400 hover:text-ink-200">
      <FolderOpen size={16} className="text-spark-400" />
      Import from a React Native project
    </button>
  );
}

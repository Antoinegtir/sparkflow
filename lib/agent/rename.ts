import path from "node:path";

/**
 * Moving or renaming files in an app without breaking it, as VS Code does: every import, export-from,
 * require() and import() that points to a moved file is rewritten to its new place, and a moved file's
 * own relative imports are rewritten from where it now sits. Pure: it gets the contents and returns the
 * files that change.
 */

const p = path.posix;
const EXTS = ["", ".tsx", ".ts", ".jsx", ".js", ".json"];
const INDEX = ["/index.tsx", "/index.ts", "/index.jsx", "/index.js"];
/** The module specifier of an import, export-from, side-effect import, require() or import(). */
const SPEC = /(\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)(["'])([^"'\n]+)\2/g;

export const isCode = (f: string) => /\.(tsx?|jsx?|mjs|cjs)$/.test(f);

/** The file a specifier means from `from` (relative or "@/"), among `known`; null for a package. */
export function resolveSpec(from: string, spec: string, known: Set<string>): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = spec.slice(2);
  else if (spec.startsWith("./") || spec.startsWith("../") || spec === "." || spec === "..") base = p.normalize(p.join(p.dirname(from), spec));
  else return null;
  for (const e of [...EXTS, ...INDEX]) if (known.has(base + e)) return base + e;
  return null;
}

/** A specifier for `target` written like `old` was: same style ("@/" or relative), extension, index. */
function specFor(importer: string, target: string, old: string, oldTarget: string) {
  const keepExt = /\.[cm]?[jt]sx?$|\.json$/.test(old) && p.extname(old) === p.extname(oldTarget);
  const viaIndex = /\/index\.[jt]sx?$/.test(oldTarget) && !/index(\.[jt]sx?)?$/.test(old);
  let to = viaIndex ? p.dirname(target) : keepExt ? target : target.replace(/\.(tsx?|jsx?)$/, "");
  if (!viaIndex && !keepExt && /\/index$/.test(to) && !/index$/.test(old)) to = p.dirname(to);
  if (old.startsWith("@/")) return "@/" + to;
  let rel = p.relative(p.dirname(importer), to) || ".";
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel;
}

/**
 * `files`: every code file of the app and its content. `moves`: old path → new path for each moved
 * file (a moved folder lists each file inside). Returns new path → new content for the files whose
 * imports changed (a moved file is listed under its new path).
 */
export function rewriteImports(files: Map<string, string>, moves: Map<string, string>): Map<string, string> {
  const known = new Set([...files.keys(), ...moves.keys()]);
  const out = new Map<string, string>();
  for (const [file, text] of files) {
    if (!isCode(file)) continue;
    const at = moves.get(file) ?? file;
    let changed = false;
    const next = text.replace(SPEC, (all, lead: string, q: string, spec: string) => {
      const target = resolveSpec(file, spec, known);
      if (!target) return all;
      const moved = moves.get(target);
      // Unchanged when neither the target nor (for a relative import) the importer moved.
      if (!moved && (at === file || spec.startsWith("@/"))) return all;
      const fresh = specFor(at, moved ?? target, spec, target);
      if (fresh === spec) return all;
      changed = true;
      return `${lead}${q}${fresh}${q}`;
    });
    if (changed) out.set(at, next);
  }
  return out;
}

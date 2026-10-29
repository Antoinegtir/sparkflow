import { readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type * as TS from "typescript";

/**
 * VS Code's TypeScript features for the IDE's code view: hover, completions, go to definition. Each
 * app gets a language service from its own `typescript` (and its own types: React Native, Expo,
 * the app's components), fed with the editor's unsaved text.
 */
export type LangRequest =
  | { op: "hover" | "complete" | "definition"; path: string; content: string; offset: number }
  | { op: "details"; path: string; content: string; offset: number; name: string; source?: string; data?: unknown };

type Service = { ts: typeof TS; ls: TS.LanguageService; overlay: Map<string, { text: string; version: number }> };
const services = new Map<string, Service>();

function service(dir: string): Service {
  const cached = services.get(dir);
  if (cached) return cached;
  const ts = createRequire(path.join(dir, "package.json"))("typescript") as typeof TS;
  const configPath = ts.findConfigFile(dir, ts.sys.fileExists, "tsconfig.json");
  const config = configPath
    ? ts.parseJsonConfigFileContent(ts.readConfigFile(configPath, ts.sys.readFile).config, ts.sys, dir)
    : { options: { jsx: ts.JsxEmit.ReactJSX, allowJs: true, strict: true }, fileNames: [] as string[] };
  const overlay = new Map<string, { text: string; version: number }>();
  const host: TS.LanguageServiceHost = {
    getCompilationSettings: () => config.options,
    getScriptFileNames: () => [...new Set([...config.fileNames, ...overlay.keys()])],
    getScriptVersion: (f) => {
      const o = overlay.get(f);
      if (o) return `o${o.version}`;
      try {
        return String(statSync(f).mtimeMs);
      } catch {
        return "0";
      }
    },
    getScriptSnapshot: (f) => {
      const o = overlay.get(f);
      if (o) return ts.ScriptSnapshot.fromString(o.text);
      try {
        return ts.ScriptSnapshot.fromString(readFileSync(f, "utf8"));
      } catch {
        return undefined;
      }
    },
    getCurrentDirectory: () => dir,
    getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
  };
  const s = { ts, ls: ts.createLanguageService(host, ts.createDocumentRegistry()), overlay };
  services.set(dir, s);
  return s;
}

const PREFS: TS.UserPreferences = {
  includeCompletionsForModuleExports: true,
  includeCompletionsWithInsertText: true,
  includeCompletionsWithSnippetText: false,
  jsxAttributeCompletionStyle: "auto",
  importModuleSpecifierPreference: "non-relative",
};

export function lang(dir: string, req: LangRequest) {
  const { ts, ls, overlay } = service(dir);
  const file = path.join(dir, req.path);
  // The editor's text, unsaved or not: a new version each time it changes.
  const prev = overlay.get(file);
  if (prev?.text !== req.content) overlay.set(file, { text: req.content, version: (prev?.version ?? 0) + 1 });
  const text = (parts?: TS.SymbolDisplayPart[]) => ts.displayPartsToString(parts);
  const docs = (d?: TS.SymbolDisplayPart[], tags?: TS.JSDocTagInfo[]) =>
    [text(d), ...(tags ?? []).map((t) => `*@${t.name}* ${text(t.text)}`)].filter(Boolean).join("\n\n");

  if (req.op === "hover") {
    const q = ls.getQuickInfoAtPosition(file, req.offset);
    return q && { text: text(q.displayParts), docs: docs(q.documentation, q.tags), start: q.textSpan.start, length: q.textSpan.length };
  }
  if (req.op === "complete") {
    const c = ls.getCompletionsAtPosition(file, req.offset, PREFS, config(ts));
    if (!c) return { entries: [] };
    return {
      entries: c.entries.slice(0, 400).map((e) => ({
        name: e.name,
        kind: e.kind,
        sortText: e.sortText,
        insertText: e.insertText,
        source: e.source,
        data: e.data,
        replace: e.replacementSpan,
        // Auto-imports say where they come from, like VS Code.
        from: e.hasAction ? e.source : undefined,
      })),
    };
  }
  if (req.op === "details") {
    const d = ls.getCompletionEntryDetails(file, req.offset, req.name, config(ts), req.source, PREFS, req.data as TS.CompletionEntryData | undefined);
    if (!d) return null;
    const edits = (d.codeActions ?? []).flatMap((a) => a.changes.filter((ch) => ch.fileName === file).flatMap((ch) => ch.textChanges));
    return { detail: text(d.displayParts), docs: docs(d.documentation, d.tags), edits };
  }
  // Definitions in the app's own files (node_modules ones show in the hover instead).
  const defs = ls.getDefinitionAtPosition(file, req.offset) ?? [];
  return defs
    .filter((d) => d.fileName.startsWith(dir + path.sep) && !d.fileName.includes(`${path.sep}node_modules${path.sep}`))
    .map((d) => {
      const rel = path.relative(dir, d.fileName).split(path.sep).join("/");
      const src = overlay.get(d.fileName)?.text ?? readFileSync(d.fileName, "utf8");
      const before = src.slice(0, d.textSpan.start).split("\n");
      return { path: rel, line: before.length, col: before.at(-1)!.length + 1, length: d.textSpan.length };
    });
}

const config = (ts: typeof TS): TS.FormatCodeSettings => ({ ...ts.getDefaultFormatCodeSettings("\n"), indentSize: 2, tabSize: 2, convertTabsToSpaces: true });

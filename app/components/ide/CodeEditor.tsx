"use client";

import Editor, { type Monaco } from "@monaco-editor/react";
import type * as MonacoApi from "monaco-editor";
import type { editor as Ed, IPosition, IRange, languages, Position, Uri } from "monaco-editor";
import { useEffect, useRef } from "react";
import { can, useAccess } from "@/lib/web/access";

/**
 * VS Code's editor for the code view. Hover, completions and go to definition come from the app's
 * own TypeScript on the computer running sparkflow (/api/projects/:id/lang), errors show at the end
 * of their line like Error Lens, and ⌘-click on a symbol from another file opens that file.
 */
type Props = {
  projectId: string;
  file: string;
  value: string;
  line: number | null;
  diagnostics: { line: number; message: string }[];
  onChange: (v: string) => void;
  onOpenFile: (path: string, line: number) => void;
};

const LANG: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  css: "css",
  md: "markdown",
  swift: "swift",
};
const TS_FILE = /\.(tsx?|jsx?|mjs|cjs)$/;
const uriOf = (projectId: string, file: string) => `file:///${projectId}/${file}`;

// The open editor's project and file: the language providers are registered once for every model.
const current: {
  projectId?: string;
  open?: (path: string, line: number) => void;
  /** The language service runs on the owner's Mac: off for roles that can't edit files. */
  noLang?: boolean;
} = {};
let registered = false;

async function ask<T>(projectId: string, body: Record<string, unknown>): Promise<T | null> {
  if (current.noLang) return null;
  const res = await fetch(`/api/projects/${projectId}/lang`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!res?.ok) return null;
  return ((await res.json()) as { result: T | null }).result;
}

/** The project-relative path of a model, when it belongs to the open project. */
function fileOf(model: Ed.ITextModel) {
  const prefix = `/${current.projectId}/`;
  return current.projectId && model.uri.path.startsWith(prefix) ? model.uri.path.slice(prefix.length) : null;
}

function setup(m: Monaco) {
  // The wrapper's Monaco type is loose: use the package's own.
  const monaco = m as unknown as typeof MonacoApi;
  monaco.editor.defineTheme("sparkflow", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#0b0d12",
      "editorGutter.background": "#0b0d12",
      "editor.lineHighlightBackground": "#ffffff08",
      "editorLineNumber.foreground": "#3b4454",
      "editorLineNumber.activeForeground": "#9aa4b5",
      "editorWidget.background": "#12151c",
      "editorHoverWidget.background": "#12151c",
      "editorHoverWidget.border": "#2a3240",
      "editorSuggestWidget.background": "#12151c",
      "editorSuggestWidget.border": "#2a3240",
      "editorSuggestWidget.selectedBackground": "#1d4ed866",
    },
  });
  if (registered) return;
  registered = true;
  // Monaco's own TypeScript knows nothing of the app's packages: its features would be wrong.
  const ts = (
    monaco as unknown as {
      typescript: {
        typescriptDefaults: {
          setModeConfiguration(c: object): void;
          setDiagnosticsOptions(o: object): void;
        };
        javascriptDefaults: { setModeConfiguration(c: object): void };
      };
    }
  ).typescript;
  const off = {
    completionItems: false,
    hovers: false,
    definitions: false,
    references: false,
    rename: false,
    diagnostics: false,
    signatureHelp: false,
    codeActions: false,
    inlayHints: false,
    documentSymbols: true,
    documentHighlights: true,
  };
  ts.typescriptDefaults.setModeConfiguration(off);
  ts.javascriptDefaults.setModeConfiguration(off);

  const KIND: Record<string, languages.CompletionItemKind> = {
    function: monaco.languages.CompletionItemKind.Function,
    method: monaco.languages.CompletionItemKind.Method,
    property: monaco.languages.CompletionItemKind.Property,
    getter: monaco.languages.CompletionItemKind.Property,
    var: monaco.languages.CompletionItemKind.Variable,
    let: monaco.languages.CompletionItemKind.Variable,
    const: monaco.languages.CompletionItemKind.Constant,
    "local var": monaco.languages.CompletionItemKind.Variable,
    parameter: monaco.languages.CompletionItemKind.Variable,
    class: monaco.languages.CompletionItemKind.Class,
    interface: monaco.languages.CompletionItemKind.Interface,
    type: monaco.languages.CompletionItemKind.TypeParameter,
    enum: monaco.languages.CompletionItemKind.Enum,
    "enum member": monaco.languages.CompletionItemKind.EnumMember,
    module: monaco.languages.CompletionItemKind.Module,
    keyword: monaco.languages.CompletionItemKind.Keyword,
    string: monaco.languages.CompletionItemKind.Value,
    alias: monaco.languages.CompletionItemKind.Reference,
  };
  type Entry = {
    name: string;
    kind: string;
    sortText: string;
    insertText?: string;
    source?: string;
    data?: unknown;
    replace?: { start: number; length: number };
    from?: string;
  };
  type Item = languages.CompletionItem & { _req?: Record<string, unknown> };

  for (const language of ["typescript", "javascript"]) {
    monaco.languages.registerHoverProvider(language, {
      async provideHover(model, position) {
        const path = fileOf(model);
        if (!path) return null;
        const r = await ask<{
          text: string;
          docs: string;
          start: number;
          length: number;
        }>(current.projectId!, {
          op: "hover",
          path,
          content: model.getValue(),
          offset: model.getOffsetAt(position),
        });
        if (!r?.text) return null;
        const a = model.getPositionAt(r.start);
        const b = model.getPositionAt(r.start + r.length);
        return {
          range: new monaco.Range(a.lineNumber, a.column, b.lineNumber, b.column),
          contents: [{ value: "```typescript\n" + r.text + "\n```" }, ...(r.docs ? [{ value: r.docs }] : [])],
        };
      },
    });

    monaco.languages.registerCompletionItemProvider(language, {
      triggerCharacters: [".", "<", "/", "@", '"', "'", " "],
      async provideCompletionItems(model, position, context) {
        const path = fileOf(model);
        if (!path) return { suggestions: [] };
        // A space only opens the list inside a JSX tag (its props).
        if (context.triggerCharacter === " " && !/<[A-Za-z][\w.]*(\s+[^<>]*)?\s$/.test(model.getLineContent(position.lineNumber).slice(0, position.column - 1))) return { suggestions: [] };
        const content = model.getValue();
        const offset = model.getOffsetAt(position);
        const r = await ask<{ entries: Entry[] }>(current.projectId!, {
          op: "complete",
          path,
          content,
          offset,
        });
        const word = model.getWordUntilPosition(position);
        const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
        return {
          suggestions: (r?.entries ?? []).map((e): Item => {
            let itemRange = range;
            if (e.replace) {
              const a = model.getPositionAt(e.replace.start);
              const b = model.getPositionAt(e.replace.start + e.replace.length);
              itemRange = new monaco.Range(a.lineNumber, a.column, b.lineNumber, b.column);
            }
            return {
              label: e.from ? { label: e.name, description: e.from } : e.name,
              kind: KIND[e.kind] ?? monaco.languages.CompletionItemKind.Text,
              sortText: e.sortText,
              insertText: e.insertText ?? e.name,
              range: itemRange,
              _req: {
                op: "details",
                path,
                content,
                offset,
                name: e.name,
                source: e.source,
                data: e.data,
              },
            };
          }),
        };
      },
      async resolveCompletionItem(item: Item) {
        const req = item._req;
        if (!req || !current.projectId) return item;
        const d = await ask<{
          detail: string;
          docs: string;
          edits: { span: { start: number; length: number }; newText: string }[];
        }>(current.projectId, req);
        if (!d) return item;
        const model = monaco.editor.getModels().find((m) => fileOf(m) === req.path);
        return {
          ...item,
          detail: d.detail,
          documentation: d.docs ? { value: d.docs } : undefined,
          // An auto-import adds its import line, like VS Code.
          additionalTextEdits: model
            ? d.edits.map((e) => {
                const a = model.getPositionAt(e.span.start);
                const b = model.getPositionAt(e.span.start + e.span.length);
                return {
                  range: new monaco.Range(a.lineNumber, a.column, b.lineNumber, b.column),
                  text: e.newText,
                };
              })
            : undefined,
        };
      },
    });

    monaco.languages.registerDefinitionProvider(language, {
      async provideDefinition(model: Ed.ITextModel, position: Position) {
        const path = fileOf(model);
        if (!path) return null;
        const defs = await ask<{ path: string; line: number; col: number; length: number }[]>(current.projectId!, {
          op: "definition",
          path,
          content: model.getValue(),
          offset: model.getOffsetAt(position),
        });
        return (defs ?? []).map((d) => {
          const uri = monaco.Uri.parse(uriOf(current.projectId!, d.path));
          // Monaco only follows links to models it has; the opener below loads the real file.
          if (!monaco.editor.getModel(uri)) monaco.editor.createModel("", LANG[d.path.split(".").pop() ?? ""] ?? "plaintext", uri);
          return {
            uri,
            range: new monaco.Range(d.line, d.col, d.line, d.col + d.length),
          };
        });
      },
    });
  }

  // ⌘-click on a symbol from another file: open that file in the code view.
  monaco.editor.registerEditorOpener({
    openCodeEditor(source: Ed.ICodeEditor, resource: Uri, selection?: IRange | IPosition) {
      const prefix = `/${current.projectId}/`;
      if (!current.projectId || !resource.path.startsWith(prefix) || resource.toString() === source.getModel()?.uri.toString()) return false;
      const line = selection && "startLineNumber" in selection ? selection.startLineNumber : (selection?.lineNumber ?? 1);
      current.open?.(resource.path.slice(prefix.length), line);
      return true;
    },
  });
}

export function CodeEditor({ projectId, file, value, line, diagnostics, onChange, onOpenFile }: Props) {
  const editor = useRef<Ed.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const lens = useRef<Ed.IEditorDecorationsCollection | null>(null);
  const jump = useRef<Ed.IEditorDecorationsCollection | null>(null);

  const writable = can(useAccess(), "files.write");
  current.projectId = projectId;
  current.open = onOpenFile;
  current.noLang = !writable;

  // Error Lens: the line tinted red, its message after the code.
  useEffect(() => {
    const ed = editor.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco) return;
    const lines = new Map<number, string[]>();
    for (const d of diagnostics) lines.set(d.line, [...(lines.get(d.line) ?? []), d.message]);
    const model = ed.getModel()!;
    const decorations = [...lines]
      .filter(([n]) => n <= model.getLineCount())
      .flatMap(([n, msgs]) => {
        const end = model.getLineMaxColumn(n);
        return [
          { range: new monaco.Range(n, 1, n, 1), options: { isWholeLine: true, className: "error-lens-line", linesDecorationsClassName: "error-lens-gutter" } },
          // The message, injected after the line's last character.
          {
            range: new monaco.Range(n, end, n, end),
            options: { showIfCollapsed: true, after: { content: `   ${msgs.join("  ·  ")}`, inlineClassName: "error-lens-message" }, hoverMessage: { value: msgs.join("\n\n") } },
          },
        ];
      });
    lens.current ??= ed.createDecorationsCollection();
    lens.current.set(decorations);
    monaco.editor.setModelMarkers(
      ed.getModel()!,
      "sparkflow",
      diagnostics.map((d) => ({
        startLineNumber: d.line,
        endLineNumber: d.line,
        startColumn: 1,
        endColumn: ed.getModel()!.getLineMaxColumn(Math.min(d.line, ed.getModel()!.getLineCount())),
        message: d.message,
        severity: monaco.MarkerSeverity.Error,
      })),
    );
  }, [diagnostics, file]);

  // A line picked elsewhere (Layout tab, a definition): scroll to it and mark it.
  useEffect(() => {
    const ed = editor.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco) return;
    jump.current ??= ed.createDecorationsCollection();
    if (!line) return jump.current.clear();
    ed.revealLineInCenter(line);
    ed.setPosition({ lineNumber: line, column: 1 });
    jump.current.set([
      {
        range: new monaco.Range(line, 1, line, 1),
        options: { isWholeLine: true, className: "code-jump-line" },
      },
    ]);
  }, [line, file]);

  const ext = file.split(".").pop() ?? "";
  return (
    // Escape closes the editor's own widgets, not the IDE's open page.
    <div className="h-full" onKeyDown={(e) => e.key === "Escape" && e.stopPropagation()}>
      <Editor
        path={uriOf(projectId, file)}
        language={LANG[ext] ?? "plaintext"}
        value={value}
        theme="sparkflow"
        beforeMount={setup}
        onMount={(ed, monaco) => {
          editor.current = ed;
          monacoRef.current = monaco;
          // ⌘S out of habit: it's saved anyway.
          ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {});
          if (line) {
            ed.revealLineInCenter(line);
            jump.current = ed.createDecorationsCollection([
              {
                range: new monaco.Range(line, 1, line, 1),
                options: { isWholeLine: true, className: "code-jump-line" },
              },
            ]);
          }
        }}
        onChange={(v) => onChange(v ?? "")}
        loading={<p className="p-4 text-[12px] text-ink-500">Loading the editor…</p>}
        options={{
          fontFamily: "var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
          readOnly: !writable,
          fontSize: 12,
          lineHeight: 19,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          tabSize: 2,
          insertSpaces: true,
          automaticLayout: true,
          renderLineHighlight: "line",
          padding: { top: 8 },
          // Hover cards and suggestions can leave the narrow panel.
          fixedOverflowWidgets: true,
          definitionLinkOpensInPeek: false,
          quickSuggestions: TS_FILE.test(file) ? { other: true, comments: false, strings: true } : false,
          suggest: { showStatusBar: true, preview: true },
          stickyScroll: { enabled: false },
          overviewRulerBorder: false,
          scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
        }}
      />
    </div>
  );
}

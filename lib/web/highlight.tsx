import type { ReactNode } from "react";

const KEYWORDS =
  "import|from|export|default|const|let|var|function|return|if|else|for|while|of|in|new|class|extends|type|interface|async|await|try|catch|throw|switch|case|break|continue|as|typeof|keyof|void|func|struct|guard|let|var|nil|self|enum|protocol|extension";
const TOKEN = new RegExp(
  [
    "(\\/\\/.*$|\\/\\*.*?\\*\\/)",
    "(\"(?:[^\"\\\\]|\\\\.)*\"|'(?:[^'\\\\]|\\\\.)*'|`(?:[^`\\\\]|\\\\.)*`)",
    "(<\\/?[A-Za-z][\\w.]*|\\/?>)",
    `\\b(${KEYWORDS})\\b`,
    "\\b(true|false|null|undefined)\\b",
    "\\b(\\d+(?:\\.\\d+)?)\\b",
    "\\b([a-zA-Z_]\\w*)(?=\\()",
    "\\b([a-zA-Z_][\\w-]*)(?==)",
    "\\b([A-Z]\\w*)\\b",
  ].join("|"),
  "g",
);
const CLASSES = ["tok-comment", "tok-string", "tok-tag", "tok-keyword", "tok-literal", "tok-number", "tok-fn", "tok-prop", "tok-type"];

/** One-line regex highlighter (good enough for TSX, JSON and Swift). */
export function highlightLine(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of line.matchAll(TOKEN)) {
    const i = m.index!;
    if (i > last) out.push(line.slice(last, i));
    const group = m.slice(1).findIndex((g) => g !== undefined);
    out.push(
      <span key={i} className={CLASSES[group]}>
        {m[0]}
      </span>,
    );
    last = i + m[0].length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

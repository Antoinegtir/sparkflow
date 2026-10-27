import { readFile } from "node:fs/promises";
import path from "node:path";
import { handle } from "@/lib/web/server";

// Icons from Material Icon Theme (MIT, github.com/material-extensions/vscode-material-icon-theme).
const ROOT = path.join(process.cwd(), "node_modules", "material-icon-theme");

type Manifest = {
  iconDefinitions: Record<string, { iconPath: string }>;
  fileNames: Record<string, string>;
  fileExtensions: Record<string, string>;
  folderNames: Record<string, string>;
  folderNamesExpanded: Record<string, string>;
  languageIds: Record<string, string>;
  file: string;
  folder: string;
  folderExpanded: string;
};

let manifest: Promise<Manifest> | null = null;
const load = () => (manifest ??= readFile(path.join(ROOT, "dist", "material-icons.json"), "utf8").then(JSON.parse));

// Extensions VS Code resolves through language ids rather than the extension table.
const LANGUAGES: Record<string, string> = {
  ts: "typescript", tsx: "typescriptreact", js: "javascript", jsx: "javascriptreact", mjs: "javascript", cjs: "javascript",
  json: "json", css: "css", md: "markdown", html: "html", yml: "yaml", yaml: "yaml", swift: "swift", sh: "shellscript",
};

function iconFor(m: Manifest, name: string, kind: "file" | "folder", open: boolean) {
  const lower = name.toLowerCase();
  if (kind === "folder") return (open ? m.folderNamesExpanded[lower] : m.folderNames[lower]) ?? (open ? m.folderExpanded : m.folder);
  if (m.fileNames[lower]) return m.fileNames[lower];
  // Longest extension first: "d.ts" before "ts", "config.js" before "js".
  const parts = lower.split(".");
  for (let i = 1; i < parts.length; i++) {
    const ext = parts.slice(i).join(".");
    if (m.fileExtensions[ext]) return m.fileExtensions[ext];
  }
  const lang = LANGUAGES[parts.at(-1) ?? ""];
  return (lang && m.languageIds[lang]) || m.file;
}

/** SVG icon for a file or folder name, as the Material Icon Theme would show it in VS Code. */
export const GET = handle(async (req: Request) => {
  const u = new URL(req.url);
  const m = await load();
  const id = iconFor(m, u.searchParams.get("name") ?? "", u.searchParams.get("kind") === "folder" ? "folder" : "file", u.searchParams.has("open"));
  const rel = m.iconDefinitions[id]?.iconPath ?? m.iconDefinitions[m.file].iconPath;
  const svg = await readFile(path.join(ROOT, "dist", rel));
  return new Response(new Uint8Array(svg), { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" } });
});

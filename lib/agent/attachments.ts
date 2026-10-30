import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { MediaInput } from "../shared";

const run = promisify(execFile);

/** What the agent gets from a prompt's attached files: pictures it looks at, and text it reads. */
export type Prepared = { images: { mediaType: string; data: string; caption: string }[]; text: string };

const IMAGE = /^image\/(png|jpeg|webp|gif)$/;
const TEXT_LIMIT = 40_000;

/**
 * Turns a prompt's attachments into what the model takes: PNG/JPEG/WebP/GIF as they are; HEIC (an
 * iPhone photo) converted to JPEG; a PDF as its text plus its first page as a picture; Markdown or plain
 * text as text. Conversions use macOS's own tools (sips) and pdftotext when it's installed; a file that
 * can't be converted is named in the text so the agent knows it was there.
 */
export async function prepareAttachments(atts: MediaInput[] = []): Promise<Prepared> {
  const out: Prepared = { images: [], text: "" };
  const parts: string[] = [];
  for (const [i, a] of atts.entries()) {
    const name = (a.name ?? `attachment ${i + 1}`).slice(0, 120);
    const caption = `Attached file "${name}":`;
    try {
      if (IMAGE.test(a.mediaType)) out.images.push({ mediaType: a.mediaType, data: a.data, caption });
      else if (/^image\/hei[cf]$/.test(a.mediaType) || /\.(heic|heif)$/i.test(name)) {
        out.images.push({ mediaType: "image/jpeg", data: (await convert(a.data, "heic", "jpeg")).toString("base64"), caption });
      } else if (a.mediaType === "application/pdf" || /\.pdf$/i.test(name)) {
        const text = await pdfText(a.data);
        if (text) parts.push(`${caption}\n${text.slice(0, TEXT_LIMIT)}`);
        const page = await convert(a.data, "pdf", "png").catch(() => null);
        if (page) out.images.push({ mediaType: "image/png", data: page.toString("base64"), caption: `First page of "${name}":` });
        if (!text && !page) parts.push(`${caption} (a PDF that couldn't be read on this computer)`);
      } else {
        // Markdown, plain text and other text files.
        parts.push(`${caption}\n${Buffer.from(a.data, "base64").toString("utf8").slice(0, TEXT_LIMIT)}`);
      }
    } catch {
      parts.push(`${caption} (couldn't be read on this computer)`);
    }
  }
  out.text = parts.join("\n\n");
  return out;
}

/** One file through a temporary folder: sips converts HEIC and renders a PDF's first page (macOS). */
async function convert(data: string, from: string, to: "jpeg" | "png") {
  if (process.platform !== "darwin") throw new Error("Only on macOS");
  const dir = await mkdtemp(path.join(os.tmpdir(), "sparkflow-att-"));
  try {
    const src = path.join(dir, `in.${from}`);
    const dst = path.join(dir, `out.${to === "jpeg" ? "jpg" : "png"}`);
    await writeFile(src, Buffer.from(data, "base64"));
    await run("sips", ["-s", "format", to, "-Z", "1600", src, "--out", dst], { timeout: 30_000 });
    return await readFile(dst);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function pdfText(data: string) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "sparkflow-pdf-"));
  try {
    const src = path.join(dir, "in.pdf");
    await writeFile(src, Buffer.from(data, "base64"));
    const { stdout } = await run("pdftotext", ["-layout", "-l", "30", src, "-"], { timeout: 30_000, maxBuffer: 8 * 1024 * 1024 });
    return stdout.trim();
  } catch {
    return "";
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

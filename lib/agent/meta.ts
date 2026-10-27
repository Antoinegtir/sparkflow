import { museKey } from "./llm";
import type { LLMProvider } from "./llm/types";

const base = () => process.env.MUSE_BASE_URL ?? "https://api.meta.ai/v1";

export const metaMediaAvailable = (provider: LLMProvider) => !!museKey() && provider.name !== "mock";

export const IMAGE_SIZES = { square: "1024x1024", portrait: "768x1344", landscape: "1344x768" } as const;

/** Muse Image: one PNG for a prompt. */
export async function generateImage(prompt: string, aspect: keyof typeof IMAGE_SIZES, signal?: AbortSignal): Promise<Buffer> {
  const res = await fetch(`${base()}/images/generations`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${museKey()}` },
    body: JSON.stringify({
      model: process.env.MUSE_IMAGE_MODEL ?? "muse-image-1.0",
      prompt,
      n: 1,
      size: IMAGE_SIZES[aspect],
      response_format: "b64_json",
      output_format: "png",
    }),
    signal,
  });
  if (!res.ok) throw new Error(`Muse Image ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const item = json.data?.[0];
  if (item?.b64_json) return Buffer.from(item.b64_json, "base64");
  if (item?.url) return Buffer.from(await (await fetch(item.url, { signal })).arrayBuffer());
  throw new Error("Muse Image returned no image");
}

export type Segment = { label: string; x1: number; y1: number; x2: number; y2: number; w: number; h: number };

export const UI_CONCEPTS = [
  "button", "text input field", "card", "list row", "icon", "image or photo placeholder",
  "heading text", "bottom tab bar", "toggle switch", "chart",
];

const BOX = /<\|box;x1=([\d.]+);y1=([\d.]+);x2=([\d.]+);y2=([\d.]+);w=([\d.]+);h=([\d.]+)\|>/g;

/** SAM 3.1: one request per concept, in parallel. Boxes in image pixels. */
export async function segmentUI(image: { mediaType: string; data: string }, concepts = UI_CONCEPTS, signal?: AbortSignal): Promise<Segment[]> {
  const results = await Promise.allSettled(
    concepts.map(async (label) => {
      const res = await fetch(`${base()}/responses`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${museKey()}` },
        body: JSON.stringify({
          model: process.env.SAM_MODEL ?? "sam-3.1",
          input: [
            {
              role: "user",
              content: [
                { type: "input_text", text: label },
                { type: "input_image", image_url: `data:${image.mediaType};base64,${image.data}` },
              ],
            },
          ],
          metadata: { mask_encoding: "one_bit" },
        }),
        signal,
      });
      if (!res.ok) throw new Error(`SAM ${res.status}`);
      const text = JSON.stringify(await res.json());
      return [...text.matchAll(BOX)].map((m) => {
        const [x1, y1, x2, y2, w, h] = m.slice(1).map(Number);
        return { label, x1, y1, x2, y2, w, h };
      });
    }),
  );
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

/** Boxes as text for the planner, positions in % of the image, top to bottom. */
export function describeSegments(segs: Segment[]) {
  const pct = (v: number, of: number) => Math.round((v / (of || 1)) * 100);
  return segs
    .slice()
    .sort((a, b) => a.y1 - b.y1)
    .slice(0, 60)
    .map((s) => `- ${s.label}: x ${pct(s.x1, s.w)}–${pct(s.x2, s.w)}%, y ${pct(s.y1, s.h)}–${pct(s.y2, s.h)}%`)
    .join("\n");
}

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

/** The PCM samples and rate of a WAV (the browser sends 16 kHz mono 16-bit). */
function wavPcm(wav: Buffer) {
  let rate = 16000;
  for (let off = 12; off + 8 <= wav.length; ) {
    const id = wav.toString("ascii", off, off + 4);
    const size = wav.readUInt32LE(off + 4);
    if (id === "fmt ") rate = wav.readUInt32LE(off + 12);
    if (id === "data") return { pcm: wav.subarray(off + 8, off + 8 + size), rate };
    off += 8 + size + (size % 2);
  }
  throw new Error("Not a WAV file");
}

/**
 * Muse Voice Transcribe: the words spoken in a WAV. The model is realtime (a WebSocket that takes 80 ms
 * frames of 16-bit PCM); a recording is sent whole, then the stream is ended and the final text kept.
 */
export function transcribeSpeech(wav: Buffer, signal?: AbortSignal): Promise<string> {
  const { pcm, rate } = wavPcm(wav);
  if (rate !== 16000 && rate !== 24000) return Promise.reject(new Error(`Muse Voice Transcribe takes 16 or 24 kHz audio, not ${rate} Hz`));
  const url = new URL("/v1/asr/realtime", base());
  url.protocol = url.protocol === "http:" ? "ws:" : "wss:";
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const finals: string[] = [];
    let partial = "";
    let settled = false;
    const settle = (err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (ws.readyState <= WebSocket.OPEN) ws.close();
      if (err) reject(err);
      else resolve([...finals, partial].join(" ").replace(/\s+/g, " ").trim());
    };
    const abort = () => settle(new Error("Transcription aborted"));
    const timer = setTimeout(() => settle(new Error("Muse Voice Transcribe timed out")), 30_000);
    signal?.addEventListener("abort", abort);
    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          authorization: { accessToken: `Bearer ${museKey()}` },
          audioEncoding: rate === 16000 ? "PCM_16KHZ" : "PCM_24KHZ",
          model: process.env.MUSE_TRANSCRIBE_MODEL ?? "muse-voice-transcribe-1.0",
          mode: "PUSH_TO_TALK",
          partialMode: "CUMULATIVE",
          emitAudioProgress: false,
        }),
      );
      const frame = (rate * 2 * 80) / 1000;
      for (let i = 0; i < pcm.length; i += frame) ws.send(pcm.subarray(i, i + frame));
      ws.send(JSON.stringify({ type: "endStream" }));
    };
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data)) as { type?: string; transcript?: string; final?: boolean; message?: string };
      if (m.type === "error") return settle(new Error(`Muse Voice Transcribe: ${m.message ?? "error"}`));
      if (m.type !== "transcript" && m.type !== "speechComplete") return;
      // Partials are cumulative within a turn; a final one closes the turn.
      if (m.final || m.type === "speechComplete") {
        finals.push(m.transcript ?? "");
        partial = "";
      } else partial = m.transcript ?? "";
    };
    ws.onclose = (e) => settle(e.code === 1000 ? undefined : new Error(`Muse Voice Transcribe closed (${e.code}${e.reason ? `: ${e.reason}` : ""})`));
    ws.onerror = () => settle(new Error("Muse Voice Transcribe: connection failed"));
  });
}

export type Segment ={ label: string; x1: number; y1: number; x2: number; y2: number; w: number; h: number };

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

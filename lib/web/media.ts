import type { MediaInput } from "../shared";

const MAX_SIDE = 1600;

const toBase64 = (buf: ArrayBuffer) => {
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

/** Image file → base64 input. Large or exotic images are re-encoded as JPEG (max 1600 px). */
/**
 * Files a prompt takes (a sketch, a screenshot, an iPhone photo, a spec): pictures, HEIC, PDF, Markdown
 * or text, 10 MB each, 8 at most. The server turns each into what the model reads (lib/agent/attachments.ts).
 */
export const ATTACH_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif,.heic,.heif,application/pdf,.pdf,text/markdown,.md,.markdown,text/plain,.txt";
export const MAX_ATTACH_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS = 8;
const KINDS = /\.(png|jpe?g|webp|gif|heic|heif|pdf|md|markdown|txt)$/i;

/** Why this file can't be attached to a prompt, or null when it can. */
export function attachProblem(f: { name: string; type: string; size: number }): string | null {
  if (!KINDS.test(f.name) && !/^image\/(png|jpeg|webp|gif|hei[cf])$|^application\/pdf$|^text\/(markdown|plain)$/.test(f.type))
    return `${f.name}: only images (PNG, JPEG, WebP, GIF, HEIC), PDF or Markdown files can be attached.`;
  if (f.size > MAX_ATTACH_BYTES) return `${f.name} is ${(f.size / 1024 / 1024).toFixed(1)} MB: 10 MB at most.`;
  return null;
}

/** A file as a prompt attachment, keeping its name: pictures resized (imageToInput), the rest as they are. */
export async function fileToAttachment(f: File): Promise<MediaInput> {
  if (/^image\/(png|jpeg|webp|gif)$/.test(f.type)) return { ...(await imageToInput(f)), name: f.name };
  const type = f.type || (/\.pdf$/i.test(f.name) ? "application/pdf" : /\.hei[cf]$/i.test(f.name) ? "image/heic" : /\.(md|markdown)$/i.test(f.name) ? "text/markdown" : "text/plain");
  return { mediaType: type, data: toBase64(await f.arrayBuffer()), name: f.name };
}

export async function imageToInput(file: Blob & { name?: string }): Promise<MediaInput> {
  const bitmap = await createImageBitmap(file);
  const small = Math.max(bitmap.width, bitmap.height) <= MAX_SIDE;
  if (small && file.size < 2_000_000 && /^image\/(png|jpeg|webp)$/.test(file.type)) {
    bitmap.close();
    return { mediaType: file.type, data: toBase64(await file.arrayBuffer()), name: file.name };
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), "image/jpeg", 0.88));
  return { mediaType: "image/jpeg", data: toBase64(await blob.arrayBuffer()), name: file.name };
}

/** Any recorded audio → 16 kHz mono 16-bit WAV (the model accepts wav or mp3 only). */
export async function blobToWav(blob: Blob): Promise<MediaInput> {
  const ctx = new AudioContext();
  const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  await ctx.close();
  const rate = 16000;
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * rate), rate);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const pcm = (await offline.startRendering()).getChannelData(0);
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + pcm.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true);
  return { mediaType: "audio/wav", data: toBase64(buf), name: "voice.wav" };
}


export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.start();
  return {
    stop: () =>
      new Promise<Blob>((resolve) => {
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          resolve(new Blob(chunks, { type: rec.mimeType }));
        };
        rec.stop();
      }),
    cancel: () => {
      rec.stop();
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}

export const timeAgo = (ts: number) => {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};

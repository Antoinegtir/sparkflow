import { z } from "zod";
import { createProvider } from "@/lib/agent/llm";
import { transcribeSpeech } from "@/lib/agent/meta";
import { MediaInputSchema } from "@/lib/shared";
import { handle } from "@/lib/web/server";

export const dynamic = "force-dynamic";

const Body = z.object({ audio: MediaInputSchema });

/**
 * Speech to text for the dictation in the prompt boxes, called while you talk: Muse Voice Transcribe, and the
 * audio-capable Muse Spark if it can't be reached.
 */
export const POST = handle(async (req: Request) => {
  const { audio } = Body.parse(await req.json());
  const provider = createProvider();
  if (provider.name !== "muse") return Response.json({ error: "Set MODEL_API_KEY to dictate with Muse." }, { status: 503 });
  try {
    return Response.json({ text: await transcribeSpeech(Buffer.from(audio.data, "base64"), req.signal), model: "muse-voice-transcribe-1.0" });
  } catch (e) {
    if (req.signal.aborted) throw e;
    console.warn(`[transcribe] ${e instanceof Error ? e.message : e}; falling back to Muse Spark audio`);
  }
  const model = provider.modelFor("other", { hasAudio: true });
  const res = await provider.chat({
    role: "other",
    model,
    maxTokens: 1024,
    messages: [
      {
        role: "system",
        content: "You are a speech-to-text engine. Transcribe the audio verbatim in the language spoken, with natural punctuation. Output only the transcript, nothing else. If there is no speech, output nothing.",
      },
      { role: "user", content: [{ type: "audio", format: "wav", data: audio.data }, { type: "text", text: "Transcribe." }] },
    ],
  });
  return Response.json({ text: (res.content ?? "").trim(), model });
});

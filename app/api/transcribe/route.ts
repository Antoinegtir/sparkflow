import { z } from "zod";
import { createProvider } from "@/lib/agent/llm";
import { MediaInputSchema } from "@/lib/shared";
import { handle } from "@/lib/web/server";

export const dynamic = "force-dynamic";

const Body = z.object({ audio: MediaInputSchema });

/** Speech to text with Meta's audio-capable Muse model: the dictation in the prompt box calls this while you talk. */
export const POST = handle(async (req: Request) => {
  const { audio } = Body.parse(await req.json());
  const provider = createProvider();
  if (provider.name !== "muse") return Response.json({ error: "Set MODEL_API_KEY to dictate with Muse." }, { status: 503 });
  const res = await provider.chat({
    role: "other",
    model: provider.modelFor("other", { hasAudio: true }),
    maxTokens: 1024,
    messages: [
      {
        role: "system",
        content: "You are a speech-to-text engine. Transcribe the audio verbatim in the language spoken, with natural punctuation. Output only the transcript, nothing else. If there is no speech, output nothing.",
      },
      { role: "user", content: [{ type: "audio", format: "wav", data: audio.data }, { type: "text", text: "Transcribe." }] },
    ],
  });
  return Response.json({ text: (res.content ?? "").trim() });
});

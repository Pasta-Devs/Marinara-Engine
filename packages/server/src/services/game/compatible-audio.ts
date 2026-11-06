import { safeFetch } from "../../utils/security.js";

/** Explicit, bounded contracts for user-configured endpoints; never follows provider result URLs. */
export async function generateCompatibleGameAudio(input: {
  baseUrl: string;
  endpoint: string;
  apiKey: string;
  model: string;
  format: string;
  prompt: string;
  duration: number;
  allowLocal: boolean;
  timeoutMs: number;
  maxBytes: number;
  signal?: AbortSignal;
}): Promise<Uint8Array> {
  const base = new URL(`${input.baseUrl.replace(/\/+$/, "")}/`);
  // Paths are relative to the configured API base, retaining e.g. /v1.
  const url = new URL(input.endpoint.replace(/^\/+/, ""), base);
  if (url.origin !== base.origin || url.username || url.password || url.search || url.hash) {
    throw new Error("Audio generation endpoint must be a path on the configured connection");
  }
  const chat = input.format === "chat_completions";
  const response = await safeFetch(url.href, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(input.apiKey ? { Authorization: `Bearer ${input.apiKey}` } : {}),
    },
    body: JSON.stringify(
      chat
        ? {
            model: input.model,
            messages: [{ role: "user", content: input.prompt }],
            stream: false,
            audio_config: { duration: input.duration, instrumental: true, format: "mp3" },
          }
        : {
            model: input.model,
            prompt: input.prompt,
            duration: input.duration,
            response_format: "mp3",
          },
    ),
    signal: input.signal
      ? AbortSignal.any([input.signal, AbortSignal.timeout(input.timeoutMs)])
      : AbortSignal.timeout(input.timeoutMs),
    policy: { allowLocal: input.allowLocal, allowedProtocols: input.allowLocal ? ["http:", "https:"] : ["https:"] },
    maxResponseBytes: chat ? Math.ceil((input.maxBytes * 4) / 3) + 64_000 : input.maxBytes,
    decodeCompressedResponse: true,
  });
  if (!response.ok) throw new Error(`Audio generation endpoint returned HTTP ${response.status}`);
  if (!chat) return new Uint8Array(await response.arrayBuffer());
  const body = (await response.json()) as {
    choices?: { message?: { audio?: { data?: string } | { audio_url?: { url?: string } }[] } }[];
  };
  const audio = body.choices?.[0]?.message?.audio;
  const encoded = Array.isArray(audio)
    ? audio[0]?.audio_url?.url?.match(/^data:audio\/[a-z0-9.+-]+;base64,([A-Za-z0-9+/=]+)$/i)?.[1]
    : audio?.data;
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length > Math.ceil((input.maxBytes * 4) / 3)) {
    throw new Error("Audio generation endpoint returned no supported inline audio");
  }
  const bytes = new Uint8Array(Buffer.from(encoded, "base64"));
  if (!bytes.length || bytes.length > input.maxBytes) throw new Error("Generated audio exceeds the size limit");
  return bytes;
}

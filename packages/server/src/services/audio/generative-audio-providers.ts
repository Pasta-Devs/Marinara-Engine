import { setTimeout as delay } from "node:timers/promises";
import { isTtsLocalUrlsEnabled } from "../../config/runtime-config.js";
import { safeFetch, validateOutboundUrl } from "../../utils/security.js";
import { generateCompatibleGameAudio } from "../game/compatible-audio.js";
import { detectTTSAudioMimeType } from "./audio-content-type.js";
import { sanitizeApiError } from "../llm/base-provider.js";
import { privateErrorLogFields } from "../../lib/logger.js";

export interface GenerativeAudioProviderConfig {
  source: "elevenlabs" | "sunoapi" | "custom";
  baseUrl: string;
  apiKey: string;
  model: string;
  soundEffectsModel?: string | null;
  callbackUrl?: string | null;
  musicEndpoint?: string | null;
  soundEffectsEndpoint?: string | null;
  responseFormat?: string | null;
  requestFormat?: "binary" | "chat_completions";
}

export interface GenerateAudioBytesOptions {
  lengthMs?: number;
  signal?: AbortSignal;
  debugLog?: (label: string, payload: unknown) => void;
}

const MAX_AUDIO_BYTES = 60 * 1024 * 1024;
const DEADLINE_MS = 300_000;
const PUBLIC_HTTPS = { allowLocal: false, allowLoopback: false, allowMdns: false, allowedProtocols: ["https:"] };
const MAX_ERROR_BYTES = 16 * 1024;
const PROVIDER_ERROR_CODES = new Set([
  "invalid_api_key",
  "quota_exceeded",
  "model_not_found",
  "invalid_model_id",
  "invalid_request",
  "unauthorized",
  "rate_limit_exceeded",
  "too_many_concurrent_requests",
]);

export class AudioGenerationProviderError extends Error {
  readonly [privateErrorLogFields]: { type: string; status: number };
  constructor(
    source: "elevenlabs" | "sunoapi",
    readonly providerStatus: number,
    readonly reason?: string,
    readonly providerCode?: string,
  ) {
    super(`${source === "elevenlabs" ? "ElevenLabs" : "SunoAPI"} audio request returned HTTP ${providerStatus}`);
    this[privateErrorLogFields] = { type: "AudioGenerationProviderError", status: providerStatus };
  }
}

/** Read only a small JSON error envelope; never expose raw bodies or echoed connection secrets. */
async function providerRejection(
  response: Response,
  config: GenerativeAudioProviderConfig & { source: "elevenlabs" | "sunoapi" },
  signal: AbortSignal,
): Promise<AudioGenerationProviderError> {
  const fallback = () => new AudioGenerationProviderError(config.source, response.status);
  const reader = response.body?.getReader();
  if (!reader) return fallback();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_ERROR_BYTES) return fallback();
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  signal.throwIfAborted();
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fallback();
    body = parsed as Record<string, unknown>;
  } catch {
    return fallback();
  }
  const detail = body?.detail;
  const detailObject = detail && typeof detail === "object" ? (detail as Record<string, unknown>) : undefined;
  const errorObject =
    body.error && typeof body.error === "object" ? (body.error as Record<string, unknown>) : undefined;
  const message =
    detailObject?.message ??
    (typeof detail === "string" ? detail : undefined) ??
    (Array.isArray(detail)
      ? detail
          .map((entry) => entry?.msg)
          .filter((msg) => typeof msg === "string")
          .join("; ")
      : undefined) ??
    errorObject?.message ??
    (typeof body.error === "string" && !PROVIDER_ERROR_CODES.has(body.error) ? body.error : undefined) ??
    body?.message ??
    body?.msg;
  let reason = typeof message === "string" ? sanitizeApiError(message, message.length) : "";
  const secrets = [config.apiKey, config.apiKey.trim(), config.baseUrl, config.callbackUrl]
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => b.length - a.length);
  for (const secret of secrets) reason = reason.replaceAll(secret, "[redacted]");
  reason = reason
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[redacted URL]")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
  const code = detailObject?.status ?? errorObject?.code ?? body.code ?? body.error;
  return new AudioGenerationProviderError(
    config.source,
    response.status,
    reason || undefined,
    typeof code === "string" && PROVIDER_ERROR_CODES.has(code) ? code : undefined,
  );
}

/** Match the provider's music prerequisite without submitting a composition. */
export async function validateSunoMusicCallback(callbackUrl?: string | null): Promise<void> {
  if (!callbackUrl) throw new Error("SunoAPI music requires a public HTTPS callback URL, even when polling");
  const callback = new URL(callbackUrl);
  if (callback.username || callback.password)
    throw new Error("Use a SunoAPI callback URL without embedded credentials");
  await validateOutboundUrl(callbackUrl, PUBLIC_HTTPS);
}

function providerUrl(config: GenerativeAudioProviderConfig, path: string): URL {
  const base = new URL(config.baseUrl);
  if (base.username || base.password || base.search || base.hash)
    throw new Error("Use an audio API base without credentials or query parameters");
  const prefix = config.source === "sunoapi" ? "/api/v1" : "/v1";
  let root = base.pathname.replace(/\/+$/, "");
  if (root.endsWith(prefix)) root = root.slice(0, -prefix.length);
  return new URL(`${root}${prefix}${path}`, base.origin);
}

function mp3(bytes: Uint8Array): Buffer {
  if (!bytes.length || bytes.length > MAX_AUDIO_BYTES) throw new Error("Generated audio exceeds the 60 MiB size limit");
  if (detectTTSAudioMimeType(bytes) !== "audio/mpeg") throw new Error("Audio provider returned no valid MP3 audio");
  return Buffer.from(bytes);
}

/** MP3-only generation. No paid POST is retried, and result downloads never receive provider credentials.
 * Official contracts: elevenlabs.io/docs/api-reference/music/compose, /text-to-sound-effects/convert;
 * docs.sunoapi.org/suno-api/{generate-music,generate-sounds,get-music-generation-details}.
 * Sounds returns a taskId without a separate documented lookup: the shared record-info lookup is
 * a bounded integration inference. An API rejection is surfaced; live paid-provider behavior is unverified.
 */
export async function generateAudioBytes(
  config: GenerativeAudioProviderConfig,
  kind: "sfx" | "music",
  prompt: string,
  options: GenerateAudioBytesOptions = {},
): Promise<Buffer> {
  const signal = options.signal
    ? AbortSignal.any([options.signal, AbortSignal.timeout(DEADLINE_MS)])
    : AbortSignal.timeout(DEADLINE_MS);
  signal.throwIfAborted();
  if (options.lengthMs !== undefined && (!Number.isFinite(options.lengthMs) || options.lengthMs <= 0)) {
    throw new Error("Audio length must be a positive number of milliseconds");
  }
  if (config.responseFormat && config.responseFormat !== "mp3")
    throw new Error("Audio generation stores MP3 audio only");
  const model =
    kind === "sfx"
      ? config.soundEffectsModel || (config.source === "elevenlabs" ? "eleven_text_to_sound_v2" : config.model)
      : config.model;
  options.debugLog?.("audio/provider-prompt", { source: config.source, kind, model, prompt });

  if (config.source === "custom") {
    const endpoint = kind === "music" ? config.musicEndpoint : config.soundEffectsEndpoint;
    if (!endpoint?.trim())
      throw new Error(`Configure the custom ${kind === "music" ? "music" : "sound-effects"} endpoint`);
    return mp3(
      await generateCompatibleGameAudio({
        baseUrl: config.baseUrl,
        endpoint,
        apiKey: config.apiKey,
        model,
        format: config.requestFormat ?? "binary",
        prompt,
        duration: (options.lengthMs ?? (kind === "music" ? 30_000 : 5_000)) / 1000,
        allowLocal: isTtsLocalUrlsEnabled(),
        timeoutMs: DEADLINE_MS,
        maxBytes: MAX_AUDIO_BYTES,
        signal,
      }),
    );
  }

  const source = config.source;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(config.source === "elevenlabs"
      ? { "xi-api-key": config.apiKey }
      : { Authorization: `Bearer ${config.apiKey}` }),
  };
  const api = async (path: string, body?: Record<string, unknown>) => {
    signal.throwIfAborted();
    const url = providerUrl(config, path);
    const response = await safeFetch(url, {
      method: body ? "POST" : "GET",
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal,
      policy: { ...PUBLIC_HTTPS, allowedOrigins: [url.origin], maxRedirects: 0 },
      maxResponseBytes: config.source === "elevenlabs" ? MAX_AUDIO_BYTES : 2 * 1024 * 1024,
      decodeCompressedResponse: true,
    });
    if (!response.ok) throw await providerRejection(response, { ...config, source }, signal);
    return response;
  };

  if (config.source === "elevenlabs") {
    const lengthMs = options.lengthMs ?? (kind === "music" ? 30_000 : 5_000);
    if (kind === "music" ? lengthMs < 3_000 || lengthMs > 600_000 : lengthMs < 500 || lengthMs > 30_000) {
      throw new Error(
        kind === "music"
          ? "ElevenLabs music length must be 3–600 seconds"
          : "ElevenLabs sound effects length must be 0.5–30 seconds",
      );
    }
    const response = await api(
      `${kind === "music" ? "/music" : "/sound-generation"}?output_format=mp3_44100_128`,
      kind === "music"
        ? { prompt, model_id: model || "music_v1", music_length_ms: lengthMs, force_instrumental: true }
        : {
            text: prompt,
            model_id: model || "eleven_text_to_sound_v2",
            duration_seconds: lengthMs / 1000,
            prompt_influence: 0.3,
          },
    );
    return mp3(new Uint8Array(await response.arrayBuffer()));
  }

  if (prompt.length > (kind === "music" ? 1000 : 500))
    throw new Error(
      `SunoAPI ${kind === "music" ? "music style" : "sound-effects prompt"} exceeds ${kind === "music" ? 1000 : 500} characters`,
    );
  const body: Record<string, unknown> =
    kind === "music"
      ? { customMode: true, instrumental: true, style: prompt, model: model || "V6" }
      : { prompt, model: model || "V6", soundLoop: false };
  if (kind === "music") {
    await validateSunoMusicCallback(config.callbackUrl);
    body.callBackUrl = config.callbackUrl;
    if (options.lengthMs !== undefined) {
      if (options.lengthMs < 10_000 || options.lengthMs > 360_000)
        throw new Error("SunoAPI music length must be 10–360 seconds");
      // Older models remain accepted by SunoAPI for compatibility, but cannot
      // take a duration hint. Let those models choose their normal track length.
      if (/^(V5_5|V6|V6_MINI|V6_WILD)$/.test(String(body.model))) body.duration = options.lengthMs / 1000;
    }
  }
  const submitted = (await (await api(kind === "music" ? "/generate" : "/generate/sounds", body)).json()) as {
    code?: number;
    data?: { taskId?: string };
  };
  if (submitted.code !== 200 || !submitted.data?.taskId)
    throw new Error("SunoAPI did not accept the audio generation task");
  const taskId = submitted.data.taskId;
  while (true) {
    signal.throwIfAborted();
    const result = (await (await api(`/generate/record-info?taskId=${encodeURIComponent(taskId)}`)).json()) as {
      code?: number;
      data?: { status?: string; response?: { sunoData?: Array<{ audio_url?: string }> } };
    };
    if (result.code !== 200) throw new Error("SunoAPI could not look up the submitted audio task");
    const status = result.data?.status;
    if (status === "SUCCESS") {
      const url = result.data?.response?.sunoData?.find(
        (track) => typeof track.audio_url === "string" && track.audio_url,
      )?.audio_url;
      if (!url) throw new Error("SunoAPI completed the task without an audio download");
      const downloadUrl = new URL(url);
      if (downloadUrl.username || downloadUrl.password)
        throw new Error("SunoAPI audio download URL contains credentials");
      const response = await safeFetch(downloadUrl, {
        signal,
        policy: PUBLIC_HTTPS,
        maxResponseBytes: MAX_AUDIO_BYTES,
        decodeCompressedResponse: true,
      });
      if (!response.ok) throw new Error(`SunoAPI audio download returned HTTP ${response.status}`);
      return mp3(new Uint8Array(await response.arrayBuffer()));
    }
    if (!["PENDING", "TEXT_SUCCESS", "FIRST_SUCCESS"].includes(status ?? ""))
      throw new Error("SunoAPI audio task failed or returned an unsupported status");
    await delay(1500, undefined, { signal });
  }
}

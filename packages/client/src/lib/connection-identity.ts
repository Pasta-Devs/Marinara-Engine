import {
  IMAGE_GENERATION_SOURCES,
  PROVIDERS,
  VIDEO_GENERATION_SOURCES,
  type APIProvider,
} from "@marinara-engine/shared";

export type ConnectionIdentityRow = {
  provider?: string | null;
  model?: string | null;
  imageGenerationSource?: string | null;
  imageService?: string | null;
  videoGenerationSource?: string | null;
  videoService?: string | null;
  audioSource?: string | null;
};

export type ConnectionIdentityValue = {
  /** Provider or media-service label, shared by every view of the Connection. */
  name: string;
  /** A user-supplied Connection name. Generated service/endpoint names are omitted. */
  accountLabel: string | null;
  /** Host only, without scheme or path. */
  endpoint: string;
  /** Raw media source id for the service icon, or null for a chat Connection. */
  service: string | null;
};

const AUDIO_SERVICE_NAMES: Record<string, string> = {
  elevenlabs: "ElevenLabs",
  openai: "OpenAI-compatible",
  pockettts: "PocketTTS",
  xai: "xAI Voice",
};

function hostOf(url: string | null | undefined): string {
  const value = url?.trim() ?? "";
  if (!value) return "";
  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}

function mediaServiceOf(rows: readonly ConnectionIdentityRow[]): string | null {
  for (const row of rows) {
    const service =
      row.provider === "image_generation"
        ? row.imageService || row.imageGenerationSource
        : row.provider === "video_generation"
          ? row.videoService || row.videoGenerationSource
          : row.provider === "audio"
            ? row.audioSource
            : null;
    if (service) return service;
  }
  return null;
}

function serviceName(service: string | null, provider: string): string {
  if (service) {
    if (provider === "audio" && AUDIO_SERVICE_NAMES[service]) return AUDIO_SERVICE_NAMES[service];
    const source = [...IMAGE_GENERATION_SOURCES, ...VIDEO_GENERATION_SOURCES].find((entry) => entry.id === service);
    if (source) return source.name;
    if (AUDIO_SERVICE_NAMES[service]) return AUDIO_SERVICE_NAMES[service];
  }
  return PROVIDERS[provider as APIProvider]?.name ?? service ?? provider;
}

/**
 * One display identity for Connection headings, editors and pickers. It keeps deliberate custom names while
 * removing names the server generated from the same service and endpoint already shown beside them.
 */
export function getConnectionIdentity(
  account: { name: string; provider: string; baseUrl?: string | null },
  rows: readonly ConnectionIdentityRow[],
): ConnectionIdentityValue {
  // A vendor key can hold chat and media Models together. The chat provider remains the Connection identity;
  // a media source becomes the identity only for a media-only Connection.
  const mediaOnly = ["image_generation", "video_generation", "audio"].includes(account.provider);
  const service = mediaOnly ? mediaServiceOf(rows) : null;
  const providerName = serviceName(service, account.provider);
  const endpoint = hostOf(account.baseUrl);
  const savedName = account.name.trim();
  if (account.provider === "custom") {
    const generated = endpoint ? `Custom · ${endpoint}` : "Custom";
    const generatedName = savedName.localeCompare(generated, undefined, { sensitivity: "accent" }) === 0;
    const tail = savedName.startsWith(`${generated} · …`) ? savedName.slice(generated.length + 3) : null;
    const generatedTail = tail?.length === 5 ? tail : null;
    const name = generatedName || generatedTail ? "Custom" : savedName || "Custom";
    return {
      name,
      accountLabel: generatedTail,
      endpoint: endpoint.localeCompare(name, undefined, { sensitivity: "accent" }) === 0 ? "" : endpoint,
      service: null,
    };
  }
  const generatedNames = [providerName, endpoint, endpoint ? `${providerName} · ${endpoint}` : ""];
  const generatedTail = generatedNames
    .filter(Boolean)
    .map((candidate) => (savedName.startsWith(`${candidate} · …`) ? savedName.slice(candidate.length + 3) : null))
    .find((tail) => tail?.length === 5);
  const automatic = generatedNames.some(
    (candidate) => candidate && candidate.localeCompare(savedName, undefined, { sensitivity: "accent" }) === 0,
  );

  return {
    name: providerName,
    accountLabel: generatedTail ?? (savedName && !automatic ? savedName : null),
    endpoint:
      endpoint && endpoint.localeCompare(providerName, undefined, { sensitivity: "accent" }) !== 0 ? endpoint : "",
    service,
  };
}

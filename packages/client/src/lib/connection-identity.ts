import {
  AUDIO_SOURCE_OPTIONS,
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
  /** The Connection's own name, the title of every view: what tells two OpenAI Connections apart. */
  title: string;
  /** Host only, without scheme or path. */
  endpoint: string;
  /** Raw media source id for the service icon, or null for a chat Connection. */
  service: string | null;
};

const AUDIO_SERVICE_NAMES: Record<string, string> = Object.fromEntries(
  AUDIO_SOURCE_OPTIONS.map((source) => [source.id, source.name]),
);

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

/** A service's display name: a media source's, else its provider's. */
export function serviceName(service: string | null, provider: string): string {
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
      title: generatedTail ? `${name} · ${generatedTail}` : name,
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

  const accountLabel = generatedTail ?? (savedName && !automatic ? savedName : null);
  return {
    name: providerName,
    accountLabel,
    title: generatedTail ? `${providerName} · ${generatedTail}` : (accountLabel ?? providerName),
    endpoint:
      endpoint && endpoint.localeCompare(providerName, undefined, { sensitivity: "accent" }) !== 0 ? endpoint : "",
    service,
  };
}

/** A model id without the gateway upstream its list already heads it with ("NanoGPT/glm" under nanogpt → "glm"). */
export function modelIdLabel(model: string | null | undefined, upstream: string | null = null): string {
  const id = model?.trim() ?? "";
  return upstream && id.toLowerCase().startsWith(`${upstream.toLowerCase()}/`) ? id.slice(upstream.length + 1) : id;
}

/** The one line under a Model's name everywhere: its model id, else its media service. */
export function modelSubtitle(row: ConnectionIdentityRow, upstream: string | null = null): string {
  return (
    modelIdLabel(row.model, upstream) ||
    row.imageService ||
    row.imageGenerationSource ||
    row.videoService ||
    row.videoGenerationSource ||
    ""
  );
}

export type ModelKind = "chat" | "image" | "video" | "voice" | "decision";
/** The order kinds sort in inside a model list. */
export const MODEL_KINDS: readonly ModelKind[] = ["chat", "image", "video", "voice", "decision"];
const KIND_OF_PROVIDER: Record<string, ModelKind> = {
  image_generation: "image",
  video_generation: "video",
  audio: "voice",
  decision: "decision",
};
export const modelKindOf = (provider: string | null | undefined): ModelKind =>
  KIND_OF_PROVIDER[provider ?? ""] ?? "chat";

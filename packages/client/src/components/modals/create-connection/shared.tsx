import { Film, Image as ImageIcon, MessageSquare } from "lucide-react";
import {
  AUDIO_SOURCE_OPTIONS,
  DECISION_SOURCE_BASE_URLS,
  IMAGE_GENERATION_SOURCES,
  IMAGE_SOURCE_VENDOR,
  NATIVE_DECISION_SOURCES,
  VIDEO_GENERATION_SOURCES,
  isChatProvider,
  isLocalAuthProvider,
  speaksOpenAIChat,
  type APIProvider,
  type ConnectionTestErrorCode,
  type DecisionSource,
} from "@marinara-engine/shared";
import { ProviderIcon } from "../../connections/ProviderIcon";
import { JOB } from "../../../lib/connection-jobs";
import { buildOfflineModelIndex, type ModelKind } from "../../../lib/add-model-search";
import type { DeviceItem } from "../../../hooks/use-device-setup";

/** "On this device" (decision 32): built-in parts set up with their own controls, listed here so people find them. */
export type DeviceService = "local_model" | "tts" | "stt";
export type MediaServiceId = `media:${string}` | `audio:${string}` | `decision:${string}`;
export type ServiceId = APIProvider | DeviceService | MediaServiceId | HostedServiceId | typeof DECISION_BUILTIN;
/** The experimental built-in decision model: its tile under "Other" opens its own installer. */
export const DECISION_BUILTIN = "decision_builtin";
/**
 * Online OpenAI-compatible services, set up as a custom address with the service's own key: LinkAPI (Marinara's
 * sponsor) and the free volunteer networks AI Horde and BeaverNet. `anonymousKey` fills the key field of a service
 * that also answers without an account.
 */
export type HostedServiceId = "linkapi" | "aihorde" | "beavernet";
export type HostedService = { name: string; baseUrl: string; keyUrl: string; anonymousKey?: string };
export const HOSTED_SERVICES: Record<HostedServiceId, HostedService> = {
  linkapi: { name: "LinkAPI", baseUrl: "https://linkapi.ai/v1", keyUrl: "https://linkapi.ai/" },
  aihorde: {
    name: "AI Horde",
    baseUrl: "https://oai.aihorde.net/v1",
    keyUrl: "https://aihorde.net/register",
    anonymousKey: "0000000000",
  },
  beavernet: { name: "BeaverNet", baseUrl: "https://net.beaverai.org/v1", keyUrl: "https://net.beaverai.org/account" },
};
export const hostedServiceOf = (service: ServiceId | null): HostedService | null =>
  service && Object.hasOwn(HOSTED_SERVICES, service) ? HOSTED_SERVICES[service as HostedServiceId] : null;
export const DEVICE_ITEMS: Record<DeviceService, DeviceItem> = { local_model: "local-model", tts: "tts", stt: "stt" };
export const isDevice = (service: ServiceId | null): service is DeviceService => !!service && service in DEVICE_ITEMS;
export const isLinkApiUrl = (url: string) => /^https?:\/\/(?:[^/]*\.)?linkapi\.ai(?:[:/]|$)/iu.test(url.trim());
export type Kind = "chat" | "image" | "video" | "voice" | "decision" | "local";
export type AddableKind = "chat" | "image" | "video" | "decision" | "voice";
export type ModelPick = { connectionId: string; modelId: string; kind: AddableKind };

export type MediaBackend = {
  id: MediaServiceId;
  source: string;
  name: string;
  description?: string;
  defaultBaseUrl: string;
  requiresApiKey: boolean;
  image: boolean;
  video: boolean;
  /** A voice or decision source: its Model is an audio or decision row under the Connection. */
  job?: "voice" | "decision";
};
/** Voice and decision sources with no chat service of their own; OpenAI, xAI, OpenRouter… set up through theirs. */
export const JOB_BACKENDS: MediaBackend[] = [
  ...AUDIO_SOURCE_OPTIONS.filter((source) => source.id === "elevenlabs" || source.id === "pockettts").map((source) => ({
    id: `audio:${source.id}` as const,
    source: source.id,
    name: source.name,
    defaultBaseUrl: source.defaultBaseUrl,
    requiresApiKey: source.id === "elevenlabs",
    image: false,
    video: false,
    job: "voice" as const,
  })),
  {
    id: "decision:typesafe",
    source: "typesafe",
    name: "TypeSafe",
    defaultBaseUrl: DECISION_SOURCE_BASE_URLS.typesafe,
    requiresApiKey: true,
    image: false,
    video: false,
    job: "decision",
  },
  // Its own server (named in serviceName): the address is asked for and the key is optional.
  {
    id: "decision:custom",
    source: "custom",
    name: "",
    defaultBaseUrl: "",
    requiresApiKey: true,
    image: false,
    video: false,
    job: "decision",
  },
];
export const JOB_PROVIDER = { voice: "audio", decision: "decision" } as const;

/** Image sources that share a chat service's key or login; Codex images come with the ChatGPT plan. */
export const IMAGE_VENDOR: Record<string, string> = { ...IMAGE_SOURCE_VENDOR, codex_chatgpt: "openai_chatgpt" };
export const VIDEO_SOURCE_VENDOR: Record<string, APIProvider> = {
  google_ai_studio: "google",
  xai: "xai",
  openrouter: "openrouter",
  nanogpt: "nanogpt",
};

/** Media backends without their own chat-service tile. Matching image/video ids share one access tile. */
export const MEDIA_BACKENDS: MediaBackend[] = (() => {
  const bySource = new Map<string, MediaBackend>();
  for (const source of [...IMAGE_GENERATION_SOURCES, ...VIDEO_GENERATION_SOURCES]) {
    if (IMAGE_VENDOR[source.id] || VIDEO_SOURCE_VENDOR[source.id]) continue;
    const current = bySource.get(source.id);
    bySource.set(source.id, {
      id: `media:${source.id}`,
      source: source.id,
      name: current?.name ?? source.name,
      description: current?.description ?? source.description,
      defaultBaseUrl: current?.defaultBaseUrl ?? source.defaultBaseUrl,
      requiresApiKey: (current?.requiresApiKey ?? false) || source.requiresApiKey,
      image: (current?.image ?? false) || IMAGE_GENERATION_SOURCES.some((candidate) => candidate.id === source.id),
      video: (current?.video ?? false) || VIDEO_GENERATION_SOURCES.some((candidate) => candidate.id === source.id),
    });
  }
  return [...bySource.values(), ...JOB_BACKENDS];
})();
export const mediaBackendOf = (service: ServiceId | null) =>
  typeof service === "string" && service.includes(":")
    ? (MEDIA_BACKENDS.find((backend) => backend.id === service) ?? null)
    : null;

export const SERVICE_KINDS: Partial<Record<ServiceId, Kind[]>> = {
  custom: ["chat", "image", "local"],
  linkapi: ["chat", "image"],
  aihorde: ["chat"],
  beavernet: ["chat"],
  local_model: ["local"],
  tts: ["voice", "local"],
  // Dictation is its own job: search finds it, the Voice (Text to speech) filter does not list it.
  stt: ["local"],
  image_generation: ["image"],
  video_generation: ["video"],
  audio: ["voice"],
  // Decision answers yes/no questions for agents.
  decision: ["decision"],
  decision_builtin: ["decision"],
};
/** A speech model id, for the voice step's list (any id can still be typed). */
export const isSpeechModel = (row: { id: string }) => /tts|speech|voice/i.test(row.id);
/** A picker row the provider lists as a decision model. */
export const isDecisionModel = (row: { decision?: true }) => !!row.decision;
/**
 * Chat services with decision models of their own, asked at their own decision API with the account's key, and
 * the decision source their Models use. Other chat services answer decisions through a chat model's
 * log-probabilities. OpenAI can join in the shared table (#9310).
 */
export const NATIVE_DECISION_SOURCE: Partial<Record<ServiceId, DecisionSource>> = NATIVE_DECISION_SOURCES;
/** Speech a chat service's own key buys, as the audio source that speaks to its address. */
export const SPEECH_SOURCE: Partial<Record<APIProvider, string>> = { openai: "openai", xai: "xai", nanogpt: "openai" };
/** Jobs a chat service's Connection also does with its key: decision (chat with log-probabilities) and voice. */
export const jobKindsOf = (service: ServiceId): Kind[] => [
  ...(speaksOpenAIChat(service) || NATIVE_DECISION_SOURCE[service] ? (["decision"] as const) : []),
  ...(SPEECH_SOURCE[service as APIProvider] ? (["voice"] as const) : []),
];
export const kindsOf = (service: ServiceId): Kind[] => {
  const media = mediaBackendOf(service);
  if (media)
    return [
      ...(media.image ? (["image"] as const) : []),
      ...(media.video ? (["video"] as const) : []),
      ...(media.job ? [media.job] : []),
    ];
  if (SERVICE_KINDS[service]) return [...SERVICE_KINDS[service]!, ...jobKindsOf(service)];
  if (isDevice(service)) return SERVICE_KINDS[service] ?? ["local"];
  const provider = service as APIProvider;
  return [
    ...(isChatProvider(provider) ? (["chat"] as const) : []),
    ...(Object.values(IMAGE_VENDOR).includes(provider) ? (["image"] as const) : []),
    ...(Object.values(VIDEO_SOURCE_VENDOR).includes(provider) ? (["video"] as const) : []),
    ...jobKindsOf(provider),
  ];
};
export const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Image, video and voice tools and decision servers that run on a server the user runs (or rents). */
export const SELF_HOSTED = new Set([
  "comfyui",
  "automatic1111",
  "swarmui",
  "drawthings",
  "runpod_comfyui",
  "pockettts",
  "custom",
]);
/** The Add window's sections, in order. Known names first; "All providers" sorts A–Z. */
export type ServiceGroupDefinition = {
  id: "popular" | "plan" | "local" | "all";
  services: ServiceId[];
  sorted?: boolean;
};
export const SERVICE_GROUPS: ServiceGroupDefinition[] = [
  { id: "popular", services: ["linkapi", "nanogpt", "openrouter", "openai", "anthropic", "google", "custom"] },
  { id: "plan", services: ["openai_chatgpt", "claude_subscription", "grok_subscription"] },
  {
    id: "local",
    services: ["local_model", ...MEDIA_BACKENDS.filter((b) => SELF_HOSTED.has(b.source)).map((b) => b.id)],
  },
  {
    id: "all",
    sorted: true,
    services: [
      ...(["xai", "mistral", "cohere", "deepseek", "zai", "arli", "aihorde", "beavernet"] as const),
      "google_vertex",
      ...MEDIA_BACKENDS.filter((backend) => !SELF_HOSTED.has(backend.source)).map((backend) => backend.id),
      "tts",
      "stt",
      DECISION_BUILTIN,
    ],
  },
];
export const VENDORS_SHOWN = 4;
/** Old names people still search for. */
export const SEARCH_ALIASES: Partial<Record<ServiceId, string>> = {
  openai_chatgpt: "codex",
  aihorde: "stable horde kobold kudos",
  local_model: "local built-in built in sidecar llama gguf offline free device no account",
};
export const KIND_ICONS = {
  chat: MessageSquare,
  image: ImageIcon,
  video: Film,
  voice: JOB.voice.icon,
  decision: JOB.decision.icon,
} as const;
export type ChipKind = keyof typeof KIND_ICONS;
export const CHIP_KINDS: ChipKind[] = ["chat", "image", "video", "voice", "decision"];
export const MODEL_CHIP_KINDS = new Set<ChipKind>(["chat", "image", "video"]);
/** Vendors and plans with an offline model list, in the order "A specific model…" picks from. */
export const MODEL_SERVICES: APIProvider[] = [
  "anthropic",
  "openai",
  "google",
  "xai",
  "deepseek",
  "mistral",
  "cohere",
  "zai",
  "google_vertex",
  "claude_subscription",
  "openai_chatgpt",
  "grok_subscription",
];
export const OFFLINE_MODELS = buildOfflineModelIndex(MODEL_SERVICES);
export const MODELS_SHOWN = 6;
export const rowKind = (provider?: string): ModelKind | null =>
  isChatProvider(provider ?? "")
    ? "chat"
    : provider === "image_generation"
      ? "image"
      : provider === "video_generation"
        ? "video"
        : null;

/** Common ports of local servers; one tap fills the address. Brand names are not translated. */
export const LOCAL_PRESETS = [
  { label: "Ollama", url: "http://localhost:11434/v1" },
  { label: "LM Studio", url: "http://localhost:1234/v1" },
  { label: "KoboldCpp", url: "http://localhost:5001/v1" },
  { label: "llama.cpp", url: "http://localhost:8080/v1" },
];

/** The command that logs a plan in on the computer that runs Marinara. */
export const LOGIN_COMMANDS: Partial<Record<APIProvider, string>> = {
  claude_subscription: "claude login",
  openai_chatgpt: "codex login",
  grok_subscription: "grok login",
};

/** Gateways have no fixed model list worth recommending; vendors and plans do. */
export const NO_RECOMMENDED = new Set<APIProvider>(["openrouter", "nanogpt", "custom", "arli"]);

/** `autoName`: the name the server chose, when the user typed none. */
export type Target = {
  accountId: string;
  connectionId: string;
  fresh: boolean;
  autoName?: string;
  /** Empty Model created by this flow and safe to configure or remove on cancel. */
  placeholderId?: string;
  ownedPlaceholderIds?: string[];
  accountBaseUrl?: string;
};
/** The key's end the server adds to an automatic name next to another Connection of the same service. */
export const KEY_TAIL = / · …\S{4}$/u;
export type ConnectionRowLite = {
  id: string;
  name?: string;
  provider?: string;
  baseUrl?: string;
  accountId?: string | null;
  model?: string;
  imageGenerationSource?: string | null;
  imageService?: string | null;
  videoGenerationSource?: string | null;
  videoService?: string | null;
  createdAt?: string | null;
  pinnedModels?: unknown;
  audioVoice?: string | null;
  audioSource?: string | null;
  decisionSource?: string | null;
  comfyuiWorkflow?: string | null;
  defaultParameters?: string | null;
};
/** The source of an audio or decision row; an older row without one uses its container's default. */
export const jobSourceOf = (row: ConnectionRowLite) =>
  row.provider === "audio"
    ? row.audioSource || "elevenlabs"
    : row.provider === "decision"
      ? row.decisionSource || "typesafe"
      : null;

export type TestResult = { success: boolean; message?: string; errorCode?: ConnectionTestErrorCode | null };

export const inputClass = "mari-chrome-field h-11 w-full px-3 text-xs md:h-9";
export const labelClass = "text-xs font-medium text-[var(--muted-foreground)]";
export const PRIMARY_CLASS = "mari-chrome-control mari-chrome-control--primary px-4 text-sm";
export const SECONDARY_CLASS = "mari-chrome-control px-4 text-sm";
export const BADGE_CLASS = "mari-connection-pill";
export const MUTED_BADGE_CLASS = "mari-chrome-muted-badge px-1.5 py-0.5 text-[0.5625rem]";
export const HIGHLIGHT_BADGE_CLASS = "mari-connection-pill mari-connection-pill--blue";

export const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
};

/** A network failure, from the server ("fetch failed") or the browser ("Failed to fetch"). */
export const NETWORK_ERROR =
  /connection failed|fetch failed|failed to fetch|networkerror|load failed|ENOTFOUND|ECONNREFUSED|EAI_AGAIN|timed? ?out/iu;

/** Where a media service's key is made; chat services carry theirs in PROVIDERS. */
export const MEDIA_KEY_URLS: Record<string, string> = {
  stability: "https://platform.stability.ai/account/keys",
  togetherai: "https://api.together.ai/settings/api-keys",
  novelai: "https://novelai.net/",
  venice: "https://venice.ai/settings/api",
  atlas: "https://www.atlascloud.ai/",
  fal: "https://fal.ai/dashboard/keys",
  spicyapi: "https://spicyapi.ai/",
  runpod_comfyui: "https://www.runpod.io/console/user/settings",
  blockentropy: "https://blockentropy.ai/",
  seedance: "https://seedance2.ai/",
  elevenlabs: "https://elevenlabs.io/app/settings/api-keys",
};

/** A plain reason for a failed test; the raw message stays visible below it. */
export function failureReason(
  provider: APIProvider,
  message: string,
  errorCode?: TestResult["errorCode"],
): "plan" | "key" | "busy" | "unreachable" | "other" {
  if (isLocalAuthProvider(provider)) return "plan";
  if (errorCode === "AUTH_REJECTED") return "key";
  const status = /^http_(\d{3})$/u.exec(errorCode ?? "")?.[1] ?? /API returned (\d{3})/u.exec(message)?.[1];
  if (status === "401" || status === "403") return "key";
  if (status === "429") return "busy";
  if (!status && NETWORK_ERROR.test(message)) return "unreachable";
  return "other";
}

/** The service tile: its white brand mark on the brand colour (decision 34c), else an icon or the initials. */
export function ServiceTile({ service, baseUrl, name }: { service: ServiceId; baseUrl?: string; name?: string }) {
  const media = mediaBackendOf(service);
  // A custom address: its brand comes from the URL.
  const hosted = hostedServiceOf(service);
  if (hosted) return <ProviderIcon provider="custom" baseUrl={hosted.baseUrl} name={hosted.name} size="add" />;
  if (service === "custom") return <ProviderIcon provider="custom" baseUrl={baseUrl} name={name} size="add" />;
  if (service === DECISION_BUILTIN) return <ProviderIcon provider="decision" size="add" />;
  return (
    <ProviderIcon
      provider={
        media ? (media.job ? JOB_PROVIDER[media.job] : media.image ? "image_generation" : "video_generation") : service
      }
      service={media?.source}
      size="add"
    />
  );
}

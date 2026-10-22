// ────────────────────────────────────────────────
// Modal: Add connection (service → access with an inline test → star models → ready)
// One screen per step with Back, "Step n of 4" and one primary in the footer; phones get a
// full-screen sheet. Main and "use in this chat" are explicit choices on the last screen.
// ────────────────────────────────────────────────
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cpu,
  KeyRound,
  ListChecks,
  ExternalLink,
  Eye,
  EyeOff,
  Film,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  AUDIO_SOURCE_OPTIONS,
  DECISION_SOURCE_BASE_URLS,
  IMAGE_GENERATION_SOURCES,
  IMAGE_SOURCE_VENDOR,
  MODEL_LISTS,
  PROVIDERS,
  VIDEO_GENERATION_SOURCES,
  inferImageSource,
  inferVideoSource,
  isChatProvider,
  isLocalAuthProvider,
  speaksOpenAIChat,
  withKeyTail,
  type APIProvider,
  type ChatModelChoice,
  type DecisionSource,
  type TTSVoicesResponse,
} from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";
import { SmoothFolderContent } from "../ui/SmoothFolderContent";
import { ListSearch, ListStatus } from "../connections/ListFrame";
import { ServiceRow } from "../connections/ServiceRow";
import { ConnectionModelPicker } from "../connections/ConnectionModelPicker";
import { BrandMark, ProviderIcon } from "../connections/ProviderIcon";
import { StarText } from "../connections/StarText";
import { useConnectionDefaults } from "../connections/ConnectionDefaults";
import { JobRow } from "../connections/JobRow";
import type { ConnectionRowData } from "../connections/ConnectionRow";
import {
  useCachedCatalogFacts,
  useCreateConnection,
  useConnectionModels,
  useConnections,
  useDefaultEmbeddingConnection,
  useDeleteConnection,
  useSetDefaultEmbeddingConnection,
  useTestConnection,
  useUpdateConnection,
} from "../../hooks/use-connections";
import {
  useConnectionAccounts,
  useCreateConnectionAccount,
  useDeleteConnectionAccount,
  useFeatureModels,
  useSetFeatureModels,
  useUpdateConnectionAccount,
} from "../../hooks/use-connection-accounts";
import { useSetChatModel } from "../../hooks/use-chats";
import { useChatStore } from "../../stores/chat.store";
import { useSidecarStore } from "../../stores/sidecar.store";
import { useUIStore } from "../../stores/ui.store";
import { useDeviceSetup, type DeviceItem } from "../../hooks/use-device-setup";
import { flashConnectionCard, type AddFor, type AddJob, type ModelsFor } from "../../lib/add-connection";
import { JOB, JOBS, jobAddKind, jobHintKey, jobLabelKey, matchesKind } from "../../lib/connection-jobs";
import {
  buildOfflineModelIndex,
  keysOf,
  modelKey,
  popularModels,
  searchModels,
  withOwnConnections,
  type ModelEntry,
  type ModelKind,
} from "../../lib/add-model-search";
import { TTSConfigCard } from "../panels/settings/TTSConfigCard";
import { useFollowVoiceJob } from "../../hooks/use-tts";
import { SpeechToTextCard } from "../panels/settings/SpeechToTextCard";
import { LocalWhisper } from "../connections/DeviceDetail";
import { DecisionModelModal } from "./DecisionModelModal";
import { starAnchorOf } from "../../hooks/use-model-star";
import { isConnectionFlagTrue } from "../../lib/connection-filters";
import { cn } from "../../lib/utils";
import { api } from "../../lib/api-client";
import { decisionConnectionTestMessage } from "../../lib/decision-test-message";
import { ttsService } from "../../lib/tts-service";

type ChatMode = "conversation" | "roleplay" | "game";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Preselect a service, for callers that open this to set up one kind of connection or device item. */
  initialService?: ServiceId;
  /** Add model (decision 32): only the model screen, for this Connection (an account id). */
  modelsFor?: ModelsFor;
  /** Opened by the empty new-chat gate: the last screen offers "Start chatting" for this mode. */
  newChatMode?: ChatMode;
  /** Creates the chat with the chosen Model; the gate closes everything when it is done. */
  onStartChat?: (connectionId: string) => Promise<void>;
  /** Add for a job: step 1 starts filtered to it, and Done sets the new Model for it (with Undo). */
  forJob?: AddFor;
}

/** "On this device" (decision 32): built-in parts set up with their own controls, listed here so people find them. */
type DeviceService = "local_model" | "tts" | "stt";
type MediaServiceId = `media:${string}` | `audio:${string}` | `decision:${string}`;
export type ServiceId = APIProvider | DeviceService | MediaServiceId | typeof LINKAPI_SERVICE | typeof DECISION_BUILTIN;
/** The experimental built-in decision model: its tile under "Other" opens its own installer. */
const DECISION_BUILTIN = "decision_builtin";
/** LinkAPI (Marinara's sponsor): an OpenAI-compatible gateway, set up as a custom address with its own key. */
const LINKAPI_SERVICE = "linkapi";
const LINKAPI = { name: "LinkAPI", baseUrl: "https://linkapi.ai/v1", keyUrl: "https://linkapi.ai/" };
const isLinkApiUrl = (url: string) => /^https?:\/\/(?:[^/]*\.)?linkapi\.ai(?:[:/]|$)/iu.test(url.trim());
const DEVICE_ITEMS: Record<DeviceService, DeviceItem> = { local_model: "local-model", tts: "tts", stt: "stt" };
const isDevice = (service: ServiceId | null): service is DeviceService => !!service && service in DEVICE_ITEMS;
type Kind = "chat" | "image" | "video" | "voice" | "decision" | "local";
type AddableKind = "chat" | "image" | "video" | "decision" | "voice";

type MediaBackend = {
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
const JOB_BACKENDS: MediaBackend[] = [
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
const JOB_PROVIDER = { voice: "audio", decision: "decision" } as const;

/** Image sources that share a chat service's key or login; Codex images come with the ChatGPT plan. */
const IMAGE_VENDOR: Record<string, string> = { ...IMAGE_SOURCE_VENDOR, codex_chatgpt: "openai_chatgpt" };
const VIDEO_SOURCE_VENDOR: Record<string, APIProvider> = {
  google_ai_studio: "google",
  xai: "xai",
  openrouter: "openrouter",
  nanogpt: "nanogpt",
};

/** Media backends without their own chat-service tile. Matching image/video ids share one access tile. */
const MEDIA_BACKENDS: MediaBackend[] = (() => {
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
const mediaBackendOf = (service: ServiceId | null) =>
  typeof service === "string" && service.includes(":")
    ? (MEDIA_BACKENDS.find((backend) => backend.id === service) ?? null)
    : null;

const SERVICE_KINDS: Partial<Record<ServiceId, Kind[]>> = {
  custom: ["chat", "local"],
  linkapi: ["chat", "image"],
  local_model: ["local"],
  tts: ["voice", "local"],
  stt: ["voice", "local"],
  image_generation: ["image"],
  video_generation: ["video"],
  audio: ["voice"],
  // Decision answers yes/no questions for agents.
  decision: ["decision"],
  decision_builtin: ["decision"],
};
/** A speech model id, for the voice step's list (any id can still be typed). */
const isSpeechModel = (row: { id: string }) => /tts|speech|voice/i.test(row.id);
/** Speech a chat service's own key buys, as the audio source that speaks to its address. */
const SPEECH_SOURCE: Partial<Record<APIProvider, string>> = { openai: "openai", xai: "xai", nanogpt: "openai" };
/** Jobs a chat service's Connection also does with its key: decision (chat with log-probabilities) and voice. */
const jobKindsOf = (service: ServiceId): Kind[] => [
  ...(speaksOpenAIChat(service) ? (["decision"] as const) : []),
  ...(SPEECH_SOURCE[service as APIProvider] ? (["voice"] as const) : []),
];
const kindsOf = (service: ServiceId): Kind[] => {
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
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Image, video and voice tools and decision servers that run on a server the user runs (or rents). */
const SELF_HOSTED = new Set([
  "comfyui",
  "automatic1111",
  "swarmui",
  "drawthings",
  "runpod_comfyui",
  "pockettts",
  "custom",
]);
/** One tile per provider. Services sort A–Z and show 4 until "Show all"; "Other" folds. */
const SERVICE_GROUPS: Array<{ id: string; services: ServiceId[]; sorted?: boolean; folded?: boolean }> = [
  { id: "start", services: [LINKAPI_SERVICE, "openrouter", "nanogpt"] },
  { id: "plan", services: ["openai_chatgpt", "claude_subscription", "grok_subscription"] },
  {
    id: "vendors",
    sorted: true,
    services: [
      ...(["anthropic", "google", "openai", "xai", "mistral", "cohere", "deepseek", "zai", "arli"] as const),
      "google_vertex",
      ...MEDIA_BACKENDS.filter((backend) => !SELF_HOSTED.has(backend.source)).map((backend) => backend.id),
    ],
  },
  {
    id: "address",
    services: ["custom", ...MEDIA_BACKENDS.filter((backend) => SELF_HOSTED.has(backend.source)).map((b) => b.id)],
  },
  { id: "device", services: ["local_model", "tts", "stt"] },
  { id: "other", folded: true, services: [DECISION_BUILTIN] },
];
const VENDORS_SHOWN = 4;
/** Old names people still search for. */
const SEARCH_ALIASES: Partial<Record<ServiceId, string>> = { openai_chatgpt: "codex" };
const KIND_ICONS = {
  chat: MessageSquare,
  image: ImageIcon,
  video: Film,
  voice: JOB.voice.icon,
  decision: JOB.decision.icon,
} as const;
type ChipKind = keyof typeof KIND_ICONS;
const CHIP_KINDS: ChipKind[] = ["chat", "image", "video", "voice", "decision"];
const MODEL_CHIP_KINDS = new Set<ChipKind>(["chat", "image", "video"]);
/** Vendors and plans with an offline model list, in the order "A specific model…" picks from. */
const MODEL_SERVICES: APIProvider[] = [
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
const OFFLINE_MODELS = buildOfflineModelIndex(MODEL_SERVICES);
const MODELS_SHOWN = 6;
const rowKind = (provider?: string): ModelKind | null =>
  isChatProvider(provider ?? "")
    ? "chat"
    : provider === "image_generation"
      ? "image"
      : provider === "video_generation"
        ? "video"
        : null;

/** Common ports of local servers; one tap fills the address. Brand names are not translated. */
const LOCAL_PRESETS = [
  { label: "Ollama", url: "http://localhost:11434/v1" },
  { label: "LM Studio", url: "http://localhost:1234/v1" },
  { label: "KoboldCpp", url: "http://localhost:5001/v1" },
  { label: "llama.cpp", url: "http://localhost:8080/v1" },
];

/** The command that logs a plan in on the computer that runs Marinara. */
const LOGIN_COMMANDS: Partial<Record<APIProvider, string>> = {
  claude_subscription: "claude login",
  openai_chatgpt: "codex login",
  grok_subscription: "grok login",
};

/** Gateways have no fixed model list worth recommending; vendors and plans do. */
const NO_RECOMMENDED = new Set<APIProvider>(["openrouter", "nanogpt", "custom", "arli"]);

/** `autoName`: the name the server chose, when the user typed none. */
type Target = {
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
const KEY_TAIL = / · …\S{4}$/u;
type ConnectionRowLite = {
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
};
/** The source of an audio or decision row; an older row without one uses its container's default. */
const jobSourceOf = (row: ConnectionRowLite) =>
  row.provider === "audio"
    ? row.audioSource || "elevenlabs"
    : row.provider === "decision"
      ? row.decisionSource || "typesafe"
      : null;

type TestResult = { success: boolean; message?: string };

const inputClass = "mari-chrome-field h-11 w-full px-3 text-xs md:h-9";
const labelClass = "text-xs font-medium text-[var(--muted-foreground)]";
const PRIMARY_CLASS = "mari-connection-btn mari-connection-btn--primary";
const SECONDARY_CLASS = "mari-connection-btn";
const BADGE_CLASS = "mari-connection-pill";
const MUTED_BADGE_CLASS = "mari-chrome-muted-badge px-1.5 py-0.5 text-[0.5625rem]";
const HIGHLIGHT_BADGE_CLASS = "mari-connection-pill mari-connection-pill--blue";

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
};

/** A network failure, from the server ("fetch failed") or the browser ("Failed to fetch"). */
const NETWORK_ERROR =
  /connection failed|fetch failed|failed to fetch|networkerror|load failed|ENOTFOUND|ECONNREFUSED|EAI_AGAIN|timed? ?out/iu;

/** Where a media service's key is made; chat services carry theirs in PROVIDERS. */
const MEDIA_KEY_URLS: Record<string, string> = {
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
};

/** A plain reason for a failed test; the raw message stays visible below it. */
function failureReason(provider: APIProvider, message: string): "plan" | "key" | "busy" | "unreachable" | "other" {
  if (isLocalAuthProvider(provider)) return "plan";
  const status = /API returned (\d{3})/u.exec(message)?.[1];
  if (status === "401" || status === "403") return "key";
  if (status === "429") return "busy";
  if (!status && NETWORK_ERROR.test(message)) return "unreachable";
  return "other";
}

/** The service tile: its white brand mark on the brand colour (decision 34c), else an icon or the initials. */
function ServiceTile({ service }: { service: ServiceId }) {
  const media = mediaBackendOf(service);
  // A custom address: its brand comes from the URL.
  if (service === LINKAPI_SERVICE)
    return <ProviderIcon provider="custom" baseUrl={LINKAPI.baseUrl} name={LINKAPI.name} size="add" />;
  if (service === DECISION_BUILTIN) return <ProviderIcon provider="decision" size="add" />;
  return (
    <ProviderIcon
      provider={media ? (media.image ? "image_generation" : "video_generation") : service}
      service={media?.source}
      size="add"
    />
  );
}

/** Choice card (Agent editor / Download Agents rows): tile, name with up to two badges, a 2-line hint. */
function ServiceCard({
  service,
  name,
  hint,
  kinds,
  badges,
  rail,
  selected,
  onClick,
}: {
  service: ServiceId;
  name: string;
  hint: string;
  /** What it gives, each with its icon. */
  kinds: Array<{ kind: ChipKind; label: string }>;
  badges: Array<{ label: string; highlight?: boolean }>;
  /** Recommended tiles wear the connections' blue start rail. */
  rail?: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-add-connection-service={service}
      onClick={onClick}
      aria-pressed={selected}
      aria-label={name}
      aria-description={[hint, ...kinds.map((item) => item.label), ...badges.map((badge) => badge.label)]
        .filter(Boolean)
        .join(". ")}
      className={cn("mari-chrome-control mari-chrome-control--card min-h-16 p-3 text-xs", rail && "mari-add-tile-rail")}
    >
      <span className="flex min-w-0 items-start gap-3">
        <ServiceTile service={service} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{name}</span>
          {badges.length > 0 && (
            <span className="mt-1 flex flex-wrap items-center gap-1">
              {badges.map((badge) => (
                <span key={badge.label} className={badge.highlight ? HIGHLIGHT_BADGE_CLASS : BADGE_CLASS}>
                  {badge.label}
                </span>
              ))}
            </span>
          )}
          <span className="mt-0.5 line-clamp-2 text-[0.6875rem] leading-snug text-[var(--muted-foreground)]">
            {hint}
          </span>
          {kinds.length > 0 && (
            <span
              aria-hidden
              className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.625rem] font-medium text-[var(--muted-foreground)]"
            >
              {kinds.map(({ kind, label }) => {
                const Icon = KIND_ICONS[kind];
                return (
                  <span key={kind} className="inline-flex items-center gap-1">
                    <Icon size="0.6875rem" />
                    {label}
                  </span>
                );
              })}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

/** A small group label above choice cards; a long group folds behind the same chevron the panel uses. */
function ServiceGroup({
  title,
  count,
  collapsible,
  open,
  onToggle,
  more,
  children,
}: {
  title: string;
  count: number;
  collapsible: boolean;
  open: boolean;
  onToggle: () => void;
  /** A "Show all N" link under a capped list. */
  more?: ReactNode;
  children: ReactNode;
}) {
  const list = <div className="grid grid-cols-1 gap-2 md:grid-cols-2">{children}</div>;
  if (!collapsible) {
    return (
      <section className="flex flex-col gap-1.5">
        <h4 className="px-1 text-xs font-semibold text-[var(--muted-foreground)]">{title}</h4>
        {list}
        {more}
      </section>
    );
  }
  return (
    <section className="flex flex-col">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-11 items-center gap-1.5 self-start rounded-lg px-1 text-[0.6875rem] font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] md:min-h-9"
      >
        <ChevronDown size="0.75rem" className={cn("transition-transform", open && "rotate-180")} />
        {title} ({count})
      </button>
      <SmoothFolderContent open={open}>
        <div className="pt-1">{list}</div>
      </SmoothFolderContent>
    </section>
  );
}

/** Step 1's job list: each job as its Defaults row, plus one line on what it does. */
function JobCards({ rows, onPick }: { rows: ConnectionRowData[]; onPick: (key: AddJob) => void }) {
  const { t } = useTranslation();
  const { tiles, features } = useConnectionDefaults(rows);
  return (
    <div className="mari-connection-model-well">
      {JOBS.filter((job) => job.add === undefined).map((job) => {
        const tile = [...tiles, ...features].find((entry) => entry.key === job.key);
        return (
          tile && (
            <div key={job.key} className="mari-connection-model-slot min-w-0">
              <JobRow
                tile={tile}
                hint={t(jobHintKey(job))}
                data-add-connection-job-choice={job.key}
                onClick={() => onPick(job.key)}
                trailing={<ChevronRight size="0.875rem" className="shrink-0 text-[var(--muted-foreground)]" />}
              />
            </div>
          )
        );
      })}
    </div>
  );
}

/** First run only: the What's New hero band, low and static. */
function FirstRunIntro({ text, className }: { text: string; className?: string }) {
  return (
    <div
      className={cn(
        "relative flex items-end gap-3 overflow-hidden rounded-xl border border-[var(--marinara-chat-chrome-panel-divider)] bg-[var(--marinara-chat-chrome-highlight-bg)] px-4 pt-2",
        className,
      )}
    >
      <div
        aria-hidden
        className="absolute left-12 top-1/2 h-24 w-40 -translate-y-1/2 rounded-full bg-[var(--marinara-chat-chrome-accent)] opacity-10 blur-3xl"
      />
      <img
        src="/illustrations/professor-mari-whats-new.webp"
        alt=""
        className="relative h-24 w-auto shrink-0 object-contain object-bottom md:h-28"
      />
      <p className="relative self-center pb-2 text-xs leading-relaxed text-[var(--foreground)]">{text}</p>
    </div>
  );
}

export function CreateConnectionModal({
  open,
  onClose,
  initialService,
  modelsFor,
  newChatMode,
  onStartChat,
  forJob,
}: Props) {
  const { t } = useTranslation();
  const { data: accounts } = useConnectionAccounts();
  const { data: rows } = useConnections();
  const createAccount = useCreateConnectionAccount();
  const updateAccount = useUpdateConnectionAccount();
  const deleteAccount = useDeleteConnectionAccount();
  const deleteRow = useDeleteConnection();
  const updateRow = useUpdateConnection();
  const testConnection = useTestConnection();
  const createRow = useCreateConnection();
  const setChatModel = useSetChatModel();
  const featureModels = useFeatureModels();
  const setFeatureModels = useSetFeatureModels();
  const embeddingDefault = useDefaultEmbeddingConnection();
  const setEmbeddingDefault = useSetDefaultEmbeddingConnection();
  const activeChatId = useChatStore((s) => s.activeChatId);
  const deviceSetup = useDeviceSetup();
  const followVoiceJob = useFollowVoiceJob();

  // Old image/video deep links now land on real backend discovery instead of a generic credential form.
  const startingService =
    initialService === "image_generation" || initialService === "video_generation" ? null : (initialService ?? null);
  const startDevice = isDevice(startingService) ? (startingService as DeviceService) : null;
  const startMedia = mediaBackendOf(startingService);
  const [service, setService] = useState<ServiceId | null>(startingService);
  const [provider, setProvider] = useState<APIProvider | null>(
    startingService && !startDevice && !startMedia
      ? (startingService as APIProvider)
      : startMedia
        ? startMedia.image
          ? "image_generation"
          : "video_generation"
        : null,
  );
  const [device, setDevice] = useState<DeviceService | null>(startDevice);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(modelsFor ? 3 : startingService ? 2 : 1);
  const [target, setTarget] = useState<Target | null>(null);
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [maxRpm, setMaxRpm] = useState("");
  const [maxJobs, setMaxJobs] = useState("");
  const [tested, setTested] = useState<TestResult | null>(null);
  // The models starred in this setup, in order; the first one is what the ready screen offers.
  const [picks, setPicks] = useState<Array<{ connectionId: string; modelId: string; kind: AddableKind }>>([]);
  const [setupKind, setSetupKind] = useState<AddableKind | null>(null);
  // The image or video Model row whose models step 3 lists; its workflow and options are set later with Edit.
  const [mediaRowId, setMediaRowId] = useState<string | null>(null);
  const [mediaSaved, setMediaSaved] = useState(false);
  const [mediaCreating, setMediaCreating] = useState(false);
  // The decision and voice steps test for the job; only a pass adds the Model, so a decision
  // model without log-probabilities is never saved.
  const [jobTest, setJobTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [jobTesting, setJobTesting] = useState(false);
  const passedJob = useRef<Record<string, { model: string; name: string }>>({});
  const [query, setQuery] = useState("");
  // Step 1 opens on three cards; each opens one list. Typing in the top search shows every match instead.
  const [pick, setPick] = useState<"job" | "model" | "provider" | null>(null);
  const [showAllVendors, setShowAllVendors] = useState(false);
  const [otherOpen, setOtherOpen] = useState(false);
  // The job this window adds for (a job picker, "For a job…"); Done sets the new Model for it.
  const [jobFor, setJobFor] = useState<AddFor | null>(forJob ?? null);
  const job = jobFor?.job ?? null;
  // The kind chip in step 1; step 3 starts on the same kind.
  const [kindFilter, setKindFilter] = useState<ChipKind | null>(
    forJob ? (forJob.job ? (jobAddKind(forJob.job) ?? null) : (forJob.kind ?? null)) : null,
  );
  // A model chosen in step 1's search: step 3 starts on its kind and picks it once the list loads.
  const [want, setWant] = useState<{ model: string; kind: ModelKind } | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  // A service that is already connected: the user chose to connect a second account of it.
  const [second, setSecond] = useState(false);
  // Step 3's footer; null = "Make Main" is on when there is no Main model yet.
  const [makeMain, setMakeMain] = useState<boolean | null>(null);
  const [useInChat, setUseInChat] = useState(false);
  const [finishing, setFinishing] = useState(false);
  // Set once from the first loaded list: a setup with no chat Model yet is a first run.
  const [firstRun, setFirstRun] = useState<boolean | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);

  const allRows = (rows ?? []) as ConnectionRowLite[];
  const chatRows = allRows.filter((row) => isChatProvider(row.provider ?? ""));
  const hasMain = chatRows.some((row) => isConnectionFlagTrue((row as Record<string, unknown>).isDefault));
  const hasAgents = chatRows.some((row) => isConnectionFlagTrue((row as Record<string, unknown>).defaultForAgents));
  useEffect(() => {
    if (firstRun !== null || !rows) return;
    setFirstRun(!modelsFor && !(rows as ConnectionRowLite[]).some((row) => isChatProvider(row.provider ?? "")));
  }, [firstRun, modelsFor, rows]);

  const selectedMedia = mediaBackendOf(service);
  const def = provider ? PROVIDERS[provider] : null;
  const keyless = !!provider && (isLocalAuthProvider(provider) || (!!selectedMedia && !selectedMedia.requiresApiKey));
  // LinkAPI rides the custom provider, but it is a hosted service with a key, not a local server.
  const isLocal = (provider === "custom" && service !== LINKAPI_SERVICE) || service === "decision:custom";
  const isMedia = !!provider && !isChatProvider(provider);
  const busy = createAccount.isPending || updateAccount.isPending || testConnection.isPending;
  const closeBlocked =
    finishing ||
    busy ||
    mediaCreating ||
    createRow.isPending ||
    updateRow.isPending ||
    deleteRow.isPending ||
    deleteAccount.isPending;
  const shownRow = target ? allRows.find((row) => row.id === target.connectionId) : undefined;
  const starAnchor = target ? starAnchorOf(allRows.filter((row) => row.accountId === target.accountId)) : undefined;
  // Unstarring the original Model may remove it after another Model was added.
  const pickerBase = shownRow ?? starAnchor;
  const pickerRow = pickerBase && { ...pickerBase, pinnedModels: (starAnchor ?? pickerBase).pinnedModels };
  const modelList = useConnectionModels(
    pickerBase?.id ?? target?.connectionId,
    !isMedia && (!!tested?.success || step === 3),
  );
  const modelCount = modelList.data?.models?.length;
  const addedIds = picks.map((pick) => pick.modelId);
  // "Use in this chat" needs an open chat; the new-chat gate makes its chat with the pick instead.
  const chatTarget = !onStartChat && !modelsFor ? activeChatId : null;

  // On a step change the focus moves to the step heading; on a desktop step 2 to the key field
  // instead (a phone keyboard would cover the screen).
  const firstStep = useRef(true);
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    const fine = window.matchMedia?.("(pointer: fine)").matches;
    if (step === 2 && fine && keyRef.current) keyRef.current.focus();
    else if (step !== 3 || !fine) headingRef.current?.focus();
  }, [step, provider, pick, job]);

  const serviceName = (key: ServiceId) => {
    const media = mediaBackendOf(key);
    return media
      ? media.name || t("connections.add.decisionServer")
      : isDevice(key)
        ? t(`connections.add.device.${key}`)
        : key === LINKAPI_SERVICE
          ? LINKAPI.name
          : key === DECISION_BUILTIN
            ? t("ui.panels.sidecarcard.decisionSidecar")
            : key === "decision" || key === "custom"
              ? t(key === "custom" ? "connections.add.customName" : "connections.decision.label")
              : (PROVIDERS[key as APIProvider]?.name ?? key);
  };
  // A network failure reads as one plain sentence, never a raw "Failed to fetch".
  const friendlyError = (error: unknown) =>
    NETWORK_ERROR.test(errorText(error))
      ? t("connections.add.error.unreachable", { host: serviceName(service ?? provider ?? "custom") })
      : errorText(error);
  const serviceHint = (key: ServiceId) =>
    mediaBackendOf(key)?.description ?? t(`connections.add.hint.${key.replace(":", "_")}`);
  const kindItems = (key: ServiceId) =>
    kindsOf(key).flatMap((kind) =>
      // A chat service's decision and voice jobs show only when that job is searched for.
      kind in KIND_ICONS && (kind === kindFilter || !jobKindsOf(key).includes(kind))
        ? [{ kind: kind as ChipKind, label: t(`connections.add.kind.${kind}`) }]
        : [],
    );

  // Throw away the empty Model of a Connection that was created but never got a Model picked.
  const discard = async () => {
    if (!target) return;
    try {
      if (picks.length > 0) {
        // A kind looked at but left without a model leaves an empty placeholder behind.
        const picked = new Set(picks.map((pick) => pick.connectionId));
        for (const id of target.ownedPlaceholderIds ?? []) {
          const row = allRows.find((candidate) => candidate.id === id);
          if (picked.has(id)) {
            // A model tapped after a passed test gives way to the one that passed.
            const passed = passedJob.current[id];
            if (passed && row && row.model !== passed.model) await updateRow.mutateAsync({ id, ...passed });
            continue;
          }
          // A decision or voice Model stays only after its test passed (runJobTest records the pick).
          if (row?.model?.trim() && row.provider !== "decision" && row.provider !== "audio") continue;
          await deleteRow.mutateAsync(id);
        }
      } else if (target.fresh && !mediaSaved) {
        for (const row of allRows.filter((row) => row.accountId === target.accountId)) {
          await deleteRow.mutateAsync(row.id);
        }
        await deleteAccount.mutateAsync(target.accountId);
      } else {
        for (const id of target.ownedPlaceholderIds ?? []) await deleteRow.mutateAsync(id);
      }
    } catch {
      /* the Connection stays; the user can delete it in the panel */
    }
  };

  // Done applies the footer's choices. With no Main model yet the first model added becomes Main (its box starts
  // on); next to a Main model "Set as Main" acts at once instead.
  const firstPick = picks.find((pick) => pick.kind === "chat");
  const firstPickRow = firstPick && allRows.find((row) => row.id === firstPick.connectionId);
  const alreadyMain = isConnectionFlagTrue((firstPickRow as Record<string, unknown> | undefined)?.isDefault);
  const makeMainOn = makeMain ?? !hasMain;
  // Adding for Main sets Main on Done, so the box would say the same thing twice.
  const offerMain = !hasMain && !alreadyMain && !modelsFor?.chat && job !== "main";
  const applyChoices = async () => {
    if (!firstPick) return true;
    if (offerMain && makeMainOn) {
      try {
        // A first Main also becomes the Agents default when there is none, when the user chooses to make it Main.
        await updateRow.mutateAsync({
          id: firstPick.connectionId,
          isDefault: true,
          ...(hasAgents ? {} : { defaultForAgents: true }),
        });
      } catch (error) {
        toast.error(t("connections.switcher.defaultFailed", { error: errorText(error) }));
        return false;
      }
    }
    if (useInChat && chatTarget) {
      try {
        await setChatModel.mutateAsync({ chatId: chatTarget, connectionId: firstPick.connectionId });
      } catch (error) {
        toast.error(t("connections.switcher.pickFailed", { error: errorText(error) }));
        return false;
      }
    }
    return true;
  };

  const setAsMain = async () => {
    if (!firstPick) return;
    try {
      await updateRow.mutateAsync({ id: firstPick.connectionId, isDefault: true });
    } catch (error) {
      toast.error(t("connections.switcher.defaultFailed", { error: errorText(error) }));
    }
  };

  const jobLabel = (key: AddJob) => t(jobLabelKey(JOB[key]));
  // Adding for a job: the first new Model of the job's kind is set for it; the result undoes that.
  const jobKind = job ? jobAddKind(job) : jobFor?.kind;
  const jobPick = jobFor && jobKind ? picks.find((pick) => pick.kind === jobKind) : undefined;
  const assignJob = async (): Promise<(() => void) | null> => {
    if (!jobPick || !jobFor) return null;
    const id = jobPick.connectionId;
    if (jobFor.assign) {
      const { assign, previous = null } = jobFor;
      assign(id);
      return () => assign(previous);
    }
    if (job === "embeddings") {
      const previous = embeddingDefault.data?.connectionId ?? null;
      await setEmbeddingDefault.mutateAsync(id);
      return () => void setEmbeddingDefault.mutateAsync(previous).catch(() => {});
    }
    const entry = job ? JOB[job] : undefined;
    const flag = entry?.flag;
    // Only a Connection of the job's kind takes its flag: a chat service's voice Model is not the Audio default.
    const target = allRows.find((row) => row.id === id);
    if (flag && target && matchesKind(target, entry.kind!)) {
      const previous = allRows.find(
        (row) =>
          row.id !== id &&
          matchesKind(row, entry.kind!) &&
          isConnectionFlagTrue((row as Record<string, unknown>)[flag]),
      )?.id;
      await updateRow.mutateAsync({ id, [flag]: true });
      const undoVoice = job === "voice" ? await followVoiceJob(id).catch(() => null) : null;
      return () => {
        undoVoice?.();
        void updateRow.mutateAsync(previous ? { id: previous, [flag]: true } : { id, [flag]: false }).catch(() => {});
      };
    }
    const feature = entry?.feature;
    if (feature) {
      const previous = featureModels.data?.[feature] ?? null;
      await setFeatureModels.mutateAsync({ [feature]: id });
      return () => void setFeatureModels.mutateAsync({ [feature]: previous }).catch(() => {});
    }
    return null;
  };

  // After adding, the window closes and the panel shows the new card with one flash of its rail.
  const close = async (saveChoices = false) => {
    setFinishing(true);
    let undo: (() => void) | null = null;
    try {
      if (saveChoices && !(await applyChoices())) return;
      if (saveChoices) {
        try {
          undo = await assignJob();
        } catch (error) {
          toast.error(t("connections.switcher.defaultFailed", { error: errorText(error) }));
        }
      }
      await discard();
    } finally {
      setFinishing(false);
    }
    onClose();
    if (target && (picks.length > 0 || mediaSaved)) flashConnectionCard(target.accountId);
    if (undo && jobPick) {
      const model = modelName(jobPick.modelId);
      toast.success(
        job
          ? t("connections.add.assigned", { model, job: jobLabel(job) })
          : t("connections.add.assignedHere", { model }),
        { duration: 8000, action: { label: t("connections.star.undo"), onClick: undo } },
      );
    }
  };

  const requestClose = () => {
    if (closeBlocked) return;
    void close();
  };

  const resetFields = () => {
    setTarget(null);
    setTested(null);
    setName("");
    setApiKey("");
    setShowKey(false);
    setBaseUrl("");
    setMaxRpm("");
    setMaxJobs("");
    setMoreOpen(false);
    setSecond(false);
    setSetupKind(null);
    setMediaRowId(null);
    setMediaSaved(false);
    setMediaCreating(false);
    setJobTest(null);
  };

  // Step 3 opens on the kind of the model chosen in the search, else the kind chosen in the list, else the first.
  const startKind = (kinds: AddableKind[]) => {
    const preferred = want?.kind ?? kindFilter;
    return preferred && kinds.includes(preferred as AddableKind) ? (preferred as AddableKind) : (kinds[0] ?? null);
  };

  // The old Decision and Audio services have no model list to pick from: their editor opens over the panel
  // instead. A chat service's decision or voice Model goes through the job steps.
  const editInstead = (accountId: string, connectionId: string) => {
    onClose();
    flashConnectionCard(accountId);
    useUIStore.getState().openConnectionDetail(connectionId);
  };

  const chooseService = async (key: ServiceId) => {
    await discard();
    resetFields();
    const media = mediaBackendOf(key);
    setService(key);
    setProvider(
      isDevice(key)
        ? null
        : media
          ? media.job
            ? JOB_PROVIDER[media.job]
            : media.image
              ? "image_generation"
              : "video_generation"
          : key === LINKAPI_SERVICE
            ? "custom"
            : (key as APIProvider),
    );
    if (key === LINKAPI_SERVICE) {
      setBaseUrl(LINKAPI.baseUrl);
      setName(LINKAPI.name);
    }
    setDevice(isDevice(key) ? key : null);
    setStep(2);
  };

  const backToList = async () => {
    await discard();
    resetFields();
    setWant(null);
    setProvider(null);
    setService(null);
    setDevice(null);
    setStep(1);
  };

  // A retry with another key keeps an automatic name in step with that key (decision 28); a typed name wins.
  const autoName =
    target?.autoName && KEY_TAIL.test(target.autoName)
      ? withKeyTail(target.autoName.replace(KEY_TAIL, ""), apiKey)
      : "";
  const accountFields = () => ({
    ...(name.trim() || autoName
      ? { name: name.trim() || autoName }
      : // The server would name a voice or decision Connection "Audio" / "Decision"; it is named for its service.
        selectedMedia?.job && service
        ? {
            name:
              connectedAccounts.length > 0 && apiKey.trim()
                ? withKeyTail(serviceName(service), apiKey)
                : serviceName(service),
          }
        : {}),
    apiKey: keyless ? "" : apiKey.trim(),
    baseUrl: baseUrl.trim() || selectedMedia?.defaultBaseUrl || (keyless ? "" : (def?.defaultBaseUrl ?? "")),
    maxRequestsPerMinute: maxRpm ? Math.min(600, Math.max(1, Math.trunc(Number(maxRpm)))) : null,
    maxParallelJobs: maxJobs ? Math.min(16, Math.max(1, Math.trunc(Number(maxJobs)))) : null,
  });

  /** Creates the Connection with its empty first Model (or updates it on a retry), tests it, and on success goes on. */
  const saveAndTest = async () => {
    if (!provider) return;
    try {
      let current = target;
      if (current) {
        await updateAccount.mutateAsync({ id: current.accountId, ...accountFields() });
      } else {
        const created = await createAccount.mutateAsync({
          provider,
          ...accountFields(),
          // The Claude plan test sends one real request, so it needs a model; the first pick replaces it.
          ...(provider === "claude_subscription" ? { model: MODEL_LISTS.claude_subscription[0]?.id } : {}),
        });
        current = {
          accountId: created.account.id,
          connectionId: created.connectionId,
          fresh: true,
          placeholderId: created.connectionId,
          ownedPlaceholderIds: [created.connectionId],
          accountBaseUrl: created.account.baseUrl,
          ...(name.trim() ? {} : { autoName: created.account.name }),
        };
        setTarget(current);
      }
      if (isMedia) {
        const mediaKinds = selectedMedia
          ? (kindsOf(selectedMedia.id).filter((kind) => kind !== "local") as AddableKind[])
          : ([provider === "video_generation" ? "video" : "image"] as AddableKind[]);
        setSetupKind(startKind(mediaKinds));
        setStep(3);
        return;
      }
      const result = await testConnection.mutateAsync(current.connectionId);
      setTested(result);
      // "Test and continue" is one press: a passing test opens the models.
      if (result.success) {
        const available: AddableKind[] = service
          ? kindsOf(service).filter((kind): kind is AddableKind => kind !== "local")
          : ["chat"];
        setSetupKind(startKind(available));
        setStep(3);
      }
    } catch (error) {
      setTested({ success: false, message: errorText(error) });
    }
  };

  const showModelsOf = async (accountId: string, connectionId?: string, kind?: AddableKind) => {
    // A key shared by chat and image Models (decision 20): the models list belongs to a chat Model.
    const linked = allRows.filter((candidate) => candidate.accountId === accountId);
    let row: ConnectionRowLite | undefined =
      linked.find((candidate) => candidate.id === connectionId) ?? starAnchorOf(linked) ?? linked[0];
    const chatProvider =
      service && !selectedMedia && !isDevice(service) && isChatProvider(service) ? (service as APIProvider) : null;
    // A vendor key may have been set up for images first. Its chat catalog needs its own chat row.
    if (chatProvider && row && !isChatProvider(row.provider ?? "")) row = undefined;
    let placeholderId: string | undefined;
    if (!row) {
      const account = accounts?.find((candidate) => candidate.id === accountId);
      if (!account) return;
      const media = selectedMedia;
      let chatBaseUrl = account.baseUrl;
      if (chatProvider) {
        const vendorBaseUrl = PROVIDERS[chatProvider]?.defaultBaseUrl;
        try {
          if (vendorBaseUrl && new URL(account.baseUrl).origin === new URL(vendorBaseUrl).origin)
            chatBaseUrl = vendorBaseUrl;
        } catch {
          // Keep a custom endpoint intact; the service's test can explain an invalid address.
        }
      }
      const mediaBaseUrl = chatProvider
        ? chatBaseUrl
        : media && (media.source === "comfyui" || media.source === "swarmui")
          ? account.baseUrl || media.defaultBaseUrl
          : media?.defaultBaseUrl;
      const rowProvider: APIProvider = media
        ? media.image
          ? "image_generation"
          : "video_generation"
        : (chatProvider ?? (account.provider as APIProvider));
      setMediaCreating(true);
      try {
        const created = (await createRow.mutateAsync({
          name: media?.name ?? account.name,
          provider: rowProvider,
          apiKey: "",
          baseUrl: mediaBaseUrl ?? account.baseUrl,
          accountId,
          ...(media?.image
            ? { imageGenerationSource: media.source, imageService: media.source }
            : media?.video
              ? { videoGenerationSource: media.source, videoService: media.source }
              : {}),
        })) as { id?: string };
        if (!created.id) return;
        placeholderId = created.id;
        row = {
          id: created.id,
          name: media?.name ?? account.name,
          provider: rowProvider,
          baseUrl: mediaBaseUrl ?? account.baseUrl,
          accountId,
          ...(media?.image
            ? { imageGenerationSource: media.source, imageService: media.source }
            : media?.video
              ? { videoGenerationSource: media.source, videoService: media.source }
              : {}),
        };
      } catch (error) {
        toast.error(friendlyError(error));
        return;
      } finally {
        setMediaCreating(false);
      }
    }
    resetFields();
    const account = accounts?.find((candidate) => candidate.id === accountId);
    let resolvedService = service;
    if (!service) {
      const source = row.imageGenerationSource || row.imageService || row.videoGenerationSource || row.videoService;
      const jobSource = jobSourceOf(row);
      const inferredService = (
        jobSource ? `${row.provider}:${jobSource}` : source ? `media:${source}` : row.provider
      ) as ServiceId;
      resolvedService = mediaBackendOf(inferredService)
        ? inferredService
        : account && isChatProvider(account.provider)
          ? (account.provider as APIProvider)
          : (row.provider as APIProvider);
      setService(resolvedService);
      setProvider(mediaBackendOf(resolvedService) ? (row.provider as APIProvider) : (resolvedService as APIProvider));
    }
    setTarget({
      accountId,
      connectionId: row.id,
      fresh: false,
      placeholderId,
      ownedPlaceholderIds: placeholderId ? [placeholderId] : [],
      accountBaseUrl: account?.baseUrl,
    });
    // An older voice or decision row whose service has no tile of its own still opens its editor.
    if ((row.provider === "audio" || row.provider === "decision") && !mediaBackendOf(resolvedService))
      return editInstead(accountId, row.id);
    const supportedKinds = resolvedService
      ? kindsOf(resolvedService).filter((kind): kind is AddableKind => kind !== "local")
      : [];
    setSetupKind(kind ?? modelsFor?.kind ?? (modelsFor?.chat ? "chat" : startKind(supportedKinds)));
    setStep(3);
  };

  // Creating an empty account's first placeholder invalidates rows before the account refresh can finish.
  // Keep that refresh from starting another setup while the first one still owns its pending row.
  const openingModels = useRef(false);
  useEffect(() => {
    if (!modelsFor || target || !rows || !accounts || openingModels.current) return;
    openingModels.current = true;
    void showModelsOf(modelsFor.accountId, modelsFor.connectionId).finally(() => {
      openingModels.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialize once data is available; target ends setup
  }, [modelsFor, rows, accounts]);

  const mediaSourceFor = (kind: "image" | "video") => {
    if (selectedMedia && selectedMedia[kind]) return selectedMedia.source;
    const linked = target ? accountRows(target.accountId) : [];
    const existing = linked.find((row) => row.provider === `${kind}_generation`);
    const existingSource =
      kind === "image"
        ? existing?.imageGenerationSource ||
          existing?.imageService ||
          (existing ? inferImageSource(existing.model ?? "", existing.baseUrl ?? "") : "")
        : existing?.videoGenerationSource ||
          existing?.videoService ||
          (existing ? inferVideoSource(existing.model ?? "", existing.baseUrl ?? "") : "");
    if (existingSource) return existingSource;
    // LinkAPI serves OpenAI-style image models (gpt-image-1.5) at its own address.
    if (service === LINKAPI_SERVICE) return kind === "image" ? "openai" : undefined;
    if (provider && isChatProvider(provider)) {
      if (kind === "image") return Object.entries(IMAGE_VENDOR).find(([, vendor]) => vendor === provider)?.[0];
      return Object.entries(VIDEO_SOURCE_VENDOR).find(([, vendor]) => vendor === provider)?.[0];
    }
    return undefined;
  };

  const mediaSetupStarted = useRef("");
  const beginMediaSetup = async (kind: "image" | "video") => {
    if (!target) return;
    const source = mediaSourceFor(kind);
    if (!source) {
      mediaSetupStarted.current = "";
      setSetupKind(null);
      toast.error(t("connections.add.mediaCreateFailed"));
      return;
    }
    const rowProvider: APIProvider = kind === "image" ? "image_generation" : "video_generation";
    const linked = accountRows(target.accountId);
    const sourceDef = (kind === "image" ? IMAGE_GENERATION_SOURCES : VIDEO_GENERATION_SOURCES).find(
      (candidate) => candidate.id === source,
    );
    const preserveAccountEndpoint = source === "comfyui" || source === "swarmui" || service === LINKAPI_SERVICE;
    const siblingEndpoint = linked.find((row) => rowUsesMediaSource(row, source))?.baseUrl;
    const endpoint = preserveAccountEndpoint
      ? siblingEndpoint || target.accountBaseUrl || sourceDef?.defaultBaseUrl || ""
      : sourceDef?.defaultBaseUrl || "";
    setMediaCreating(true);
    try {
      const empty = linked.find(
        (row) => row.id === target.placeholderId && row.provider === rowProvider && !row.model?.trim(),
      );
      let id: string;
      if (empty) {
        await updateRow.mutateAsync({
          id: empty.id,
          provider: rowProvider,
          name: sourceDef?.name ?? source,
          baseUrl: endpoint,
          ...(kind === "image"
            ? { imageGenerationSource: source, imageService: source }
            : { videoGenerationSource: source, videoService: source }),
        });
        id = empty.id;
      } else {
        const created = (await createRow.mutateAsync({
          name: sourceDef?.name ?? source,
          provider: rowProvider,
          apiKey: "",
          baseUrl: endpoint,
          accountId: target.accountId,
          ...(kind === "image"
            ? { imageGenerationSource: source, imageService: source }
            : { videoGenerationSource: source, videoService: source }),
        })) as { id?: string };
        if (!created.id) throw new Error(t("connections.add.mediaCreateFailed"));
        id = created.id;
        setTarget((current) =>
          current?.accountId === target.accountId
            ? {
                ...current,
                placeholderId: id,
                ownedPlaceholderIds: [...new Set([...(current.ownedPlaceholderIds ?? []), id])],
              }
            : current,
        );
      }
      setSetupKind(kind);
      setMediaRowId(id);
    } catch (error) {
      toast.error(friendlyError(error));
      setSetupKind(null);
    } finally {
      mediaSetupStarted.current = "";
      setMediaCreating(false);
    }
  };

  // A decision or voice Model is its own row under the Connection, at its address and with its key: a chat service's
  // row speaks its OpenAI-style API, a voice or decision service fills the new Connection's first row.
  const beginJobSetup = async (kind: "decision" | "voice") => {
    const account = target ? accounts?.find((candidate) => candidate.id === target.accountId) : undefined;
    if (!account) return;
    const rowProvider = JOB_PROVIDER[kind];
    const vendor = account.provider as APIProvider;
    const backend = selectedMedia?.job === kind ? selectedMedia : undefined;
    const source = backend?.source ?? (kind === "decision" ? "openai_compatible" : SPEECH_SOURCE[vendor]);
    if (!source || (!backend && !isChatProvider(vendor))) {
      onClose();
      flashConnectionCard(account.id);
      return;
    }
    const linked = accountRows(account.id);
    const placeholder = linked.find(
      (row) => row.id === target?.placeholderId && row.provider === rowProvider && !row.model?.trim(),
    );
    // An existing Connection of this service keeps its one row: Done sets it for the job.
    const own = backend && linked.find((row) => row.provider === rowProvider && jobSourceOf(row) === source);
    if (!placeholder && own) return setMediaRowId(own.id);
    const preset = backend && AUDIO_SOURCE_OPTIONS.find((option) => option.id === source);
    const fields =
      kind === "decision"
        ? { decisionSource: source as DecisionSource }
        : {
            audioSource: source,
            ...(preset
              ? { model: preset.defaultModel, ...(preset.defaultVoice ? { audioVoice: preset.defaultVoice } : {}) }
              : {}),
          };
    setMediaCreating(true);
    try {
      let id = placeholder?.id;
      if (id) await updateRow.mutateAsync({ id, ...fields });
      else {
        const created = (await createRow.mutateAsync({
          name: account.name,
          provider: rowProvider,
          apiKey: "",
          baseUrl: account.baseUrl || PROVIDERS[vendor]?.defaultBaseUrl || "",
          accountId: account.id,
          ...fields,
        })) as { id?: string };
        if (!created.id) throw new Error(t("connections.add.mediaCreateFailed"));
        const createdId = created.id;
        id = createdId;
        setTarget((current) =>
          current?.accountId === account.id
            ? { ...current, ownedPlaceholderIds: [...new Set([...(current.ownedPlaceholderIds ?? []), createdId])] }
            : current,
        );
      }
      setMediaRowId(id);
    } catch (error) {
      mediaSetupStarted.current = "";
      toast.error(friendlyError(error));
    } finally {
      setMediaCreating(false);
    }
  };

  useEffect(() => {
    if (step !== 3 || !target || mediaRowId || !setupKind || setupKind === "chat") return;
    const key = `${target.accountId}:${setupKind}`;
    if (mediaSetupStarted.current === key) return;
    mediaSetupStarted.current = key;
    void (setupKind === "image" || setupKind === "video" ? beginMediaSetup(setupKind) : beginJobSetup(setupKind));
    // The target/kind transition is the trigger; the helper reads the latest loaded rows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, target?.accountId, setupKind, mediaRowId]);

  // A chat pick adds a Model; an image or video pick sets the one model of its row.
  const recordPick = (connectionId: string, modelId: string, kind: AddableKind = "chat") =>
    setPicks((current) =>
      kind !== "chat"
        ? [...current.filter((pick) => pick.connectionId !== connectionId), { connectionId, modelId, kind }]
        : current.some((pick) => pick.modelId === modelId)
          ? current
          : [...current, { connectionId, modelId, kind }],
    );

  // A star taken off here: the model is no longer added. The star hook removes the Model (decision 30).
  const chooseJobModel = async (choice: ChatModelChoice) => {
    if (!mediaRowId) return;
    setJobTest(null);
    await updateRow.mutateAsync({ id: mediaRowId, model: choice.model, name: choice.name || choice.model });
  };
  const runJobTest = async () => {
    const row = mediaRowId ? allRows.find((candidate) => candidate.id === mediaRowId) : undefined;
    if (!row || (setupKind !== "decision" && setupKind !== "voice")) return;
    setJobTesting(true);
    try {
      let result: { ok: boolean; message: string };
      if (setupKind === "decision") {
        const tested = await testConnection.mutateAsync(row.id);
        result =
          tested.success && tested.logprobs === false
            ? { ok: false, message: t("connections.add.decisionNoLogprobs") }
            : { ...decisionConnectionTestMessage(t, tested), ok: tested.success };
      } else {
        // The default voice is the first one the service lists.
        if (!row.audioVoice?.trim()) {
          const { voices } = await api.get<TTSVoicesResponse>(`/tts/voices?connectionId=${encodeURIComponent(row.id)}`);
          if (voices[0]) await updateRow.mutateAsync({ id: row.id, audioVoice: voices[0] });
        }
        ttsService.preparePlayback();
        await ttsService.speak(t("connections.add.voiceTestSentence"), "add-connection-voice-test", {
          throwOnError: true,
          audioConnectionId: row.id,
        });
        result = { ok: true, message: t("connections.add.voiceTestPassed") };
      }
      setJobTest(result);
      if (result.ok) {
        passedJob.current[row.id] = { model: row.model ?? "", name: row.name ?? row.model ?? "" };
        setPicks((current) => [
          ...current.filter((pick) => pick.connectionId !== row.id),
          { connectionId: row.id, modelId: row.model ?? "", kind: setupKind },
        ]);
      }
    } catch (error) {
      setJobTest({ ok: false, message: errorText(error) });
    } finally {
      setJobTesting(false);
    }
  };

  const unstar = (modelId: string) => setPicks((current) => current.filter((pick) => pick.modelId !== modelId));

  const startChatting = async () => {
    if (!onStartChat || !firstPick) return;
    setFinishing(true);
    try {
      if (!(await applyChoices())) return;
      await onStartChat(firstPick.connectionId);
    } catch {
      // useCreateChat already shows the error toast; the window stays open so the user can try again.
    } finally {
      setFinishing(false);
    }
  };

  // ── Step 1: the service list ──
  const ownAccounts = (accounts ?? []).filter((account) => account.id !== target?.accountId);
  const accountRows = (accountId: string) => allRows.filter((row) => row.accountId === accountId);
  const rowUsesMediaSource = (row: ConnectionRowLite, source: string) =>
    (row.provider === "image_generation" &&
      (row.imageGenerationSource || row.imageService || inferImageSource(row.model ?? "", row.baseUrl ?? "")) ===
        source) ||
    (row.provider === "video_generation" &&
      (row.videoGenerationSource || row.videoService || inferVideoSource(row.model ?? "", row.baseUrl ?? "")) ===
        source);
  const compatibleAccounts = (key: ServiceId) => {
    const media = mediaBackendOf(key);
    // A voice or decision service: the Connections already holding a row of that source.
    if (media?.job) {
      const provider = JOB_PROVIDER[media.job];
      return ownAccounts.filter((account) =>
        accountRows(account.id).some((row) => row.provider === provider && jobSourceOf(row) === media.source),
      );
    }
    if (media)
      return ownAccounts.filter(
        (account) =>
          accountRows(account.id).some((row) => rowUsesMediaSource(row, media.source)) ||
          (["image_generation", "video_generation"].includes(account.provider) &&
            account.baseUrl.replace(/\/+$/u, "") === media.defaultBaseUrl.replace(/\/+$/u, "")),
      );
    if (isDevice(key)) return [];
    if (key === LINKAPI_SERVICE)
      return ownAccounts.filter((account) => account.provider === "custom" && isLinkApiUrl(account.baseUrl));
    const providerKey = key as APIProvider;
    const imageSources = Object.entries(IMAGE_VENDOR)
      .filter(([, vendor]) => vendor === providerKey)
      .map(([source]) => source);
    const videoSources = Object.entries(VIDEO_SOURCE_VENDOR)
      .filter(([, vendor]) => vendor === providerKey)
      .map(([source]) => source);
    const sharesVendorOrigin = (accountUrl: string) => {
      try {
        return new URL(accountUrl).origin === new URL(PROVIDERS[providerKey].defaultBaseUrl).origin;
      } catch {
        return false;
      }
    };
    return ownAccounts.filter(
      (account) =>
        account.provider === providerKey ||
        (!isChatProvider(account.provider) &&
          sharesVendorOrigin(account.baseUrl) &&
          accountRows(account.id).some((row) =>
            [...imageSources, ...videoSources].some((source) => rowUsesMediaSource(row, source)),
          )),
    );
  };
  const connectedAccounts = service ? compatibleAccounts(service) : [];
  const connectedAccount = (key: ServiceId) => compatibleAccounts(key)[0];
  const badgesFor = (service: ServiceId) => {
    const badges: Array<{ label: string; highlight?: boolean }> = [];
    if (isDevice(service) && deviceSetup[DEVICE_ITEMS[service]].setUp)
      badges.push({ label: t("connections.add.badge.setUp"), highlight: true });
    else if (connectedAccount(service)) badges.push({ label: t("connections.add.badge.connected"), highlight: true });
    // The group already says "Recommended"; LinkAPI says why it is first.
    if (service === LINKAPI_SERVICE) badges.push({ label: t("connections.add.badge.sponsor"), highlight: true });
    if (isDevice(service) || service === DECISION_BUILTIN) badges.push({ label: t("connections.add.badge.builtIn") });
    const billing =
      service === LINKAPI_SERVICE
        ? "pay_per_use"
        : isDevice(service) || mediaBackendOf(service) || service === DECISION_BUILTIN
          ? undefined
          : PROVIDERS[service as APIProvider]?.billing;
    // NanoGPT has a monthly plan too, so "Pay per use" alone would be wrong.
    if (service === "nanogpt") badges.push({ label: t("connections.add.badge.planOrPay") });
    else if (billing) badges.push({ label: t(`connections.add.badge.${billing}`) });
    return badges.slice(0, 2);
  };
  const needle = query.trim().toLowerCase();
  const searching = needle.length > 0;
  // A chip hides tiles without that kind; every group keeps its place, and an empty group hides.
  const groups = SERVICE_GROUPS.map((group) => {
    const services = group.services.filter(
      (key) =>
        (!isDevice(key) || deviceSetup[DEVICE_ITEMS[key]].available) &&
        (!kindFilter || kindsOf(key).includes(kindFilter)) &&
        (!searching ||
          [
            serviceName(key),
            serviceHint(key),
            SEARCH_ALIASES[key] ?? "",
            ...kindItems(key).map((item) => item.label),
          ].some((text) => text.toLowerCase().includes(needle))),
    );
    return {
      ...group,
      services: group.sorted ? services.sort((a, b) => serviceName(a).localeCompare(serviceName(b))) : services,
    };
  }).filter((group) => group.services.length > 0);

  // ── "A specific model…": the offline index plus what the user's own Connections hold ──
  const ownAccountList = accounts ?? [];
  const ownCatalogs = useCachedCatalogFacts(
    ownAccountList.map((account) =>
      allRows.filter((row) => row.accountId === account.id && isChatProvider(row.provider ?? "")).map((row) => row.id),
    ),
  );
  const modelKind: ModelKind | null =
    kindFilter === "chat" || kindFilter === "image" || kindFilter === "video" ? kindFilter : null;
  const modelsOff = !!kindFilter && !modelKind;
  const modelIndex =
    step !== 1 || modelsOff
      ? []
      : withOwnConnections(
          OFFLINE_MODELS,
          ownAccountList.map((account, index) => {
            const models = new Map<string, { id: string; kind: ModelKind }>();
            for (const row of accountRows(account.id)) {
              const kind = rowKind(row.provider);
              if (kind && row.model?.trim()) models.set(modelKey(row.model), { id: row.model, kind });
            }
            for (const ids of ownCatalogs[index]?.idSets ?? [])
              for (const [key, id] of keysOf(ids)) if (!models.has(key)) models.set(key, { id, kind: "chat" });
            return { accountId: account.id, models };
          }),
        );
  const shownModels = searching
    ? searchModels(modelIndex, needle, modelKind, MODELS_SHOWN)
    : popularModels(modelIndex, modelKind, pick === "model" ? MODELS_SHOWN : 4);
  // A service the user already has a Connection of becomes that Connection; Connections go first.
  const routesOf = (entry: ModelEntry) => {
    const mine = new Map<string, string>();
    const services: Array<{ service: ServiceId; model: string }> = [];
    for (const route of entry.routes) {
      if ("accountId" in route) {
        if (!mine.has(route.accountId)) mine.set(route.accountId, route.model);
        continue;
      }
      const have = compatibleAccounts(route.service as ServiceId);
      if (have.length === 0) services.push({ service: route.service as ServiceId, model: route.model });
      for (const account of have) if (!mine.has(account.id)) mine.set(account.id, route.model);
    }
    return { mine: [...mine], services };
  };
  const shownJobs = job
    ? []
    : JOBS.filter((entry) =>
        searching
          ? entry.add !== false && `${jobLabel(entry.key)} ${entry.terms ?? ""}`.toLowerCase().includes(needle)
          : entry.add === undefined,
      ).map((entry) => entry.key);
  const chooseJob = (key: AddJob) => {
    setQuery("");
    // Voice and Dictation have no Model to pick: open their service's set-up screen.
    const device = JOB[key].device;
    if (device) return void chooseService(device);
    setJobFor({ job: key });
    setKindFilter(jobAddKind(key) ?? null);
  };
  const clearJob = () => {
    setJobFor(null);
    setKindFilter(null);
  };
  const sectionTitle = (text: string) => (
    <h4 className="px-1 text-xs font-semibold text-[var(--foreground)]">{text}</h4>
  );

  // Entry points that already know the job, kind or new-chat mode skip the cards, as before.
  const cards = step === 1 && !pick && !jobFor && !newChatMode && !searching;
  const jobList = pick === "job" && !job;
  const listJobs = cards || pick ? [] : shownJobs;
  const listModels = cards || jobList || pick === "provider" ? [] : shownModels;
  const listGroups = cards || jobList || pick === "model" ? [] : groups;
  const searchLabel = t(
    pick === "model"
      ? "connections.add.searchModels"
      : pick === "provider"
        ? "connections.add.searchProviders"
        : "connections.add.search",
  );
  const modelExample = shownModels[0];
  const exampleRoute = modelExample && routesOf(modelExample);
  const exampleService = exampleRoute
    ? exampleRoute.mine[0]
      ? accounts?.find((account) => account.id === exampleRoute.mine[0]![0])?.name
      : exampleRoute.services[0] && serviceName(exampleRoute.services[0].service)
    : undefined;
  const questions = [
    {
      id: "job",
      Icon: ListChecks,
      examples: (["decision", "voice", "embeddings"] as const).map((key) => ({
        label: jobLabel(key),
        Icon: JOB[key].icon,
      })),
    },
    {
      id: "model",
      Icon: Cpu,
      examples: exampleService
        ? [
            {
              label: t("connections.add.question.model.example", {
                model: modelExample!.name,
                service: exampleService,
              }),
            },
          ]
        : [],
    },
    { id: "provider", Icon: KeyRound, examples: [{ label: t("connections.add.question.provider.example") }] },
  ] as const;
  const serviceList = (
    <div className="flex flex-col gap-3 p-4">
      {firstRun && !pick && <FirstRunIntro text={t("connections.add.intro")} />}
      {!jobList && <ListSearch value={query} onChange={setQuery} label={searchLabel} placeholder={searchLabel} />}
      {cards && (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
          {questions.map(({ id, Icon, examples }) => (
            <button
              key={id}
              type="button"
              data-add-connection-question={id}
              onClick={() => {
                setPick(id);
                setKindFilter(null);
              }}
              className="mari-chrome-control mari-chrome-control--card min-h-24 !flex-row items-center gap-3 p-4 text-xs lg:min-h-36"
            >
              <span className="flex min-w-0 flex-1 items-start gap-3 self-stretch lg:flex-col">
                <span
                  aria-hidden="true"
                  className="mari-panel-gradient--connections mari-panel-gradient-surface flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                >
                  <Icon size="1.125rem" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-[0.9375rem] font-semibold">{t(`connections.add.question.${id}`)}</span>
                  <span className="text-[0.6875rem] leading-snug text-[var(--muted-foreground)]">
                    {t(`connections.add.question.${id}.body`)}
                  </span>
                  {examples.length > 0 && (
                    <span className="mt-1.5 flex flex-wrap items-center gap-1">
                      {examples.map((example) => (
                        <span key={example.label} className={cn(MUTED_BADGE_CLASS, "inline-flex items-center gap-1")}>
                          {"Icon" in example && <example.Icon size="0.625rem" aria-hidden />}
                          {example.label}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              </span>
              <ChevronRight
                size="1rem"
                className="shrink-0 self-center text-[var(--muted-foreground)] lg:hidden"
                aria-hidden
              />
            </button>
          ))}
        </div>
      )}
      {jobList && <JobCards rows={(rows ?? []) as ConnectionRowData[]} onPick={chooseJob} />}
      {!cards && !jobList && pick !== "provider" && (
        <div role="group" aria-label={t("connections.add.kindFilter")} className="flex flex-wrap gap-1.5">
          {/* Voice and Decision have no models to list, so the model list leaves them out. */}
          {[null, ...CHIP_KINDS.filter((kind) => pick !== "model" || MODEL_CHIP_KINDS.has(kind))].map((kind) => (
            <button
              key={kind ?? "all"}
              type="button"
              data-add-connection-kind={kind ?? "all"}
              aria-pressed={kindFilter === kind}
              onClick={() => setKindFilter(kind)}
              className="mari-connection-chip gap-1"
            >
              {kind &&
                (() => {
                  const Icon = KIND_ICONS[kind];
                  return <Icon size="0.75rem" aria-hidden />;
                })()}
              {t(`connections.add.kind.${kind ?? "all"}`)}
            </button>
          ))}
        </div>
      )}
      {job && (
        <p data-add-connection-job={job} className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className={cn(HIGHLIGHT_BADGE_CLASS, "gap-1")}>
            {(() => {
              const Icon = JOB[job].icon;
              return <Icon size="0.75rem" aria-hidden />;
            })()}
            {t("connections.add.forJob", { job: jobLabel(job) })}
          </span>
          <button
            type="button"
            data-add-connection-clear-job
            onClick={clearJob}
            aria-label={t("connections.add.clearJob")}
            title={t("connections.add.clearJob")}
            className="mari-connection-btn mari-connection-btn--ghost mari-connection-btn--icon"
          >
            <X size="0.75rem" aria-hidden />
          </button>
          <span className="w-full px-1 text-[0.6875rem] text-[var(--muted-foreground)]">
            {t("connections.add.forJobHint")}
          </span>
        </p>
      )}
      {listJobs.length > 0 && (
        <section data-add-connection-section="job" className="flex flex-col gap-1.5">
          {sectionTitle(t("connections.add.section.job"))}
          <div className="flex flex-wrap gap-1.5">
            {listJobs.map((key) => {
              const Icon = JOB[key].icon;
              return (
                <button
                  key={key}
                  type="button"
                  data-add-connection-job-choice={key}
                  onClick={() => chooseJob(key)}
                  className="mari-connection-chip gap-1"
                >
                  <Icon size="0.75rem" aria-hidden />
                  {jobLabel(key)}
                </button>
              );
            })}
          </div>
        </section>
      )}
      {listModels.length > 0 && (
        <section data-add-connection-section="model" className="flex flex-col gap-1.5">
          {pick !== "model" && sectionTitle(t("connections.add.section.model"))}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {listModels.map((entry) => {
              const { mine, services } = routesOf(entry);
              const pick = { kind: entry.kind };
              return (
                <div
                  key={`${entry.kind}:${entry.key}`}
                  data-add-model={entry.key}
                  className="mari-chrome-control mari-chrome-control--card min-h-16 !items-start gap-1 p-3 text-xs"
                >
                  <span className="block min-w-0 max-w-full truncate text-sm font-medium">{entry.name}</span>
                  <span className="flex flex-wrap items-center gap-1">
                    <span className="text-[0.6875rem] text-[var(--muted-foreground)]">
                      {t("connections.add.model.via")}
                    </span>
                    {mine.map(([accountId, model]) => {
                      const name = accounts?.find((account) => account.id === accountId)?.name ?? "";
                      return (
                        <button
                          key={accountId}
                          type="button"
                          data-add-model-account={accountId}
                          onClick={() => {
                            setWant({ model, ...pick });
                            void showModelsOf(accountId, undefined, entry.kind);
                          }}
                          aria-label={t("connections.add.model.addTo", { model: entry.name, name })}
                          className="mari-connection-chip gap-1 !text-[var(--mari-connection-ink)]"
                        >
                          {t("connections.add.model.yours", { name })}
                          <Check size="0.75rem" aria-hidden />
                        </button>
                      );
                    })}
                    {services.map(({ service: key, model }) => (
                      <button
                        key={key}
                        type="button"
                        data-add-model-service={key}
                        onClick={() => {
                          setWant({ model, ...pick });
                          void chooseService(key);
                        }}
                        aria-label={t("connections.add.model.connectFor", {
                          model: entry.name,
                          service: serviceName(key),
                        })}
                        className="mari-connection-chip"
                      >
                        {serviceName(key)}
                      </button>
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
      {listGroups.length > 0 && (listJobs.length > 0 || listModels.length > 0) && (
        <div className="-mb-1.5">{sectionTitle(t("connections.add.section.provider"))}</div>
      )}
      {listGroups.map((group) => {
        const capped = group.id === "vendors" && !searching && !showAllVendors && group.services.length > VENDORS_SHOWN;
        const shown = capped ? group.services.slice(0, VENDORS_SHOWN) : group.services;
        return (
          <ServiceGroup
            key={group.id}
            title={t(`connections.add.group.${group.id}`)}
            count={group.services.length}
            collapsible={!!group.folded && !searching}
            open={searching || otherOpen}
            onToggle={() => setOtherOpen((value) => !value)}
            more={
              capped && (
                <button
                  type="button"
                  data-add-connection-show-all
                  onClick={() => setShowAllVendors(true)}
                  className="mari-connection-btn mari-connection-btn--ghost mari-add-show-all self-start"
                >
                  {t("connections.add.showAll", { count: group.services.length })}
                </button>
              )
            }
          >
            {shown.map((key) => (
              <ServiceCard
                key={key}
                service={key}
                name={serviceName(key)}
                hint={serviceHint(key)}
                kinds={kindItems(key)}
                badges={badgesFor(key)}
                rail={group.id === "start"}
                selected={service === key}
                onClick={() => {
                  setWant(null);
                  if (key === DECISION_BUILTIN) setDecisionOpen(true);
                  else void chooseService(key);
                }}
              />
            ))}
          </ServiceGroup>
        );
      })}
      {searching && listGroups.length === 0 && listModels.length === 0 && listJobs.length === 0 && (
        <div data-add-connection-no-match className="flex flex-col items-center gap-2 py-4 text-center">
          <ListStatus className="py-0 text-xs text-[var(--muted-foreground)]">
            {t("connections.add.noMatch", { query: query.trim() })}
          </ListStatus>
          <button type="button" onClick={() => void chooseService("custom")} className={SECONDARY_CLASS}>
            {t("connections.add.useCustom")}
          </button>
        </div>
      )}
    </div>
  );

  // ── Step 2: access for the chosen service ──
  const existing = connectedAccounts[0];
  // Already connected: the user picks one of those connections or makes a new one before any field shows.
  const choosing = connectedAccounts.length > 0 && !target && !second;
  const keyUrl = selectedMedia
    ? MEDIA_KEY_URLS[selectedMedia.source]
    : service === LINKAPI_SERVICE
      ? LINKAPI.keyUrl
      : def?.keyUrl;
  const failure = tested && !tested.success && provider ? failureReason(provider, tested.message ?? "") : null;
  const requiresAccessKey = !keyless && !isLocal && (!isMedia || !!selectedMedia);
  const connectDisabled = busy || choosing || (isLocal && !baseUrl.trim()) || (requiresAccessKey && !apiKey.trim());
  const resetTest = () => setTested(null);
  const connectSecond = () => {
    setSecond(true);
    if (window.matchMedia?.("(pointer: fine)").matches) requestAnimationFrame(() => keyRef.current?.focus());
  };

  const keyField = (optional: boolean) => (
    <div className="flex flex-col gap-1">
      <label htmlFor="add-connection-key" className={labelClass}>
        {t(optional ? "connections.add.apiKeyOptional" : "connections.add.apiKey")}
      </label>
      <div className="flex gap-1.5">
        <input
          id="add-connection-key"
          ref={optional ? undefined : keyRef}
          type={showKey ? "text" : "password"}
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value);
            resetTest();
          }}
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="off"
          aria-describedby={tested ? "add-connection-key-help add-connection-result" : "add-connection-key-help"}
          className={cn(inputClass, "min-w-0 flex-1 font-mono")}
        />
        <button
          type="button"
          onClick={() => setShowKey((value) => !value)}
          aria-pressed={showKey}
          aria-label={t("connections.add.showKey")}
          title={t("connections.add.showKey")}
          className="mari-connection-btn mari-connection-btn--icon"
        >
          {showKey ? <EyeOff size="0.875rem" aria-hidden /> : <Eye size="0.875rem" aria-hidden />}
        </button>
      </div>
      <p id="add-connection-key-help" className="text-[0.6875rem] text-[var(--muted-foreground)]">
        {t("connections.add.keySaved")}
      </p>
      {keyUrl && !optional && (
        <p className="flex flex-wrap items-center gap-x-1.5 text-[0.6875rem]">
          <a
            href={keyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1 font-medium text-[var(--foreground)] underline decoration-[var(--muted-foreground)] underline-offset-2 hover:decoration-[var(--foreground)] md:min-h-0"
          >
            {t("connections.add.getKey")}
            <ExternalLink size="0.6875rem" aria-hidden />
            <span className="sr-only">{t("connections.add.newTab")}</span>
          </a>
          <span className="text-[var(--muted-foreground)]">· {hostOf(keyUrl)}</span>
        </p>
      )}
    </div>
  );

  const resultCard = tested && (
    <div
      id="add-connection-result"
      role="status"
      data-add-connection-result={tested.success ? "ok" : "failed"}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3",
        tested.success
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-[var(--destructive)]/40 bg-[var(--destructive)]/5",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          tested.success
            ? "bg-emerald-500/15 text-emerald-500"
            : "bg-[var(--destructive)]/15 text-[var(--destructive)]",
        )}
      >
        {tested.success ? <Check size="1rem" aria-hidden /> : <AlertCircle size="1rem" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        {tested.success ? (
          <p className="text-sm font-medium">
            {modelCount === undefined
              ? t("connections.add.connected")
              : t("connections.add.connectedModels", { count: modelCount })}
          </p>
        ) : (
          <>
            <p className="text-sm font-medium">
              {t(`connections.add.error.${failure ?? "other"}`, {
                host:
                  hostOf(baseUrl.trim() || selectedMedia?.defaultBaseUrl || def?.defaultBaseUrl || "") ||
                  serviceName(service ?? provider!),
              })}
            </p>
            {tested.message && (
              <p className="mt-1 break-words font-mono text-[0.625rem] text-[var(--muted-foreground)]">
                {tested.message}
              </p>
            )}
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {failure === "plan" && provider && LOGIN_COMMANDS[provider]
                ? t("connections.add.loginHint", { command: LOGIN_COMMANDS[provider] })
                : t(isLocal ? "connections.add.retryLocal" : "connections.add.retryKey")}
            </p>
          </>
        )}
      </div>
    </div>
  );

  const connectPane = provider && (
    <div className="flex flex-col gap-4 p-4 md:p-5">
      {/* The heading names the service; this row only says what it is and what it costs. */}
      <div className="flex items-center gap-3">
        <ServiceTile service={service ?? provider} />
        <div className="min-w-0 flex-1 text-xs leading-snug text-[var(--muted-foreground)]">
          <p>{service ? serviceHint(service) : t(`connections.add.hint.${provider}`)}</p>
          {/* The existing connections below show their own billing (a NanoGPT plan is not pay per use). */}
          {def?.billing && !choosing && (
            <p className="mt-0.5 text-[0.6875rem]">{t(`connections.add.billingInfo.${def.billing}`)}</p>
          )}
        </div>
      </div>

      {choosing && (
        <div data-add-connection-existing className="flex flex-col gap-3">
          <ul className="flex flex-col gap-2">
            {connectedAccounts.map((account) => (
              <li key={account.id} className="mari-connection-group">
                <ServiceRow
                  account={account}
                  rows={accountRows(account.id)}
                  count={t("connections.list.models", { count: accountRows(account.id).length })}
                  state={account.state}
                  stateLabel={t(`connections.accounts.state.${account.state}`)}
                  billing={account.billing}
                  data-add-connection-existing-account={account.id}
                  onClick={() => void showModelsOf(account.id)}
                  disabled={closeBlocked}
                  trailing={
                    <ChevronRight size="1rem" className="shrink-0 text-[var(--muted-foreground)]" aria-hidden />
                  }
                />
              </li>
            ))}
          </ul>
          <button
            type="button"
            data-add-connection-make-new
            onClick={connectSecond}
            className={cn(SECONDARY_CLASS, "self-start")}
          >
            {t("connections.add.makeNew")}
          </button>
        </div>
      )}

      {!choosing && (
        <>
          {second && !keyless && (
            <p className="text-xs text-[var(--muted-foreground)]">
              {t(isLocal ? "connections.add.secondServer" : "connections.add.secondKey")}
            </p>
          )}
          {isLocal && (
            <div className="flex flex-col gap-1">
              <label htmlFor="add-connection-url" className={labelClass}>
                {t("connections.add.serverAddress")}
              </label>
              <input
                id="add-connection-url"
                ref={keyRef}
                value={baseUrl}
                onChange={(e) => {
                  setBaseUrl(e.target.value);
                  resetTest();
                }}
                placeholder={selectedMedia ? undefined : LOCAL_PRESETS[0]!.url}
                inputMode="url"
                spellCheck={false}
                autoCapitalize="off"
                aria-describedby={tested ? "add-connection-result" : undefined}
                className={cn(inputClass, "font-mono")}
              />
              {!selectedMedia && (
                <div className="flex flex-wrap gap-1 pt-1" role="group" aria-label={t("connections.add.presets")}>
                  {LOCAL_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setBaseUrl(preset.url);
                        resetTest();
                      }}
                      aria-pressed={baseUrl.trim() === preset.url}
                      className="mari-connection-chip gap-1"
                    >
                      <BrandMark of={preset.label} className="h-3 w-3" />
                      {preset.label}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{t("connections.add.noKeyNeeded")}</p>
            </div>
          )}
          {requiresAccessKey && keyField(false)}
          {keyless && <p className="text-xs text-[var(--muted-foreground)]">{t("connections.add.keyless")}</p>}
          {isMedia && <p className="text-xs text-[var(--muted-foreground)]">{t("connections.add.mediaNext")}</p>}

          {resultCard}

          {(!isMedia || selectedMedia) && (
            <>
              <button
                type="button"
                onClick={() => setMoreOpen((value) => !value)}
                aria-expanded={moreOpen}
                aria-controls="add-connection-more"
                className="flex min-h-11 items-center gap-1.5 self-start rounded-lg px-1 text-[0.6875rem] font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] md:min-h-9"
              >
                <ChevronDown size="0.75rem" className={cn("transition-transform", moreOpen && "rotate-180")} />
                {t("connections.add.moreOptions")}
              </button>
              <SmoothFolderContent open={moreOpen}>
                <div id="add-connection-more" className="flex flex-col gap-2 pb-1">
                  {isLocal && keyField(true)}
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-[var(--muted-foreground)]">{t("connections.add.name")}</span>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={
                        // Next to another Connection of this service the automatic name ends with the key's last 4.
                        !isLocal && existing ? withKeyTail(def?.name ?? "", apiKey) : def?.name
                      }
                      className={inputClass}
                    />
                  </label>
                  {!isLocal && (!keyless || selectedMedia) && (
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-[var(--muted-foreground)]">{t("connections.add.endpoint")}</span>
                      <input
                        value={baseUrl}
                        onChange={(e) => {
                          setBaseUrl(e.target.value);
                          resetTest();
                        }}
                        placeholder={selectedMedia?.defaultBaseUrl ?? def?.defaultBaseUrl}
                        inputMode="url"
                        className={cn(inputClass, "font-mono")}
                      />
                    </label>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {t("connections.add.maxRequestsPerMinute")}
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={600}
                        value={maxRpm}
                        onChange={(e) => setMaxRpm(e.target.value)}
                        className={inputClass}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {t("connections.add.maxParallelJobs")}
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={16}
                        value={maxJobs}
                        onChange={(e) => setMaxJobs(e.target.value)}
                        className={inputClass}
                      />
                    </label>
                  </div>
                </div>
              </SmoothFolderContent>
            </>
          )}
        </>
      )}
    </div>
  );

  // ── Step 2 for "On this device": each part keeps its own set-up controls ──
  const deviceState = device ? deviceSetup[DEVICE_ITEMS[device]] : null;
  const devicePane = device && (
    <div className="flex flex-col gap-4 p-4 md:p-5">
      <div className={cn("flex items-start gap-3", device !== "local_model" && "hidden")}>
        <ServiceTile service={device} />
        <div className="min-w-0 flex-1 text-xs leading-snug text-[var(--muted-foreground)]">
          <p>{t(`connections.add.hint.${device}`)}</p>
          <p data-add-connection-device-state className="mt-1 text-[0.6875rem]">
            {t(deviceState?.setUp ? "connections.add.deviceReady" : "connections.add.deviceNotSetUp")}
          </p>
        </div>
      </div>
      {device === "local_model" && (
        <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">{t("connections.add.localModelInfo")}</p>
      )}
      {device === "tts" && <TTSConfigCard defaultExpanded />}
      {device === "stt" && <SpeechToTextCard defaultExpanded />}
      {device === "stt" && import.meta.env.VITE_MARINARA_LITE !== "true" && <LocalWhisper />}
    </div>
  );

  // ── Step 3: star models ──
  const chat = modelsFor?.chat;
  const targetRows = target ? accountRows(target.accountId) : [];
  const availableKinds = (() => {
    const fromService = service
      ? kindsOf(service).filter((kind): kind is AddableKind => kind === "chat" || kind === "image" || kind === "video")
      : [];
    if (fromService.length > 0) return fromService;
    const inferred: AddableKind[] = [];
    if (targetRows.some((row) => isChatProvider(row.provider ?? ""))) inferred.push("chat");
    if (targetRows.some((row) => row.provider === "image_generation")) inferred.push("image");
    if (targetRows.some((row) => row.provider === "video_generation")) inferred.push("video");
    return inferred;
  })();
  const inPlace =
    !!target &&
    !!shownRow &&
    isChatProvider(shownRow.provider ?? "") &&
    !shownRow.model?.trim() &&
    picks.length === 0 &&
    (target.fresh || !!target.ownedPlaceholderIds?.includes(shownRow.id));
  const recommended = provider && !NO_RECOMMENDED.has(provider) ? (MODEL_LISTS[provider] ?? []).slice(0, 3) : [];
  const targetName =
    (target && accounts?.find((account) => account.id === target.accountId)?.name) ||
    serviceName(service ?? provider ?? "custom");
  const modelName = (modelId: string) =>
    modelList.data?.models?.find((model) => model.id === modelId)?.name ||
    (provider && MODEL_LISTS[provider]?.find((model) => model.id === modelId)?.name) ||
    modelId;
  const mediaRow = mediaRowId ? allRows.find((row) => row.id === mediaRowId) : undefined;
  const isJobKind = setupKind === "decision" || setupKind === "voice";
  // A chat service lists its own models for the job; the old Decision and Audio services keep theirs.
  const jobPicker = isJobKind && !!pickerRow && !!mediaRow && isChatProvider(pickerRow.provider ?? "");

  // ── Header: Back, the step's heading and "Step n of N" ──
  const heading =
    step === 1
      ? t(
          jobList
            ? "connections.add.heading.forJob"
            : pick === "model"
              ? "connections.add.heading.forModel"
              : pick === "provider"
                ? "connections.add.heading.forProvider"
                : "connections.add.heading.service",
        )
      : step === 2
        ? device
          ? t("connections.add.heading.device", { service: serviceName(device) })
          : choosing
            ? t("connections.add.heading.useExisting", { service: serviceName(service ?? provider!) })
            : isMedia || keyless
              ? t("connections.add.heading.connect", { service: serviceName(service ?? provider!) })
              : isLocal
                ? t("connections.add.heading.local")
                : t("connections.add.heading.key", { service: serviceName(service ?? provider!) })
        : step === 3
          ? t("connections.add.heading.addModels", { name: targetName })
          : "";
  const subtitle =
    step === 1
      ? newChatMode
        ? t("connections.add.sub.gate", { mode: t(`connections.add.mode.${newChatMode}`) })
        : job
          ? t("connections.add.sub.job", { job: jobLabel(job) })
          : t(
              jobList
                ? "connections.add.forJobHint"
                : pick === "model"
                  ? "connections.add.subtitle.forModel"
                  : pick === "provider"
                    ? "connections.add.subtitle.forProvider"
                    : "connections.add.subtitle.pick",
            )
      : step === 2
        ? t(
            device
              ? "connections.add.sub.device"
              : choosing
                ? "connections.add.sub.useExisting"
                : isMedia
                  ? "connections.add.sub.media"
                  : keyless
                    ? "connections.add.sub.plan"
                    : isLocal
                      ? "connections.add.sub.local"
                      : "connections.add.sub.key",
          )
        : step === 3
          ? t(
              setupKind === "image" || setupKind === "video"
                ? "connections.add.sub.mediaModels"
                : setupKind === "decision"
                  ? "connections.add.sub.decision"
                  : setupKind === "voice"
                    ? "connections.add.sub.voice"
                    : modelsFor?.chat
                      ? "connections.add.sub.modelsChat"
                      : "connections.add.sub.models",
            )
          : "";
  const stepNumber = step;
  // Every path has the same three steps, so the bar never jumps; a device ends on its set-up screen.
  const totalSteps = 3;
  const goBack =
    step === 1 && pick
      ? () => {
          if (job) clearJob();
          else setPick(null);
          setQuery("");
          setKindFilter(null);
          setShowAllVendors(false);
          setOtherOpen(false);
        }
      : step === 2
        ? backToList
        : step === 3 && !modelsFor && picks.length === 0
          ? target?.fresh
            ? () => setStep(2)
            : backToList
          : null;

  // ── Footer: one primary per step ──
  let footerLeft: ReactNode = null;
  let footerRight: ReactNode = null;
  if (step === 1) {
    footerLeft = (
      <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{t("connections.add.footer.service")}</p>
    );
  } else if (step === 2) {
    footerRight = device ? (
      device === "local_model" ? (
        <button
          type="button"
          data-add-connection-device-open
          onClick={() => useSidecarStore.getState().setShowDownloadModal(true)}
          className={PRIMARY_CLASS}
        >
          {t(deviceState?.setUp ? "connections.add.localModelOpen" : "connections.add.localModelDownload")}
        </button>
      ) : (
        <button type="button" onClick={onClose} className={PRIMARY_CLASS}>
          {t("connections.add.done")}
        </button>
      )
    ) : choosing ? null : tested?.success ? (
      <button type="button" onClick={() => setStep(3)} className={PRIMARY_CLASS}>
        {t("connections.add.continue")}
      </button>
    ) : (
      <div className="flex items-center gap-3">
        {failure && isLocal && target && (
          <button
            type="button"
            onClick={() => setStep(3)}
            className="min-h-11 text-xs text-[var(--muted-foreground)] underline underline-offset-2 hover:text-[var(--foreground)] md:min-h-0"
          >
            {t("connections.add.continueAnyway")}
          </button>
        )}
        <button
          type="button"
          data-add-connection-connect
          onClick={() => void saveAndTest()}
          disabled={connectDisabled}
          className={PRIMARY_CLASS}
        >
          {busy && <Loader2 size="0.75rem" className="animate-spin" aria-hidden />}
          {t(
            isMedia ? "connections.add.connect" : failure ? "connections.add.tryAgain" : "connections.add.testContinue",
          )}
        </button>
      </div>
    );
  } else if (step === 3 && setupKind) {
    footerLeft = picks.length > 0 && (
      <p role="status" className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
        <Check size="0.75rem" className="text-[var(--primary)]" aria-hidden />
        {t("connections.add.picked", { count: picks.length })}
      </p>
    );
    footerRight =
      isJobKind && !jobTest?.ok ? (
        <button
          type="button"
          data-add-connection-job-test-run
          onClick={() => void runJobTest()}
          disabled={jobTesting || !mediaRow || (jobPicker && !mediaRow.model?.trim())}
          className={PRIMARY_CLASS}
        >
          {jobTesting && <Loader2 size="0.75rem" className="animate-spin" aria-hidden />}
          {t(setupKind === "decision" ? "connections.add.testDecision" : "connections.add.testVoice")}
        </button>
      ) : onStartChat && firstPick ? (
        <button
          type="button"
          onClick={() => void startChatting()}
          disabled={finishing}
          className={PRIMARY_CLASS}
          data-add-connection-start
        >
          {finishing && <Loader2 size="0.75rem" className="animate-spin" aria-hidden />}
          {t("connections.add.startChatting")}
        </button>
      ) : (
        <button
          type="button"
          data-add-connection-done
          // Done applies the choices above the footer and closes; the panel then shows the new card.
          onClick={() => void close(true)}
          // A new Connection needs one model; without it the window throws the Connection away.
          disabled={finishing || (target?.fresh && picks.length === 0)}
          className={PRIMARY_CLASS}
        >
          {finishing && <Loader2 size="0.75rem" className="animate-spin" aria-hidden />}
          {t("connections.add.done")}
        </button>
      );
  }

  const firstName = firstPick ? modelName(firstPick.modelId) : "";
  const checkClass = "h-[1.125rem] w-[1.125rem] shrink-0 accent-[var(--primary)]";
  const optionClass =
    "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm hover:bg-[var(--marinara-chat-chrome-highlight-bg-hover)]";
  // On sm+ the top sits where the tall panel's centred top is, so the short cards screen grows downward
  // and the search field stays under the caret when typing switches to the tall results.
  const panelClass = cn(
    "mari-connection-scope sm:mt-[max(0px,calc((100dvh_-_min(90dvh,44rem))_/_2_-_1rem))] sm:self-start",
    !cards && "sm:h-[min(90dvh,44rem)]",
  );

  return (
    <Modal
      open={open}
      onClose={requestClose}
      title={t(modelsFor ? "connections.accounts.addModel" : "connections.add.title")}
      width="max-w-3xl lg:max-w-4xl"
      mobileFullscreen
      opaque
      closeDisabled={closeBlocked}
      panelClassName={panelClass}
      contentClassName="flex flex-col overflow-hidden! p-0!"
    >
      <div data-add-connection-step={step} className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-[var(--marinara-chat-chrome-panel-divider)] px-5 py-3 max-md:px-4">
          <div className="flex items-center gap-2">
            {goBack && (
              <button
                type="button"
                onClick={() => {
                  if (!closeBlocked) void goBack();
                }}
                disabled={closeBlocked}
                aria-label={t("connections.add.back")}
                title={t("connections.add.back")}
                className="mari-connection-btn mari-connection-btn--ghost mari-connection-btn--icon -ms-2"
              >
                <ChevronLeft size="1rem" aria-hidden />
              </button>
            )}
            <h3
              ref={headingRef}
              tabIndex={-1}
              aria-describedby={modelsFor ? undefined : "add-connection-step-count"}
              className="min-w-0 flex-1 text-sm font-semibold outline-none"
            >
              {heading}
            </h3>
            {!modelsFor && (
              <span
                id="add-connection-step-count"
                className="shrink-0 text-[0.6875rem] tabular-nums text-[var(--muted-foreground)]"
              >
                {t("connections.add.stepOf", { step: stepNumber, total: totalSteps })}
              </span>
            )}
          </div>
          {!modelsFor && (
            <div aria-hidden className="mt-2 flex gap-1">
              {Array.from({ length: totalSteps }, (_, index) => (
                <span
                  key={index}
                  className={cn(
                    "h-[3px] flex-1 rounded-full",
                    index < stepNumber
                      ? "bg-[var(--marinara-chat-chrome-accent)]"
                      : "bg-[var(--marinara-chat-chrome-panel-divider)]",
                  )}
                />
              ))}
            </div>
          )}
          {subtitle && (
            <p className="mt-1.5 text-[0.6875rem] text-[var(--muted-foreground)]">
              <StarText text={subtitle} />
            </p>
          )}
        </div>

        <div key={String(step)} className="animate-fade-in-up flex min-h-0 flex-1 flex-col">
          {step === 1 && <div className="h-full min-h-0 overflow-y-auto overscroll-contain">{serviceList}</div>}
          {step === 2 && (
            <section className="h-full min-h-0 overflow-y-auto overscroll-contain">
              <div className="mx-auto max-w-xl">{devicePane ?? connectPane}</div>
            </section>
          )}

          {step === 3 && target && availableKinds.length > 1 && !chat && !isJobKind && (
            <div
              role="group"
              aria-label={t("connections.add.kindFilter")}
              className="flex shrink-0 flex-wrap gap-1.5 px-5 pt-3 max-md:px-4"
            >
              {availableKinds.map((kind) => {
                const Icon = KIND_ICONS[kind];
                return (
                  <button
                    key={kind}
                    type="button"
                    data-add-connection-capability={kind}
                    aria-pressed={setupKind === kind}
                    disabled={closeBlocked}
                    onClick={() => {
                      if (setupKind === kind) return;
                      setMediaRowId(null);
                      setSetupKind(kind);
                    }}
                    className="mari-connection-chip gap-1"
                  >
                    <Icon size="0.75rem" aria-hidden />
                    {t(`connections.add.kind.${kind}`)}
                  </button>
                );
              })}
            </div>
          )}

          {step === 3 && (setupKind === "image" || setupKind === "video") && mediaRow && (
            <ConnectionModelPicker
              className="h-full"
              // No account here: a model taken back off stays on its row instead of removing the row.
              connection={{ ...mediaRow, accountId: undefined }}
              accountName={targetName}
              onPicked={(modelId) => recordPick(mediaRow.id, modelId, setupKind)}
              preselect={want?.kind === setupKind ? want.model : undefined}
              addedIds={addedIds}
              addMode
              onUnstar={unstar}
              footer={null}
              autoFocusSearch
            />
          )}

          {step === 3 && isJobKind && target && (
            <div className="flex h-full min-h-0 flex-col">
              {jobPicker && pickerRow && mediaRow && (
                <ConnectionModelPicker
                  className="min-h-0 flex-1"
                  // The service's own list; a tap sets the model of the new decision or voice row.
                  connection={{ ...pickerRow, model: mediaRow.model ?? "" }}
                  accountName={targetName}
                  onChoose={chooseJobModel}
                  only={setupKind === "voice" ? isSpeechModel : undefined}
                  footer={null}
                  autoFocusSearch
                />
              )}
              {jobTest && (
                <div
                  role="status"
                  data-add-connection-job-test={jobTest.ok ? "ok" : "failed"}
                  className={cn(
                    "mx-5 my-3 flex shrink-0 items-start gap-3 rounded-xl border p-3 max-md:mx-4",
                    jobTest.ok
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-[var(--destructive)]/40 bg-[var(--destructive)]/5",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      jobTest.ok
                        ? "bg-emerald-500/15 text-emerald-500"
                        : "bg-[var(--destructive)]/15 text-[var(--destructive)]",
                    )}
                  >
                    {jobTest.ok ? <Check size="1rem" aria-hidden /> : <AlertCircle size="1rem" aria-hidden />}
                  </span>
                  <p className="min-w-0 flex-1 self-center break-words text-sm">{jobTest.message}</p>
                </div>
              )}
            </div>
          )}

          {step === 3 && setupKind === "chat" && target && pickerRow && (
            <ConnectionModelPicker
              className="h-full"
              // From a chat's quick switch the check marks what that chat runs, and a tap chooses for it.
              connection={chat ? { ...pickerRow, model: chat.currentModel } : pickerRow}
              onChoose={
                chat
                  ? async (choice) => {
                      await chat.onChoose(choice);
                      onClose();
                    }
                  : undefined
              }
              accountName={targetName}
              onPicked={inPlace ? (modelId) => recordPick(target.connectionId, modelId) : undefined}
              applyPick={inPlace ? undefined : async (connectionId, modelId) => recordPick(connectionId, modelId)}
              recommended={recommended}
              preselect={want?.kind === "chat" ? want.model : undefined}
              addedIds={addedIds}
              addMode
              onUnstar={unstar}
              footer={null}
              autoFocusSearch
            />
          )}
        </div>

        {step === 3 && firstPick && !chat && (
          <div
            data-add-connection-choices
            role="group"
            aria-label={t("connections.add.readyChoices")}
            className="flex shrink-0 flex-wrap items-center gap-x-4 border-t border-[var(--marinara-chat-chrome-panel-divider)] px-5 max-md:px-3"
          >
            {chatTarget && (
              <label className={optionClass}>
                <input
                  type="checkbox"
                  checked={useInChat}
                  onChange={(event) => setUseInChat(event.target.checked)}
                  className={checkClass}
                  data-add-connection-use-in-chat
                />
                <span className="min-w-0">{t("connections.add.useInChat", { model: firstName })}</span>
              </label>
            )}
            {alreadyMain ? (
              <p className="flex min-h-11 items-center px-2 text-xs text-[var(--muted-foreground)]">
                {t("connections.add.isMain", { model: firstName })}
              </p>
            ) : offerMain ? (
              <label className={optionClass}>
                <input
                  type="checkbox"
                  checked={makeMainOn}
                  onChange={(event) => setMakeMain(event.target.checked)}
                  className={checkClass}
                  data-add-connection-make-main
                />
                <span className="min-w-0">
                  {t("connections.add.makeMain", { model: firstName })}
                  <span className="text-xs text-[var(--muted-foreground)]"> · {t("connections.add.makeMainHint")}</span>
                </span>
              </label>
            ) : (
              <button
                type="button"
                data-add-connection-set-main
                onClick={() => void setAsMain()}
                disabled={updateRow.isPending}
                className="min-h-11 px-2 text-xs text-[var(--muted-foreground)] underline underline-offset-2 hover:text-[var(--foreground)] disabled:opacity-50"
              >
                {t("connections.add.setAsMain", { model: firstName })}
              </button>
            )}
          </div>
        )}

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--marinara-chat-chrome-panel-divider)] px-5 py-3 max-md:px-4">
          <div className="flex min-w-0 items-center gap-2">{footerLeft}</div>
          {footerRight}
        </div>
      </div>
      {/* The decision sidecar is its own model and process; its experimental installer opens from "Other". */}
      <DecisionModelModal open={decisionOpen} onClose={() => setDecisionOpen(false)} />
    </Modal>
  );
}

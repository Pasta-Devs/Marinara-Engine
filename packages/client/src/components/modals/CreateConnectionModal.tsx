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
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Search,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  IMAGE_GENERATION_SOURCES,
  IMAGE_SOURCE_VENDOR,
  MODEL_LISTS,
  PROVIDERS,
  VIDEO_GENERATION_SOURCES,
  inferImageSource,
  inferVideoSource,
  isChatProvider,
  isLocalAuthProvider,
  withKeyTail,
  type APIProvider,
} from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";
import { SmoothFolderContent } from "../ui/SmoothFolderContent";
import { ConnectionEditor } from "../connections/ConnectionEditor";
import { ConnectionIdentity } from "../connections/ConnectionIdentity";
import { ConnectionModelPicker } from "../connections/ConnectionModelPicker";
import { BrandMark, ProviderIcon } from "../connections/ProviderIcon";
import { StarText } from "../connections/StarText";
import {
  useCreateConnection,
  useConnectionModels,
  useConnections,
  useDeleteConnection,
  useTestConnection,
  useUpdateConnection,
} from "../../hooks/use-connections";
import {
  useConnectionAccounts,
  useCreateConnectionAccount,
  useDeleteConnectionAccount,
  useUpdateConnectionAccount,
} from "../../hooks/use-connection-accounts";
import { useSetChatModel } from "../../hooks/use-chats";
import { useChatStore } from "../../stores/chat.store";
import { useSidecarStore } from "../../stores/sidecar.store";
import { useDeviceSetup, type DeviceItem } from "../../hooks/use-device-setup";
import type { ModelsFor } from "../../lib/add-connection";
import { TTSConfigCard } from "../panels/settings/TTSConfigCard";
import { SpeechToTextCard } from "../panels/settings/SpeechToTextCard";
import { LocalWhisper } from "../connections/DeviceDetail";
import { DecisionModelModal } from "./DecisionModelModal";
import { starAnchorOf } from "../../hooks/use-model-star";
import { isConnectionFlagTrue } from "../../lib/connection-filters";
import { cn } from "../../lib/utils";

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
}

/** "On this device" (decision 32): built-in parts set up with their own controls, listed here so people find them. */
type DeviceService = "local_model" | "tts" | "stt";
type MediaServiceId = `media:${string}`;
export type ServiceId = APIProvider | DeviceService | MediaServiceId;
const DEVICE_ITEMS: Record<DeviceService, DeviceItem> = { local_model: "local-model", tts: "tts", stt: "stt" };
const isDevice = (service: ServiceId | null): service is DeviceService => !!service && service in DEVICE_ITEMS;
type Kind = "chat" | "image" | "video" | "voice" | "local";
type AddableKind = "chat" | "image" | "video";

type MediaBackend = {
  id: MediaServiceId;
  source: string;
  name: string;
  description: string;
  defaultBaseUrl: string;
  requiresApiKey: boolean;
  image: boolean;
  video: boolean;
};

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
    if (IMAGE_SOURCE_VENDOR[source.id] || VIDEO_SOURCE_VENDOR[source.id]) continue;
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
  return [...bySource.values()];
})();
const mediaBackendOf = (service: ServiceId | null) =>
  typeof service === "string" && service.startsWith("media:")
    ? (MEDIA_BACKENDS.find((backend) => backend.id === service) ?? null)
    : null;

const SERVICE_KINDS: Partial<Record<ServiceId, Kind[]>> = {
  custom: ["chat", "local"],
  local_model: ["local"],
  tts: ["voice", "local"],
  stt: ["voice", "local"],
  image_generation: ["image"],
  video_generation: ["video"],
  audio: ["voice"],
  // Decision answers yes/no questions for agents; it only shows under "All".
  decision: [],
};
const kindsOf = (service: ServiceId): Kind[] => {
  const media = mediaBackendOf(service);
  if (media) return [...(media.image ? (["image"] as const) : []), ...(media.video ? (["video"] as const) : [])];
  if (SERVICE_KINDS[service]) return SERVICE_KINDS[service]!;
  if (isDevice(service)) return SERVICE_KINDS[service] ?? ["local"];
  const provider = service as APIProvider;
  return [
    ...(isChatProvider(provider) ? (["chat"] as const) : []),
    ...(Object.values(IMAGE_SOURCE_VENDOR).includes(provider) ? (["image"] as const) : []),
    ...(Object.values(VIDEO_SOURCE_VENDOR).includes(provider) ? (["video"] as const) : []),
  ];
};
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Open groups are the paths most people take; the long vendor list folds behind a chevron. */
const SERVICE_GROUPS: Array<{ id: string; services: ServiceId[]; collapsed?: boolean }> = [
  { id: "start", services: ["openrouter", "nanogpt"] },
  { id: "plan", services: ["openai_chatgpt", "claude_subscription", "grok_subscription"] },
  { id: "device", services: ["local_model", "tts", "stt"] },
  { id: "address", services: ["custom"] },
  {
    id: "vendors",
    collapsed: true,
    services: ["openai", "anthropic", "google", "google_vertex", "mistral", "cohere", "xai", "zai", "deepseek", "arli"],
  },
  { id: "media", services: [...MEDIA_BACKENDS.map((backend) => backend.id), "audio", "decision"] },
];

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
};
type TestResult = { success: boolean; message?: string };

const inputClass = "mari-chrome-field h-11 w-full px-3 text-xs md:h-9";
const labelClass = "text-xs font-medium text-[var(--muted-foreground)]";
const PRIMARY_CLASS = "mari-connection-btn mari-connection-btn--primary";
const SECONDARY_CLASS = "mari-connection-btn";
const BADGE_CLASS = "mari-connection-pill";
const HIGHLIGHT_BADGE_CLASS = "mari-connection-pill mari-connection-pill--blue";

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
};

/** A plain reason for a failed test; the raw message stays visible below it. */
function failureReason(provider: APIProvider, message: string): "plan" | "key" | "busy" | "unreachable" | "other" {
  if (isLocalAuthProvider(provider)) return "plan";
  const status = /API returned (\d{3})/u.exec(message)?.[1];
  if (status === "401" || status === "403") return "key";
  if (status === "429") return "busy";
  if (!status && /connection failed|fetch failed|ENOTFOUND|ECONNREFUSED|EAI_AGAIN|timed? ?out/iu.test(message))
    return "unreachable";
  return "other";
}

/** The service tile: its white brand mark on the brand colour (decision 34c), else an icon or the initials. */
function ServiceTile({ service }: { service: ServiceId }) {
  const media = mediaBackendOf(service);
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
  selected,
  onClick,
}: {
  service: ServiceId;
  name: string;
  hint: string;
  /** What it gives, like "Chat · Images". */
  kinds: string;
  badges: Array<{ label: string; highlight?: boolean }>;
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
      aria-description={[hint, kinds, ...badges.map((badge) => badge.label)].filter(Boolean).join(". ")}
      className="mari-chrome-control mari-chrome-control--card min-h-16 p-3 text-xs"
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
          {kinds && (
            <span className="mt-0.5 block text-[0.625rem] font-medium text-[var(--muted-foreground)]">{kinds}</span>
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
  children,
}: {
  title: string;
  count: number;
  collapsible: boolean;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const list = <div className="grid grid-cols-1 gap-2 md:grid-cols-2">{children}</div>;
  if (!collapsible) {
    return (
      <section className="flex flex-col gap-1.5">
        <h4 className="px-1 text-xs font-semibold text-[var(--muted-foreground)]">{title}</h4>
        {list}
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

export function CreateConnectionModal({ open, onClose, initialService, modelsFor, newChatMode, onStartChat }: Props) {
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
  const activeChatId = useChatStore((s) => s.activeChatId);
  const deviceSetup = useDeviceSetup();

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
  const [step, setStep] = useState<1 | 2 | 3 | "ready">(modelsFor ? 3 : startingService ? 2 : 1);
  const [target, setTarget] = useState<Target | null>(null);
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [maxRpm, setMaxRpm] = useState("");
  const [maxJobs, setMaxJobs] = useState("");
  const [tested, setTested] = useState<TestResult | null>(null);
  // The models starred in this setup, in order; the first one is what the ready screen offers.
  const [picks, setPicks] = useState<Array<{ connectionId: string; modelId: string }>>([]);
  const [setupKind, setSetupKind] = useState<AddableKind | null>(null);
  const [mediaEditorId, setMediaEditorId] = useState<string | null>(null);
  const [mediaSaved, setMediaSaved] = useState(false);
  const [mediaCreating, setMediaCreating] = useState(false);
  const [editorBusy, setEditorBusy] = useState(false);
  const [editorCloseRequest, setEditorCloseRequest] = useState(0);
  const [editorExit, setEditorExit] = useState<"close" | "back">("close");
  const [query, setQuery] = useState("");
  const [vendorsOpen, setVendorsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  // A service that is already connected: the user chose to connect a second account of it.
  const [second, setSecond] = useState(false);
  // Ready screen; null = "Make Main" is on when there is no Main model yet.
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
  const isLocal = provider === "custom";
  const isMedia = !!provider && !isChatProvider(provider);
  const busy = createAccount.isPending || updateAccount.isPending || testConnection.isPending;
  const closeBlocked =
    finishing ||
    busy ||
    mediaCreating ||
    editorBusy ||
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
    !isMedia && (!!tested?.success || step === 3 || step === "ready"),
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
  }, [step, provider]);

  const serviceName = (key: ServiceId) => {
    const media = mediaBackendOf(key);
    return media
      ? media.name
      : isDevice(key)
        ? t(`connections.add.device.${key}`)
        : key === "decision" || key === "custom"
          ? t(key === "custom" ? "connections.add.customName" : "connections.decision.label")
          : (PROVIDERS[key as APIProvider]?.name ?? key);
  };
  const serviceHint = (key: ServiceId) => mediaBackendOf(key)?.description ?? t(`connections.add.hint.${key}`);
  const kindsLabel = (key: ServiceId) =>
    kindsOf(key)
      .map((value) => t(`connections.add.kind.${value}`))
      .join(" · ");

  // Throw away the empty Model of a Connection that was created but never got a Model picked.
  const discard = async () => {
    if (!target || picks.length > 0) return;
    try {
      if (target.fresh && !mediaSaved) {
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

  // The ready screen's choices. Main changes only here, and only with its box on.
  const firstPick = picks[0];
  const firstPickRow = firstPick && allRows.find((row) => row.id === firstPick.connectionId);
  const alreadyMain = isConnectionFlagTrue((firstPickRow as Record<string, unknown> | undefined)?.isDefault);
  const makeMainOn = makeMain ?? !hasMain;
  const applyReadyChoices = async () => {
    if (!firstPick) return true;
    if (makeMainOn && !alreadyMain) {
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

  // Add model has no ready screen: with no Main model yet, the first model starred there becomes Main when the
  // screen closes. The guided setup asks on its ready screen instead, where the box starts on.
  const autoMain = async () => {
    const row = !hasMain && firstPick ? allRows.find((candidate) => candidate.id === firstPick.connectionId) : null;
    if (!row || !isChatProvider(row.provider ?? "")) return;
    try {
      await updateRow.mutateAsync({ id: row.id, isDefault: true, ...(hasAgents ? {} : { defaultForAgents: true }) });
    } catch (error) {
      toast.error(t("connections.switcher.defaultFailed", { error: errorText(error) }));
    }
  };

  const close = async (saveChoices = false) => {
    setFinishing(true);
    try {
      if (saveChoices && step === "ready" && !(await applyReadyChoices())) return;
      if (modelsFor && !modelsFor.chat) await autoMain();
      await discard();
    } finally {
      setFinishing(false);
    }
    onClose();
  };

  const requestClose = () => {
    if (closeBlocked) return;
    if (mediaEditorId) {
      setEditorExit("close");
      setEditorCloseRequest((current) => current + 1);
      return;
    }
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
    setMediaEditorId(null);
    setMediaSaved(false);
    setMediaCreating(false);
    setEditorBusy(false);
    setEditorCloseRequest(0);
    setEditorExit("close");
  };

  const chooseService = async (key: ServiceId) => {
    await discard();
    resetFields();
    const media = mediaBackendOf(key);
    setService(key);
    setProvider(
      isDevice(key) ? null : media ? (media.image ? "image_generation" : "video_generation") : (key as APIProvider),
    );
    setDevice(isDevice(key) ? key : null);
    setStep(2);
  };

  const backToList = async () => {
    await discard();
    resetFields();
    setProvider(null);
    setService(null);
    setDevice(null);
    setStep(1);
  };

  const addAnother = async () => {
    setFinishing(true);
    try {
      if (!(await applyReadyChoices())) return;
    } finally {
      setFinishing(false);
    }
    resetFields();
    setProvider(null);
    setService(null);
    setDevice(null);
    setPicks([]);
    setMakeMain(null);
    setUseInChat(false);
    setQuery("");
    setStep(1);
  };

  // A retry with another key keeps an automatic name in step with that key (decision 28); a typed name wins.
  const autoName =
    target?.autoName && KEY_TAIL.test(target.autoName)
      ? withKeyTail(target.autoName.replace(KEY_TAIL, ""), apiKey)
      : "";
  const accountFields = () => ({
    ...(name.trim() || autoName ? { name: name.trim() || autoName } : {}),
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
        // The existing media editor stays inside this guided shell; a real backend with both capabilities
        // asks which Model/workflow to add before it opens.
        if (provider === "audio" || provider === "decision") {
          setSetupKind(null);
          setMediaEditorId(current.connectionId);
          setStep(3);
          return;
        }
        const mediaKinds = selectedMedia
          ? ([
              ...(selectedMedia.image ? (["image"] as const) : []),
              ...(selectedMedia.video ? (["video"] as const) : []),
            ] as AddableKind[])
          : ([provider === "video_generation" ? "video" : "image"] as AddableKind[]);
        setSetupKind(mediaKinds.length === 1 ? mediaKinds[0]! : null);
        setStep(3);
        return;
      }
      const result = await testConnection.mutateAsync(current.connectionId);
      setTested(result);
      // "Test and continue" is one press: a passing test opens the models.
      if (result.success) {
        const available: AddableKind[] = service
          ? kindsOf(service).filter((kind): kind is AddableKind => kind !== "local" && kind !== "voice")
          : ["chat"];
        setSetupKind(available.length === 1 ? available[0]! : null);
        setStep(3);
      }
    } catch (error) {
      setTested({ success: false, message: errorText(error) });
    }
  };

  const showModelsOf = async (accountId: string, connectionId?: string) => {
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
        toast.error(errorText(error));
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
      const inferredService = source ? (`media:${source}` as MediaServiceId) : (row.provider as APIProvider);
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
    if (row.provider === "audio" || row.provider === "decision") setMediaEditorId(row.id);
    const supportedKinds = resolvedService
      ? kindsOf(resolvedService).filter(
          (kind): kind is AddableKind => kind === "chat" || kind === "image" || kind === "video",
        )
      : [];
    setSetupKind(
      modelsFor?.kind ?? (modelsFor?.chat ? "chat" : supportedKinds.length === 1 ? supportedKinds[0]! : null),
    );
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
    if (provider && isChatProvider(provider)) {
      if (kind === "image") return Object.entries(IMAGE_SOURCE_VENDOR).find(([, vendor]) => vendor === provider)?.[0];
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
    const preserveAccountEndpoint = source === "comfyui" || source === "swarmui";
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
      setMediaEditorId(id);
    } catch (error) {
      toast.error(errorText(error));
      setSetupKind(null);
    } finally {
      mediaSetupStarted.current = "";
      setMediaCreating(false);
    }
  };

  useEffect(() => {
    if (step !== 3 || !target || mediaEditorId || (setupKind !== "image" && setupKind !== "video")) return;
    const key = `${target.accountId}:${setupKind}`;
    if (mediaSetupStarted.current === key) return;
    mediaSetupStarted.current = key;
    void beginMediaSetup(setupKind);
    // The target/kind transition is the trigger; the helper reads the latest loaded rows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, target?.accountId, setupKind, mediaEditorId]);

  const recordPick = (connectionId: string, modelId: string) =>
    setPicks((current) =>
      current.some((pick) => pick.modelId === modelId) ? current : [...current, { connectionId, modelId }],
    );

  // A star taken off here: the model is no longer added. The star hook removes the Model (decision 30).
  const unstar = (modelId: string) => setPicks((current) => current.filter((pick) => pick.modelId !== modelId));

  const startChatting = async () => {
    if (!onStartChat || !firstPick) return;
    setFinishing(true);
    try {
      if (!(await applyReadyChoices())) return;
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
    if (media)
      return ownAccounts.filter(
        (account) =>
          accountRows(account.id).some((row) => rowUsesMediaSource(row, media.source)) ||
          (["image_generation", "video_generation"].includes(account.provider) &&
            account.baseUrl.replace(/\/+$/u, "") === media.defaultBaseUrl.replace(/\/+$/u, "")),
      );
    if (isDevice(key)) return [];
    const providerKey = key as APIProvider;
    const imageSources = Object.entries(IMAGE_SOURCE_VENDOR)
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
    else if (firstRun && service === "openrouter")
      badges.push({ label: t("connections.add.badge.recommended"), highlight: true });
    if (isDevice(service)) badges.push({ label: t("connections.add.badge.builtIn") });
    const billing =
      isDevice(service) || mediaBackendOf(service) ? undefined : PROVIDERS[service as APIProvider]?.billing;
    if (billing) badges.push({ label: t(`connections.add.badge.${billing}`) });
    return badges.slice(0, 2);
  };
  const needle = query.trim().toLowerCase();
  const searching = needle.length > 0;
  const groups = SERVICE_GROUPS.map((group) => ({
    ...group,
    services: group.services.filter(
      (key) =>
        (!isDevice(key) || deviceSetup[DEVICE_ITEMS[key]].available) &&
        (!searching ||
          // The kinds are searchable too ("images", "voice"), so no separate filter row is needed.
          [serviceName(key), serviceHint(key), kindsLabel(key)].some((text) => text.toLowerCase().includes(needle))),
    ),
  })).filter((group) => group.services.length > 0);

  const serviceList = (
    <div className="flex flex-col gap-3 p-4">
      {firstRun && <FirstRunIntro text={t("connections.add.intro")} />}
      <div className="relative">
        <Search
          size="0.8125rem"
          className="mari-chrome-field-icon pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("connections.add.search")}
          aria-label={t("connections.add.search")}
          className="mari-chrome-field h-11 w-full py-0 pl-8 pr-3 text-xs md:h-9"
        />
      </div>
      {groups.map((group) => (
        <ServiceGroup
          key={group.id}
          title={t(`connections.add.group.${group.id}`)}
          count={group.services.length}
          collapsible={!!group.collapsed && !searching}
          open={searching || vendorsOpen}
          onToggle={() => setVendorsOpen((value) => !value)}
        >
          {group.services.map((key) => (
            <ServiceCard
              key={key}
              service={key}
              name={serviceName(key)}
              hint={serviceHint(key)}
              kinds={kindsLabel(key)}
              badges={badgesFor(key)}
              selected={service === key}
              onClick={() => void chooseService(key)}
            />
          ))}
        </ServiceGroup>
      ))}
      {groups.length === 0 && (
        <p className="py-4 text-center text-xs text-[var(--muted-foreground)]">{t("connections.add.noMatch")}</p>
      )}
    </div>
  );

  // ── Step 2: access for the chosen service ──
  const existing = connectedAccounts[0];
  // Already connected: the user picks one of those connections or makes a new one before any field shows.
  const choosing = connectedAccounts.length > 0 && !target && !second;
  const keyUrl = selectedMedia ? undefined : def?.keyUrl;
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
            {t("connections.add.getKey", { service: serviceName(service ?? provider!) })}
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
          {def?.billing && <p className="mt-0.5 text-[0.6875rem]">{t(`connections.add.billingInfo.${def.billing}`)}</p>}
        </div>
      </div>

      {choosing && (
        <div data-add-connection-existing className="flex flex-col gap-3">
          <ul className="flex flex-col gap-2">
            {connectedAccounts.map((account) => (
              <li key={account.id}>
                <button
                  type="button"
                  data-add-connection-existing-account={account.id}
                  onClick={() => void showModelsOf(account.id)}
                  disabled={closeBlocked}
                  className="mari-chrome-control mari-chrome-control--card flex min-h-14 w-full !flex-row !items-center gap-3 px-3 py-2 text-left text-xs disabled:opacity-50"
                >
                  {/* The same identity as the sidebar card header: name, then count, plan word and host. */}
                  <ConnectionIdentity
                    account={account}
                    rows={accountRows(account.id)}
                    count={t("connections.list.models", { count: accountRows(account.id).length })}
                    state={account.state}
                    stateLabel={t(`connections.accounts.state.${account.state}`)}
                    billing={account.billing}
                  />
                  <ChevronRight size="1rem" className="shrink-0 text-[var(--muted-foreground)]" aria-hidden />
                </button>
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
                placeholder={LOCAL_PRESETS[0]!.url}
                inputMode="url"
                spellCheck={false}
                autoCapitalize="off"
                aria-describedby={tested ? "add-connection-result" : undefined}
                className={cn(inputClass, "font-mono")}
              />
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
                  {((!isLocal && !keyless) || selectedMedia) && (
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
        <>
          <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
            {t("connections.add.localModelInfo")}
          </p>
          {/* The decision sidecar is its own model and its own process, so it does not wait for a chat model. */}
          <button
            type="button"
            onClick={() => setDecisionOpen(true)}
            className="mari-chrome-control mari-chrome-control--compact w-full text-center"
          >
            {t("ui.panels.sidecarcard.decisionSidecar")}
          </button>
          <DecisionModelModal open={decisionOpen} onClose={() => setDecisionOpen(false)} />
        </>
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
  const finishMediaSetup = async () => {
    if (!target || !mediaEditorId) return;
    const owned = new Set(target.ownedPlaceholderIds ?? []);
    if (owned.size > 0) {
      const unused = accountRows(target.accountId).filter((row) => {
        if (row.id === mediaEditorId || row.model?.trim()) return false;
        return owned.has(row.id);
      });
      for (const row of unused) {
        try {
          await deleteRow.mutateAsync(row.id);
        } catch {
          // The configured media Model is already saved; an unused placeholder can still be removed in the panel.
        }
      }
    }
    setMediaSaved(true);
    onClose();
  };
  const cancelMediaSetup = async () => {
    if (editorExit === "close") {
      await close();
      return;
    }
    setMediaCreating(true);
    const removed = new Set<string>();
    try {
      // The anchor still powers the chat catalog when the user returns to choose another capability.
      for (const id of target?.ownedPlaceholderIds ?? []) {
        if (id === target?.connectionId) continue;
        await deleteRow.mutateAsync(id);
        removed.add(id);
      }
    } catch {
      // Keep failed deletions owned, so closing the setup can retry their cleanup.
    } finally {
      setTarget((current) => {
        if (!current) return current;
        const ownedPlaceholderIds = (current.ownedPlaceholderIds ?? []).filter((id) => !removed.has(id));
        return {
          ...current,
          ownedPlaceholderIds,
          placeholderId:
            current.placeholderId && !removed.has(current.placeholderId)
              ? current.placeholderId
              : ownedPlaceholderIds[0],
        };
      });
      setMediaEditorId(null);
      setSetupKind(null);
      if (provider === "audio" || provider === "decision") setStep(2);
      setEditorBusy(false);
      setMediaCreating(false);
    }
  };
  const requestEditorBack = () => {
    if (closeBlocked) return;
    setEditorExit("back");
    setEditorCloseRequest((current) => current + 1);
  };

  const capabilityChooser = target && (
    <div className="mx-auto flex max-w-xl flex-col gap-3 p-4 md:p-5">
      <p className="text-xs text-[var(--muted-foreground)]">{t("connections.add.capabilityHelp")}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {availableKinds.map((kind) => (
          <button
            key={kind}
            type="button"
            data-add-connection-capability={kind}
            onClick={() => {
              if (!closeBlocked) setSetupKind(kind);
            }}
            disabled={closeBlocked}
            className="mari-chrome-control mari-chrome-control--card min-h-16 px-3 py-3 text-left disabled:opacity-50"
          >
            <span className="block text-sm font-semibold">{t(`connections.add.capability.${kind}`)}</span>
            <span className="mt-1 block text-[0.6875rem] text-[var(--muted-foreground)]">
              {t(`connections.add.capabilityHint.${kind}`)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  // ── Header: Back, the step's heading and "Step n of N" ──
  const heading =
    step === 1
      ? t("connections.add.heading.service")
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
          ? mediaEditorId
            ? t("connections.add.heading.mediaSetup", { name: targetName })
            : !setupKind
              ? t("connections.add.heading.chooseCapability")
              : t(modelsFor ? "connections.add.heading.addModels" : "connections.add.heading.star", {
                  name: targetName,
                })
          : t("connections.add.heading.ready", { name: targetName });
  const subtitle =
    step === 1
      ? newChatMode
        ? t("connections.add.sub.gate", { mode: t(`connections.add.mode.${newChatMode}`) })
        : t("connections.add.sub.service")
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
          ? mediaEditorId
            ? t("connections.add.sub.mediaEditor")
            : !setupKind
              ? t("connections.add.sub.capability")
              : t(modelsFor?.chat ? "connections.add.sub.modelsChat" : "connections.add.sub.models")
          : "";
  const stepNumber = step === "ready" ? 4 : step;
  // Devices and media services end after their set-up screen.
  const pureMediaPath = setupKind === "image" || setupKind === "video" || (!!mediaEditorId && setupKind !== "chat");
  const totalSteps = device ? 2 : isMedia || pureMediaPath ? 3 : 4;
  const goBack =
    step === 2
      ? backToList
      : step === 3 && !modelsFor && picks.length === 0
        ? mediaEditorId
          ? requestEditorBack
          : target?.fresh
            ? () => setStep(2)
            : backToList
        : step === "ready"
          ? () => setStep(3)
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
  } else if (step === 3 && mediaEditorId) {
    footerLeft = (
      <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{t("connections.add.incrementalSave")}</p>
    );
  } else if (step === 3 && setupKind === "chat") {
    footerLeft = picks.length > 0 && (
      <p role="status" className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
        <Check size="0.75rem" className="text-[var(--primary)]" aria-hidden />
        {t("connections.add.picked", { count: picks.length })}
      </p>
    );
    footerRight = (
      <button
        type="button"
        data-add-connection-done
        // Add model ends here: what has a star is added.
        onClick={() => (picks.length > 0 && !modelsFor ? setStep("ready") : void close())}
        // A new Connection needs one model; without it the window throws the Connection away.
        disabled={target?.fresh && picks.length === 0}
        className={PRIMARY_CLASS}
      >
        {t(picks.length > 0 && !modelsFor ? "connections.add.continue" : "connections.add.done")}
      </button>
    );
  } else if (step === "ready") {
    footerLeft = (
      <button type="button" onClick={() => void addAnother()} disabled={finishing} className={SECONDARY_CLASS}>
        {t("connections.add.addAnother")}
      </button>
    );
    footerRight = onStartChat ? (
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
      <button type="button" onClick={() => void close(true)} disabled={finishing} className={PRIMARY_CLASS}>
        {finishing && <Loader2 size="0.75rem" className="animate-spin" aria-hidden />}
        {t("connections.add.done")}
      </button>
    );
  }

  const firstName = firstPick ? modelName(firstPick.modelId) : "";
  const checkClass = "h-[1.125rem] w-[1.125rem] shrink-0 accent-[var(--primary)]";
  const optionClass =
    "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm hover:bg-[var(--marinara-chat-chrome-highlight-bg-hover)]";

  return (
    <Modal
      open={open}
      onClose={requestClose}
      title={t(modelsFor ? "connections.accounts.addModel" : "connections.add.title")}
      width="max-w-3xl lg:max-w-4xl"
      mobileFullscreen
      opaque
      closeDisabled={closeBlocked}
      panelClassName="mari-connection-scope sm:h-[min(90dvh,44rem)]"
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

          {step === 3 && target && !setupKind && !mediaEditorId && capabilityChooser}

          {step === 3 && target && mediaEditorId && (
            <div data-add-connection-media-editor className="flex min-h-0 flex-1 flex-col">
              <ConnectionEditor
                key={mediaEditorId}
                connectionId={mediaEditorId}
                embedded
                onDone={() => void finishMediaSetup()}
                onSaved={() => {
                  setMediaSaved(true);
                  setTarget((current) =>
                    current
                      ? {
                          ...current,
                          ownedPlaceholderIds: (current.ownedPlaceholderIds ?? []).filter((id) => id !== mediaEditorId),
                          placeholderId: current.placeholderId === mediaEditorId ? undefined : current.placeholderId,
                        }
                      : current,
                  );
                }}
                onCancel={() => void cancelMediaSetup()}
                onBusyChange={setEditorBusy}
                closeRequestToken={editorCloseRequest}
              />
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
              addedIds={addedIds}
              addMode
              onUnstar={unstar}
              footer={null}
              autoFocusSearch
            />
          )}

          {step === "ready" && (
            <section className="h-full min-h-0 overflow-y-auto overscroll-contain">
              <div className="mx-auto flex max-w-xl flex-col gap-3 p-4 md:p-5">
                <div className="flex items-center gap-3 rounded-xl border border-[var(--marinara-chat-chrome-panel-divider)] p-3">
                  {provider && <ServiceTile service={service ?? provider} />}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{targetName}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {t("connections.add.picked", { count: picks.length })}
                    </p>
                  </div>
                </div>
                <ul className="flex flex-col" aria-label={t("connections.add.readyModels")}>
                  {picks.map((pick) => (
                    <li key={pick.modelId} className="flex min-h-11 items-center gap-3 px-2 text-sm">
                      <ProviderIcon provider={provider ?? "custom"} model={pick.modelId} size="sm" />
                      <span className="min-w-0 truncate">{modelName(pick.modelId)}</span>
                    </li>
                  ))}
                </ul>
                {firstPick && (
                  <div
                    className="flex flex-col border-t border-[var(--marinara-chat-chrome-panel-divider)] pt-2"
                    role="group"
                    aria-label={t("connections.add.readyChoices")}
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
                    ) : (
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
                          <span className="text-xs text-[var(--muted-foreground)]">
                            {" "}
                            · {t("connections.add.makeMainHint")}
                          </span>
                        </span>
                      </label>
                    )}
                  </div>
                )}
                {onStartChat && newChatMode && (
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {t("connections.add.readyGate", { mode: t(`connections.add.mode.${newChatMode}`) })}
                  </p>
                )}
              </div>
            </section>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--marinara-chat-chrome-panel-divider)] px-5 py-3 max-md:px-4">
          <div className="flex min-w-0 items-center gap-2">{footerLeft}</div>
          {footerRight}
        </div>
      </div>
    </Modal>
  );
}

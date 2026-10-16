// ────────────────────────────────────────────────
// Modal: Add connection (service → key/URL with test → pick models → ready)
// From 768 px the service list and the chosen service sit side by side (the Download Agents
// layout); smaller screens get the same parts as three screens in a full-screen sheet.
// ────────────────────────────────────────────────
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronLeft,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Plug,
  Search,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  MODEL_LISTS,
  PROVIDERS,
  isChatProvider,
  isLocalAuthProvider,
  withKeyTail,
  type APIProvider,
} from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";
import { SmoothFolderContent } from "../ui/SmoothFolderContent";
import { ConnectionModelPicker } from "../connections/ConnectionModelPicker";
import { BrandMark, ProviderIcon } from "../connections/ProviderIcon";
import {
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
import { useUIStore } from "../../stores/ui.store";
import { useSidecarStore } from "../../stores/sidecar.store";
import { useDeviceSetup, type DeviceItem } from "../../hooks/use-device-setup";
import type { ModelsFor } from "../../lib/add-connection";
import { TTSConfigCard } from "../panels/settings/TTSConfigCard";
import { SpeechToTextCard } from "../panels/settings/SpeechToTextCard";
import { LocalWhisper } from "../connections/DeviceDetail";
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
export type ServiceId = APIProvider | DeviceService;
const DEVICE_ITEMS: Record<DeviceService, DeviceItem> = { local_model: "local-model", tts: "tts", stt: "stt" };
const isDevice = (service: ServiceId | null): service is DeviceService => !!service && service in DEVICE_ITEMS;
type Kind = "all" | "chat" | "image" | "video" | "voice" | "local";

const KINDS: Kind[] = ["all", "chat", "image", "video", "voice", "local"];
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
const kindsOf = (service: ServiceId) => SERVICE_KINDS[service] ?? ["chat"];

/** Open groups are the paths most people take; the long vendor list folds behind a chevron. */
const SERVICE_GROUPS: Array<{ id: string; services: ServiceId[]; collapsed?: boolean }> = [
  { id: "start", services: ["openrouter", "nanogpt"] },
  { id: "plan", services: ["openai_chatgpt", "claude_subscription", "grok_subscription"] },
  { id: "device", services: ["local_model", "tts", "stt"] },
  { id: "local", services: ["custom"] },
  {
    id: "vendors",
    collapsed: true,
    services: ["openai", "anthropic", "google", "google_vertex", "mistral", "cohere", "xai", "zai", "deepseek", "arli"],
  },
  { id: "media", services: ["image_generation", "video_generation", "audio", "decision"] },
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
type Target = { accountId: string; connectionId: string; fresh: boolean; autoName?: string };
/** The key's end the server adds to an automatic name next to another Connection of the same service. */
const KEY_TAIL = / · …\S{4}$/u;
type ConnectionRowLite = {
  id: string;
  name?: string;
  provider?: string;
  accountId?: string | null;
  model?: string;
  createdAt?: string | null;
  pinnedModels?: unknown;
};
type TestResult = { success: boolean; message?: string };

const inputClass = "mari-chrome-field h-11 w-full px-3 text-xs md:h-9";
const labelClass = "text-xs font-medium text-[var(--muted-foreground)]";
const PRIMARY_CLASS =
  "mari-panel-gradient-button mari-panel-gradient--connections px-4 text-xs max-md:min-h-11 disabled:opacity-50";
const SECONDARY_CLASS = "mari-chrome-control mari-chrome-control--small px-3 text-xs max-md:min-h-11";
const BADGE_CLASS = "mari-chrome-muted-badge px-1.5 py-0.5 text-[0.5625rem]";
const HIGHLIGHT_BADGE_CLASS =
  "mari-chrome-tag bg-[var(--marinara-chat-chrome-highlight-bg)] px-1.5 py-0.5 text-[0.5625rem] font-semibold text-[var(--marinara-chat-chrome-highlight-text)]";

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

/** The service tile: its bundled brand icon in colour on a neutral tile (decision 34c), else an icon or the initials. */
function ServiceTile({ service, large = false }: { service: ServiceId; large?: boolean }) {
  return <ProviderIcon provider={service} size={large ? "addLarge" : "add"} color />;
}

/** Choice card (Agent editor / Download Agents rows): tile, name with up to two badges, a 2-line hint. */
function ServiceCard({
  service,
  name,
  hint,
  badges,
  selected,
  onClick,
}: {
  service: ServiceId;
  name: string;
  hint: string;
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
      aria-description={[hint, ...badges.map((badge) => badge.label)].join(". ")}
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
  const list = <div className="flex flex-col gap-2">{children}</div>;
  if (!collapsible) {
    return (
      <section className="flex flex-col gap-1.5">
        <h4 className="px-1 text-[0.6875rem] font-medium text-[var(--muted-foreground)]">{title}</h4>
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
  const openConnectionDetail = useUIStore((s) => s.openConnectionDetail);
  const deviceSetup = useDeviceSetup();

  const startDevice = isDevice(initialService ?? null) ? (initialService as DeviceService) : null;
  const [provider, setProvider] = useState<APIProvider | null>(
    initialService && !startDevice ? (initialService as APIProvider) : null,
  );
  const [device, setDevice] = useState<DeviceService | null>(startDevice);
  const [step, setStep] = useState<1 | 2 | 3 | "ready">(modelsFor ? 3 : initialService ? 2 : 1);
  const [target, setTarget] = useState<Target | null>(null);
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [maxRpm, setMaxRpm] = useState("");
  const [maxJobs, setMaxJobs] = useState("");
  const [tested, setTested] = useState<TestResult | null>(null);
  const [addedIds, setAddedIds] = useState<string[]>([]);
  const [main, setMain] = useState<{ connectionId: string; modelId: string } | null>(null);
  const [firstPickId, setFirstPickId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [vendorsOpen, setVendorsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  // Set once from the first loaded list: a setup with no chat Model yet is a first run.
  const [firstRun, setFirstRun] = useState<boolean | null>(null);
  const defaultsSet = useRef(false);
  // Models that existed when the window opened; a Model made here and unstarred again is removed (decision 30).
  const knownRowIds = useRef<Set<string> | null>(null);
  const madeHere = useRef(new Map<string, string>());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);

  const allRows = (rows ?? []) as ConnectionRowLite[];
  useEffect(() => {
    if (firstRun !== null || !rows) return;
    knownRowIds.current = new Set((rows as ConnectionRowLite[]).map((row) => row.id));
    setFirstRun(!modelsFor && !(rows as ConnectionRowLite[]).some((row) => isChatProvider(row.provider ?? "")));
  }, [firstRun, modelsFor, rows]);

  const def = provider ? PROVIDERS[provider] : null;
  const keyless = !!provider && isLocalAuthProvider(provider);
  const isLocal = provider === "custom";
  const isMedia = !!provider && !isChatProvider(provider);
  const busy = createAccount.isPending || updateAccount.isPending || testConnection.isPending;
  const modelList = useConnectionModels(target?.connectionId, !!tested?.success && !isMedia);
  const modelCount = modelList.data?.models?.length;

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

  const serviceName = (key: ServiceId) =>
    isDevice(key)
      ? t(`connections.add.device.${key}`)
      : key === "decision"
        ? t("connections.decision.label")
        : (PROVIDERS[key]?.name ?? key);

  // Throw away the empty Model of a Connection that was created but never got a Model picked.
  const discard = async () => {
    if (!target?.fresh || addedIds.length > 0) return;
    try {
      await deleteRow.mutateAsync(target.connectionId);
      await deleteAccount.mutateAsync(target.accountId);
    } catch {
      /* the Connection stays; the user can delete it in the panel */
    }
  };

  const close = async () => {
    await discard();
    onClose();
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
  };

  const chooseService = async (key: ServiceId) => {
    if ((key === provider || key === device) && step === 2) return;
    await discard();
    resetFields();
    setProvider(isDevice(key) ? null : key);
    setDevice(isDevice(key) ? key : null);
    setStep(2);
  };

  const backToList = async () => {
    await discard();
    resetFields();
    setProvider(null);
    setDevice(null);
    setStep(1);
  };

  const addAnother = () => {
    resetFields();
    setProvider(null);
    setDevice(null);
    setAddedIds([]);
    setFirstPickId(null);
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
    baseUrl: baseUrl.trim() || (keyless ? "" : (def?.defaultBaseUrl ?? "")),
    maxRequestsPerMinute: maxRpm ? Math.min(600, Math.max(1, Math.trunc(Number(maxRpm)))) : null,
    maxParallelJobs: maxJobs ? Math.min(16, Math.max(1, Math.trunc(Number(maxJobs)))) : null,
  });

  /** Creates the Connection with its empty first Model (or updates it on a retry), then tests it. */
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
          ...(name.trim() ? {} : { autoName: created.account.name }),
        };
        setTarget(current);
      }
      if (isMedia) {
        // Image/video/audio/decision Models are tuned in the editor, not picked from a list.
        onClose();
        openConnectionDetail(current.connectionId);
        return;
      }
      setTested(await testConnection.mutateAsync(current.connectionId));
    } catch (error) {
      setTested({ success: false, message: error instanceof Error ? error.message : String(error) });
    }
  };

  const showModelsOf = (accountId: string, connectionId?: string) => {
    // A key shared by chat and image Models (decision 20): the models list belongs to a chat Model.
    const linked = allRows.filter((candidate) => candidate.accountId === accountId);
    const row = linked.find((candidate) => candidate.id === connectionId) ?? starAnchorOf(linked) ?? linked[0];
    if (!row) return;
    resetFields();
    setProvider((row.provider as APIProvider) ?? null);
    setTarget({ accountId, connectionId: row.id, fresh: false });
    setStep(3);
  };

  // Add model: open on the Connection's models once its rows are loaded.
  useEffect(() => {
    if (modelsFor && !target && rows) showModelsOf(modelsFor.accountId, modelsFor.connectionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the rows arrive
  }, [modelsFor, rows]);

  // The first Model of a setup becomes Main and Agents default when none exists.
  const recordPick = (connectionId: string, modelId: string) => {
    if (connectionId !== target?.connectionId && !knownRowIds.current?.has(connectionId))
      madeHere.current.set(modelId, connectionId);
    // Add model is not a setup; only a setup hands out the Main and Agents defaults.
    if (!defaultsSet.current && !modelsFor) {
      const chat = allRows.filter((row) => isChatProvider(row.provider ?? ""));
      const patch: Record<string, boolean> = {};
      if (!chat.some((row) => isConnectionFlagTrue((row as Record<string, unknown>).isDefault))) patch.isDefault = true;
      if (!chat.some((row) => isConnectionFlagTrue((row as Record<string, unknown>).defaultForAgents)))
        patch.defaultForAgents = true;
      if (Object.keys(patch).length) updateRow.mutate({ id: connectionId, ...patch });
      if (patch.isDefault) setMain({ connectionId, modelId });
      defaultsSet.current = true;
    }
    setFirstPickId((current) => current ?? connectionId);
    setAddedIds((current) => (current.includes(modelId) ? current : [...current, modelId]));
  };

  // A star taken off here: the model is no longer added. The star hook removes the Model (decision 30).
  const unstar = (modelId: string) => {
    setAddedIds((current) => current.filter((id) => id !== modelId));
    const made = madeHere.current.get(modelId);
    madeHere.current.delete(modelId);
    // Start chatting must not open a Model that goes with the star.
    setFirstPickId((current) =>
      current && (current === made || allRows.find((row) => row.id === current)?.model === modelId) ? null : current,
    );
  };

  const startChatting = async () => {
    const connectionId = main?.connectionId ?? firstPickId;
    if (!onStartChat || !connectionId) return;
    setStarting(true);
    try {
      await onStartChat(connectionId);
    } catch {
      // useCreateChat already shows the error toast; the window stays open so the user can try again.
    } finally {
      setStarting(false);
    }
  };

  // ── Step 1: the service list ──
  // A Connection without a Model yet has nothing to add models to; it does not count.
  const ownAccounts = (accounts ?? []).filter((account) => account.id !== target?.accountId && account.modelCount > 0);
  const connectedAccount = (service: ServiceId) => ownAccounts.find((account) => account.provider === service);
  const badgesFor = (service: ServiceId) => {
    const badges: Array<{ label: string; highlight?: boolean }> = [];
    if (isDevice(service) && deviceSetup[DEVICE_ITEMS[service]].setUp)
      badges.push({ label: t("connections.add.badge.setUp"), highlight: true });
    else if (connectedAccount(service)) badges.push({ label: t("connections.add.badge.connected"), highlight: true });
    else if (firstRun && service === "openrouter")
      badges.push({ label: t("connections.add.badge.recommended"), highlight: true });
    if (isDevice(service)) badges.push({ label: t("connections.add.badge.builtIn") });
    const billing = isDevice(service) ? undefined : PROVIDERS[service]?.billing;
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
        (kind === "all" || kindsOf(key).includes(kind)) &&
        (!searching ||
          [serviceName(key), t(`connections.add.hint.${key}`)].some((text) => text.toLowerCase().includes(needle))),
    ),
  })).filter((group) => group.services.length > 0);

  const serviceList = (
    <div className="flex flex-col gap-3 p-4">
      {firstRun && <FirstRunIntro text={t("connections.add.intro")} className="md:hidden" />}
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
      <div
        className="grid grid-cols-6 gap-1 md:grid-cols-3 lg:grid-cols-6"
        role="group"
        aria-label={t("connections.add.kindFilter")}
      >
        {KINDS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setKind(value)}
            aria-pressed={kind === value}
            className={cn(
              "mari-chrome-control h-8 min-h-8 min-w-0 px-1 text-[0.625rem] max-md:h-11 max-md:min-h-11",
              kind === value && "mari-chrome-control--selected",
            )}
          >
            <span className="whitespace-nowrap">{t(`connections.add.kind.${value}`)}</span>
          </button>
        ))}
      </div>
      {groups.map((group) => (
        <ServiceGroup
          key={group.id}
          title={t(`connections.add.group.${group.id}`)}
          count={group.services.length}
          collapsible={!!group.collapsed && !searching && kind === "all"}
          open={searching || kind !== "all" || vendorsOpen}
          onToggle={() => setVendorsOpen((value) => !value)}
        >
          {group.services.map((key) => (
            <ServiceCard
              key={key}
              service={key}
              name={serviceName(key)}
              hint={t(`connections.add.hint.${key}`)}
              badges={badgesFor(key)}
              selected={(provider === key || device === key) && step === 2}
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

  // ── Step 2: connect the chosen service ──
  const existing = provider ? connectedAccount(provider) : undefined;
  const keyUrl = def?.keyUrl;
  const failure = tested && !tested.success && provider ? failureReason(provider, tested.message ?? "") : null;
  const connectDisabled = busy || (isLocal && !baseUrl.trim()) || (!keyless && !isLocal && !isMedia && !apiKey.trim());
  const resetTest = () => setTested(null);

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
          aria-describedby={tested ? "add-connection-result" : undefined}
          className={cn(inputClass, "min-w-0 flex-1 font-mono")}
        />
        <button
          type="button"
          onClick={() => setShowKey((value) => !value)}
          aria-pressed={showKey}
          aria-label={t("connections.add.showKey")}
          title={t("connections.add.showKey")}
          className="mari-chrome-control h-11 w-11 shrink-0 p-0 md:h-9 md:w-9"
        >
          {showKey ? <EyeOff size="0.875rem" aria-hidden /> : <Eye size="0.875rem" aria-hidden />}
        </button>
      </div>
      {keyUrl && !optional && (
        <p className="flex flex-wrap items-center gap-x-1.5 text-[0.6875rem]">
          <a
            href={keyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1 font-medium text-[var(--foreground)] underline decoration-[var(--muted-foreground)] underline-offset-2 hover:decoration-[var(--foreground)] md:min-h-0"
          >
            {t("connections.add.getKey", { service: serviceName(provider!) })}
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
                host: hostOf(baseUrl.trim() || def?.defaultBaseUrl || "") || serviceName(provider!),
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
      <div className="flex items-start gap-3">
        <ServiceTile service={provider} large />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold">{serviceName(provider)}</p>
          <p className="text-xs leading-snug text-[var(--muted-foreground)]">{t(`connections.add.hint.${provider}`)}</p>
          {def?.billing && (
            <p className="mt-1 text-[0.6875rem] text-[var(--muted-foreground)]">
              {t(`connections.add.billingInfo.${def.billing}`)}
            </p>
          )}
        </div>
      </div>

      {existing && !target && !isMedia && (
        <div
          data-add-connection-existing
          className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--marinara-chat-chrome-highlight-bg)] p-3 text-xs"
        >
          <p>
            {t("connections.add.alreadyHave", { name: existing.name })}{" "}
            {!keyless && t(isLocal ? "connections.add.secondServer" : "connections.add.secondKey")}
          </p>
          <button type="button" onClick={() => showModelsOf(existing.id)} className={cn(SECONDARY_CLASS, "self-start")}>
            {t("connections.add.addModelsTo")}
          </button>
        </div>
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
                className={cn(
                  "mari-chrome-control h-8 min-h-8 px-2.5 text-[0.625rem] max-md:h-11 max-md:min-h-11",
                  baseUrl.trim() === preset.url && "mari-chrome-control--selected",
                )}
              >
                <BrandMark of={preset.label} className="h-3 w-3" />
                {preset.label}
              </button>
            ))}
          </div>
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{t("connections.add.noKeyNeeded")}</p>
        </div>
      )}
      {!keyless && !isLocal && !isMedia && keyField(false)}
      {keyless && <p className="text-xs text-[var(--muted-foreground)]">{t("connections.add.keyless")}</p>}
      {isMedia && <p className="text-xs text-[var(--muted-foreground)]">{t("connections.add.mediaNext")}</p>}

      {!isMedia && (
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
              {!isLocal && !keyless && (
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-[var(--muted-foreground)]">{t("connections.add.endpoint")}</span>
                  <input
                    value={baseUrl}
                    onChange={(e) => {
                      setBaseUrl(e.target.value);
                      resetTest();
                    }}
                    placeholder={def?.defaultBaseUrl}
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
                  <span className="text-xs text-[var(--muted-foreground)]">{t("connections.add.maxParallelJobs")}</span>
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
      {resultCard}
    </div>
  );

  // ── Step 2 for "On this device": each part keeps its own set-up controls ──
  const deviceState = device ? deviceSetup[DEVICE_ITEMS[device]] : null;
  const devicePane = device && (
    <div className="flex flex-col gap-4 p-4 md:p-5">
      <div className={cn("flex items-start gap-3", device !== "local_model" && "hidden")}>
        <ServiceTile service={device} large />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold">{serviceName(device)}</p>
          <p className="text-xs leading-snug text-[var(--muted-foreground)]">{t(`connections.add.hint.${device}`)}</p>
          <p data-add-connection-device-state className="mt-1 text-[0.6875rem] text-[var(--muted-foreground)]">
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

  // ── Step 3: pick models ──
  const shownRow = target ? allRows.find((row) => row.id === target.connectionId) : undefined;
  // A pick runs on the shown Model; the stars come from the Connection's anchor Model.
  const starAnchor = target ? starAnchorOf(allRows.filter((row) => row.accountId === target.accountId)) : undefined;
  const pickerRow = shownRow && { ...shownRow, pinnedModels: (starAnchor ?? shownRow).pinnedModels };
  const chat = modelsFor?.chat;
  const inPlace = !!target?.fresh && addedIds.length === 0;
  const recommended = provider && !NO_RECOMMENDED.has(provider) ? (MODEL_LISTS[provider] ?? []).slice(0, 3) : [];
  const targetName =
    (target && accounts?.find((account) => account.id === target.accountId)?.name) || serviceName(provider ?? "custom");
  const mainName =
    main &&
    (modelList.data?.models?.find((model) => model.id === main.modelId)?.name ||
      (provider && MODEL_LISTS[provider]?.find((model) => model.id === main.modelId)?.name) ||
      main.modelId);

  // ── Header copy ──
  const heading =
    step === 1
      ? t("connections.add.heading.service")
      : step === 2
        ? device
          ? t("connections.add.heading.device", { service: serviceName(device) })
          : t("connections.add.heading.connect", { service: serviceName(provider!) })
        : step === 3
          ? t(modelsFor ? "connections.add.heading.addModels" : "connections.add.heading.models", { name: targetName })
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
              modelsFor?.chat
                ? "connections.add.sub.modelsChat"
                : firstRun
                  ? "connections.add.sub.modelsFirstRun"
                  : "connections.add.sub.models",
            )
          : "";
  const stepNumber = step === "ready" ? 4 : step;
  const progressSteps = [
    { n: 1, label: t("connections.add.progress.service"), go: stepNumber > 1 && step !== "ready" ? backToList : null },
    {
      n: 2,
      label: t(device ? "connections.add.progress.setUp" : "connections.add.progress.connect"),
      go: step === 3 && target?.fresh && addedIds.length === 0 ? () => setStep(2) : null,
    },
    { n: 3, label: t("connections.add.progress.models"), go: null },
  ].filter((item) => !device || item.n < 3);

  // ── Footer: one primary per step ──
  const backButton = (onClick: () => void, className?: string) => (
    <button type="button" onClick={onClick} className={cn(SECONDARY_CLASS, className)}>
      <ChevronLeft size="0.75rem" aria-hidden />
      {t("connections.add.back")}
    </button>
  );
  const cancelButton = (className?: string) => (
    <button type="button" onClick={() => void close()} className={cn(SECONDARY_CLASS, className)}>
      {t("chat.delete.dialog.cancel")}
    </button>
  );

  let footerLeft: ReactNode = null;
  let footerRight: ReactNode = null;
  if (step === 1) {
    footerLeft = cancelButton();
  } else if (step === 2) {
    // Side by side the list stays in view, so Cancel; on one screen Back returns to it.
    footerLeft = (
      <>
        {backButton(() => void backToList(), "md:hidden!")}
        {cancelButton("max-md:hidden!")}
      </>
    );
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
    ) : tested?.success ? (
      <button type="button" onClick={() => setStep(3)} className={PRIMARY_CLASS}>
        {t("connections.add.chooseModels")}
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
          {t(isMedia ? "connections.add.continue" : failure ? "connections.add.tryAgain" : "connections.add.connect")}
        </button>
      </div>
    );
  } else if (step === 3) {
    footerLeft =
      addedIds.length > 0 ? (
        <p role="status" className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
          <Check size="0.75rem" className="text-emerald-500" aria-hidden />
          {t("connections.add.picked", { count: addedIds.length })}
        </p>
      ) : modelsFor ? null : target?.fresh ? (
        backButton(() => setStep(2))
      ) : (
        backButton(() => void backToList())
      );
    footerRight = (
      <button
        type="button"
        data-add-connection-done
        // Add model ends here: what has a star is added.
        onClick={() => (addedIds.length > 0 && !modelsFor ? setStep("ready") : onClose())}
        disabled={target?.fresh && addedIds.length === 0}
        className={PRIMARY_CLASS}
      >
        {t("connections.add.done")}
      </button>
    );
  } else {
    footerLeft = (
      <button type="button" onClick={addAnother} className={SECONDARY_CLASS}>
        {t("connections.add.addAnother")}
      </button>
    );
    footerRight = onStartChat ? (
      <button
        type="button"
        onClick={() => void startChatting()}
        disabled={starting}
        className={PRIMARY_CLASS}
        data-add-connection-start
      >
        {starting && <Loader2 size="0.75rem" className="animate-spin" aria-hidden />}
        {t("connections.add.startChatting")}
      </button>
    ) : (
      <button type="button" onClick={onClose} className={PRIMARY_CLASS}>
        {t("connections.add.done")}
      </button>
    );
  }

  return (
    <Modal
      open={open}
      onClose={() => void close()}
      title={t(modelsFor ? "connections.accounts.addModel" : "connections.add.title")}
      width="max-w-3xl lg:max-w-4xl"
      mobileFullscreen
      panelClassName="sm:h-[min(90dvh,44rem)]"
      contentClassName="flex flex-col overflow-hidden! p-0!"
    >
      <div data-add-connection-step={step} className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-[var(--marinara-chat-chrome-panel-divider)] px-5 py-3">
          <ol
            className={cn(
              "flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem] text-[var(--muted-foreground)]",
              modelsFor && "hidden",
            )}
          >
            {progressSteps.map((item, index) => {
              const done = stepNumber > item.n;
              const current = stepNumber === item.n;
              const content = (
                <>
                  {done ? (
                    <Check size="0.6875rem" className="text-emerald-500" aria-hidden />
                  ) : (
                    <span aria-hidden className="tabular-nums">
                      {item.n}
                    </span>
                  )}
                  {item.label}
                </>
              );
              return (
                <li
                  key={item.n}
                  aria-current={current ? "step" : undefined}
                  className={cn("flex items-center gap-2", current && "font-medium text-[var(--foreground)]")}
                >
                  {index > 0 && <span aria-hidden className="h-px w-4 bg-[var(--border)]" />}
                  {item.go ? (
                    <button
                      type="button"
                      onClick={() => void item.go!()}
                      className="flex min-h-11 items-center gap-1 rounded-md hover:text-[var(--foreground)] md:min-h-0"
                    >
                      {content}
                    </button>
                  ) : (
                    <span className="flex items-center gap-1">{content}</span>
                  )}
                </li>
              );
            })}
          </ol>
          <h3 ref={headingRef} tabIndex={-1} className={cn("text-sm font-semibold outline-none", !modelsFor && "mt-2")}>
            {heading}
          </h3>
          {subtitle && <p className="mt-0.5 text-[0.6875rem] text-[var(--muted-foreground)]">{subtitle}</p>}
        </div>

        <div key={String(step === 2 ? 1 : step)} className="animate-fade-in-up min-h-0 flex-1">
          {(step === 1 || step === 2) && (
            <div className="grid h-full min-h-0 md:grid-cols-[17rem_minmax(0,1fr)] lg:grid-cols-[20rem_minmax(0,1fr)]">
              <aside
                className={cn(
                  "min-h-0 overflow-y-auto overscroll-contain border-[var(--marinara-chat-chrome-panel-divider)] md:border-r",
                  step === 2 && "max-md:hidden",
                )}
              >
                {serviceList}
              </aside>
              <section className={cn("min-h-0 overflow-y-auto overscroll-contain", step === 1 && "max-md:hidden")}>
                {step === 2 ? (
                  (devicePane ?? connectPane)
                ) : firstRun ? (
                  <div className="p-5">
                    <FirstRunIntro text={t("connections.add.intro")} />
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-xs text-[var(--muted-foreground)]">
                    <span className="mari-panel-gradient-surface mari-panel-gradient--connections flex h-12 w-12 items-center justify-center rounded-xl opacity-70 shadow-sm">
                      <Plug size="1.25rem" aria-hidden />
                    </span>
                    <p>{t("connections.add.choosePrompt")}</p>
                  </div>
                )}
              </section>
            </div>
          )}

          {step === 3 && target && pickerRow && (
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
              mainModelId={main?.modelId}
              addMode
              onUnstar={unstar}
              footer={null}
              autoFocusSearch
            />
          )}

          {step === "ready" && (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
                <Check size="1.5rem" aria-hidden />
              </span>
              <p className="text-sm text-[var(--foreground)]">
                {mainName
                  ? t("connections.add.readyWithMain", { count: addedIds.length, model: mainName })
                  : t("connections.add.picked", { count: addedIds.length })}
              </p>
              {onStartChat && newChatMode && (
                <p className="text-xs text-[var(--muted-foreground)]">
                  {t("connections.add.readyGate", { mode: t(`connections.add.mode.${newChatMode}`) })}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--marinara-chat-chrome-panel-divider)] px-5 py-3">
          <div className="flex min-w-0 items-center gap-2">{footerLeft}</div>
          {footerRight}
        </div>
      </div>
    </Modal>
  );
}

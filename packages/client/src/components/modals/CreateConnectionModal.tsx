// ────────────────────────────────────────────────
// Modal: Add connection (service → access with an inline test → star models → ready)
// One screen per step with Back, "Step n of 4" and one primary in the footer; phones get a
// full-screen sheet. Main and "use in this chat" are explicit choices on the last screen.
// ────────────────────────────────────────────────
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, Check, ChevronDown, ChevronLeft, ExternalLink, Eye, EyeOff, Loader2, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
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
import { useSetChatModel } from "../../hooks/use-chats";
import { useUIStore } from "../../stores/ui.store";
import { useChatStore } from "../../stores/chat.store";
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
type Kind = "chat" | "image" | "video" | "voice" | "local";

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
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

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

/** The service tile: its white brand mark on the brand colour (decision 34c), else an icon or the initials. */
function ServiceTile({ service, large = false }: { service: ServiceId; large?: boolean }) {
  return <ProviderIcon provider={service} size={large ? "addLarge" : "add"} />;
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
  const setChatModel = useSetChatModel();
  const openConnectionDetail = useUIStore((s) => s.openConnectionDetail);
  const activeChatId = useChatStore((s) => s.activeChatId);
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
  // The models starred in this setup, in order; the first one is what the ready screen offers.
  const [picks, setPicks] = useState<Array<{ connectionId: string; modelId: string }>>([]);
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

  const def = provider ? PROVIDERS[provider] : null;
  const keyless = !!provider && isLocalAuthProvider(provider);
  const isLocal = provider === "custom";
  const isMedia = !!provider && !isChatProvider(provider);
  const busy = createAccount.isPending || updateAccount.isPending || testConnection.isPending;
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

  const serviceName = (key: ServiceId) =>
    isDevice(key)
      ? t(`connections.add.device.${key}`)
      : key === "decision"
        ? t("connections.decision.label")
        : (PROVIDERS[key]?.name ?? key);
  const kindsLabel = (key: ServiceId) =>
    kindsOf(key)
      .map((value) => t(`connections.add.kind.${value}`))
      .join(" · ");

  // Throw away the empty Model of a Connection that was created but never got a Model picked.
  const discard = async () => {
    if (!target?.fresh || picks.length > 0) return;
    try {
      for (const row of allRows.filter((row) => row.accountId === target.accountId)) {
        await deleteRow.mutateAsync(row.id);
      }
      await deleteAccount.mutateAsync(target.accountId);
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

  const close = async (saveChoices = false) => {
    setFinishing(true);
    try {
      if (saveChoices && step === "ready" && !(await applyReadyChoices())) return;
      await discard();
    } finally {
      setFinishing(false);
    }
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
    setSecond(false);
  };

  const chooseService = async (key: ServiceId) => {
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

  const addAnother = async () => {
    setFinishing(true);
    try {
      if (!(await applyReadyChoices())) return;
    } finally {
      setFinishing(false);
    }
    resetFields();
    setProvider(null);
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
    baseUrl: baseUrl.trim() || (keyless ? "" : (def?.defaultBaseUrl ?? "")),
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
      const result = await testConnection.mutateAsync(current.connectionId);
      setTested(result);
      // "Test and continue" is one press: a passing test opens the models.
      if (result.success) setStep(3);
    } catch (error) {
      setTested({ success: false, message: errorText(error) });
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
        (!searching ||
          // The kinds are searchable too ("images", "voice"), so no separate filter row is needed.
          [serviceName(key), t(`connections.add.hint.${key}`), kindsLabel(key)].some((text) =>
            text.toLowerCase().includes(needle),
          )),
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
              hint={t(`connections.add.hint.${key}`)}
              kinds={kindsLabel(key)}
              badges={badgesFor(key)}
              selected={provider === key || device === key}
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
  const existing = provider ? connectedAccount(provider) : undefined;
  // Already connected: the user picks "Add models to it" or a second account before any field shows.
  const choosing = !!existing && !target && !isMedia && !second;
  const keyUrl = def?.keyUrl;
  const failure = tested && !tested.success && provider ? failureReason(provider, tested.message ?? "") : null;
  const connectDisabled =
    busy || choosing || (isLocal && !baseUrl.trim()) || (!keyless && !isLocal && !isMedia && !apiKey.trim());
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
          className="mari-chrome-control h-11 w-11 shrink-0 p-0 md:h-9 md:w-9"
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
      {/* The heading names the service; this row only says what it is and what it costs. */}
      <div className="flex items-center gap-3">
        <ServiceTile service={provider} />
        <div className="min-w-0 flex-1 text-xs leading-snug text-[var(--muted-foreground)]">
          <p>{t(`connections.add.hint.${provider}`)}</p>
          {def?.billing && <p className="mt-0.5 text-[0.6875rem]">{t(`connections.add.billingInfo.${def.billing}`)}</p>}
        </div>
      </div>

      {existing && !target && !isMedia && (
        <div
          data-add-connection-existing
          className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--marinara-chat-chrome-highlight-bg)] p-3 text-xs"
        >
          <p>
            {t("connections.add.alreadyHave", { name: existing.name })}{" "}
            {second && !keyless && t(isLocal ? "connections.add.secondServer" : "connections.add.secondKey")}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => showModelsOf(existing.id)} className={PRIMARY_CLASS}>
              {t("connections.add.addModelsTo")}
            </button>
            {choosing && (
              <button type="button" onClick={connectSecond} className={SECONDARY_CLASS}>
                {t("connections.add.connectSecond")}
              </button>
            )}
          </div>
        </div>
      )}

      {!choosing && (
        <>
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

          {resultCard}

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
  const inPlace = !!target?.fresh && !!shownRow && !shownRow.model?.trim() && picks.length === 0;
  const recommended = provider && !NO_RECOMMENDED.has(provider) ? (MODEL_LISTS[provider] ?? []).slice(0, 3) : [];
  const targetName =
    (target && accounts?.find((account) => account.id === target.accountId)?.name) || serviceName(provider ?? "custom");
  const modelName = (modelId: string) =>
    modelList.data?.models?.find((model) => model.id === modelId)?.name ||
    (provider && MODEL_LISTS[provider]?.find((model) => model.id === modelId)?.name) ||
    modelId;

  // ── Header: Back, the step's heading and "Step n of N" ──
  const heading =
    step === 1
      ? t("connections.add.heading.service")
      : step === 2
        ? device
          ? t("connections.add.heading.device", { service: serviceName(device) })
          : isMedia || keyless
            ? t("connections.add.heading.connect", { service: serviceName(provider!) })
            : isLocal
              ? t("connections.add.heading.local")
              : t("connections.add.heading.key", { service: serviceName(provider!) })
        : step === 3
          ? t(modelsFor ? "connections.add.heading.addModels" : "connections.add.heading.star", { name: targetName })
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
          ? t(modelsFor?.chat ? "connections.add.sub.modelsChat" : "connections.add.sub.models")
          : "";
  const stepNumber = step === "ready" ? 4 : step;
  // Devices and media services end after their set-up screen.
  const totalSteps = device || isMedia ? 2 : 4;
  const goBack =
    step === 2
      ? backToList
      : step === 3 && !modelsFor && picks.length === 0
        ? target?.fresh
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
            isMedia
              ? "connections.add.continue"
              : failure
                ? "connections.add.tryAgain"
                : "connections.add.testContinue",
          )}
        </button>
      </div>
    );
  } else if (step === 3) {
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
        onClick={() => (picks.length > 0 && !modelsFor ? setStep("ready") : onClose())}
        // A new Connection needs one model; without it the window throws the Connection away.
        disabled={target?.fresh && picks.length === 0}
        className={PRIMARY_CLASS}
      >
        {t(picks.length > 0 && !modelsFor ? "connections.add.continue" : "connections.add.done")}
      </button>
    );
  } else {
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
      onClose={() => void close()}
      title={t(modelsFor ? "connections.accounts.addModel" : "connections.add.title")}
      width="max-w-3xl lg:max-w-4xl"
      mobileFullscreen
      opaque
      closeDisabled={finishing}
      panelClassName="sm:h-[min(90dvh,44rem)]"
      contentClassName="flex flex-col overflow-hidden! p-0!"
    >
      <div data-add-connection-step={step} className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-[var(--marinara-chat-chrome-panel-divider)] px-5 py-3 max-md:px-4">
          <div className="flex items-center gap-2">
            {goBack && (
              <button
                type="button"
                onClick={() => void goBack()}
                aria-label={t("connections.add.back")}
                title={t("connections.add.back")}
                className="mari-chrome-control -ml-1.5 h-11 w-11 shrink-0 p-0 md:h-8 md:w-8 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11"
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
          {subtitle && <p className="mt-1.5 text-[0.6875rem] text-[var(--muted-foreground)]">{subtitle}</p>}
        </div>

        <div key={String(step)} className="animate-fade-in-up min-h-0 flex-1">
          {step === 1 && <div className="h-full min-h-0 overflow-y-auto overscroll-contain">{serviceList}</div>}
          {step === 2 && (
            <section className="h-full min-h-0 overflow-y-auto overscroll-contain">
              <div className="mx-auto max-w-xl">{devicePane ?? connectPane}</div>
            </section>
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
                  {provider && <ServiceTile service={provider} large />}
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

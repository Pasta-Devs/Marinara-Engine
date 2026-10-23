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
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  AUDIO_SOURCE_OPTIONS,
  IMAGE_GENERATION_SOURCES,
  MODEL_LISTS,
  PROVIDERS,
  VIDEO_GENERATION_SOURCES,
  inferImageSource,
  inferVideoSource,
  isChatProvider,
  isLocalAuthProvider,
  withKeyTail,
  type APIProvider,
  type ChatModelChoice,
  type DecisionSource,
  type TTSVoicesResponse,
} from "@marinara-engine/shared";
import { Modal } from "../../ui/Modal";
import { SmoothFolderContent } from "../../ui/SmoothFolderContent";
import { ServiceRow } from "../../connections/ServiceRow";
import { ConnectionModelPicker } from "../../connections/ConnectionModelPicker";
import { BrandMark } from "../../connections/ProviderIcon";
import { StarText } from "../../connections/StarText";
import type { ConnectionRowData } from "../../connections/ConnectionRow";
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
} from "../../../hooks/use-connections";
import {
  useConnectionAccounts,
  useCreateConnectionAccount,
  useDeleteConnectionAccount,
  useFeatureModels,
  useSetFeatureModels,
  useUpdateConnectionAccount,
} from "../../../hooks/use-connection-accounts";
import { useSetChatModel } from "../../../hooks/use-chats";
import { useChatStore } from "../../../stores/chat.store";
import { useSidecarStore } from "../../../stores/sidecar.store";
import { useUIStore } from "../../../stores/ui.store";
import { useDeviceSetup } from "../../../hooks/use-device-setup";
import { flashConnectionCard, type AddFor, type AddJob, type ModelsFor } from "../../../lib/add-connection";
import { JOB, JOBS, jobAddKind, jobLabelKey, matchesKind } from "../../../lib/connection-jobs";
import { type ModelEntry, type ModelKind } from "../../../lib/add-model-search";
import { TTSConfigCard } from "../../panels/settings/TTSConfigCard";
import { useFollowVoiceJob } from "../../../hooks/use-tts";
import { SpeechToTextCard } from "../../panels/settings/SpeechToTextCard";
import { LocalWhisper } from "../../connections/DeviceDetail";
import { DecisionModelModal } from "../DecisionModelModal";
import { AccessStep } from "./AccessStep";
import { ModelsStep } from "./ModelsStep";
import { ServiceListStep } from "./ServiceListStep";
import { starAnchorOf } from "../../../hooks/use-model-star";
import { isConnectionFlagTrue } from "../../../lib/connection-filters";
import { cn } from "../../../lib/utils";
import { api } from "../../../lib/api-client";
import { decisionConnectionTestMessage } from "../../../lib/decision-test-message";
import { ttsService } from "../../../lib/tts-service";
import {
  DECISION_BUILTIN,
  DEVICE_ITEMS,
  IMAGE_VENDOR,
  JOB_PROVIDER,
  KEY_TAIL,
  KIND_ICONS,
  LINKAPI,
  LINKAPI_SERVICE,
  LOCAL_PRESETS,
  LOGIN_COMMANDS,
  MEDIA_KEY_URLS,
  MODELS_SHOWN,
  NO_RECOMMENDED,
  OFFLINE_MODELS,
  PRIMARY_CLASS,
  SECONDARY_CLASS,
  SERVICE_GROUPS,
  SEARCH_ALIASES,
  VIDEO_SOURCE_VENDOR,
  errorText,
  failureReason,
  hostOf,
  inputClass,
  isDevice,
  isLinkApiUrl,
  isSpeechModel,
  jobSourceOf,
  NETWORK_ERROR,
  SPEECH_SOURCE,
  jobKindsOf,
  kindsOf,
  labelClass,
  mediaBackendOf,
  rowKind,
  ServiceTile,
  type AddableKind,
  type ChipKind,
  type ConnectionRowLite,
  type DeviceService,
  type ServiceId,
  type Target,
  type TestResult,
} from "./shared";
import { keysOf, modelKey, popularModels, searchModels, withOwnConnections } from "../../../lib/add-model-search";

type ChatMode = "conversation" | "roleplay" | "game";

export interface CreateConnectionModalProps {
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

export function CreateConnectionModalContent({
  open,
  onClose,
  initialService,
  modelsFor,
  newChatMode,
  onStartChat,
  forJob,
}: CreateConnectionModalProps) {
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
    const own = linked.find((row) => row.provider === rowProvider && jobSourceOf(row) === source);
    if (!placeholder && own) return setMediaRowId(own.id);
    // "Use for decisions" on a model row: the decision row starts with that row's model.
    const lentModel = backend ? undefined : linked.find((row) => row.id === modelsFor?.connectionId)?.model?.trim();
    const preset = backend && AUDIO_SOURCE_OPTIONS.find((option) => option.id === source);
    const fields =
      kind === "decision"
        ? { decisionSource: source as DecisionSource, ...(lentModel ? { model: lentModel } : {}) }
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
      // The filter's own services (ElevenLabs, TypeSafe) first, so the "Show all" cap never hides them.
      services: group.sorted
        ? services.sort(
            (a, b) =>
              Number(mediaBackendOf(b)?.job === kindFilter) - Number(mediaBackendOf(a)?.job === kindFilter) ||
              serviceName(a).localeCompare(serviceName(b)),
          )
        : services,
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
  // Entry points that already know the job, kind or new-chat mode skip the cards, as before.
  const cards = step === 1 && !pick && !jobFor && !newChatMode && !searching;
  const jobList = pick === "job" && !job;
  const listJobs = cards || pick ? [] : shownJobs;
  const listModels = cards || jobList || pick === "provider" ? [] : shownModels;
  const listGroups = cards || jobList || pick === "model" ? [] : groups;
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
          {step === 1 && (
            <ServiceListStep
              firstRun={firstRun}
              pick={pick}
              setPick={setPick}
              query={query}
              setQuery={setQuery}
              cards={cards}
              jobList={jobList}
              rows={allRows as ConnectionRowData[]}
              chooseJob={chooseJob}
              kindFilter={kindFilter}
              setKindFilter={setKindFilter}
              job={job}
              jobLabel={jobLabel}
              clearJob={clearJob}
              listJobs={listJobs}
              listModels={listModels}
              listGroups={listGroups}
              shownModels={shownModels}
              routesOf={routesOf}
              accounts={accounts}
              setWant={setWant}
              showModelsOf={showModelsOf}
              chooseService={chooseService}
              setDecisionOpen={setDecisionOpen}
              serviceName={serviceName}
              serviceHint={serviceHint}
              kindItems={kindItems}
              badgesFor={badgesFor}
              service={service}
              searching={searching}
              showAllVendors={showAllVendors}
              otherOpen={otherOpen}
              setOtherOpen={setOtherOpen}
              setShowAllVendors={setShowAllVendors}
            />
          )}
          {step === 2 && <AccessStep>{devicePane ?? connectPane}</AccessStep>}

          <ModelsStep>
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
          </ModelsStep>
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

export type { ServiceId } from "./shared";

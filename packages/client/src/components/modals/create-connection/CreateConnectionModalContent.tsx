import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronLeft, Loader2 } from "lucide-react";
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
import { Modal } from "../../ui/Modal";
import { IconTile } from "../../connections/ProviderIcon";
import { StarText } from "../../connections/StarText";
import type { ConnectionRowData } from "../../connections/ConnectionRow";
import {
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
import { useUIStore } from "../../../stores/ui.store";
import { useDeviceSetup } from "../../../hooks/use-device-setup";
import { flashConnectionCard, type AddFor, type AddJob, type ModelsFor } from "../../../lib/add-connection";
import { JOB, jobAddKind, jobLabelKey, matchesKind } from "../../../lib/connection-jobs";
import type { ModelKind } from "../../../lib/add-model-search";
import { useFollowVoiceJob } from "../../../hooks/use-tts";
import { DecisionModelModal } from "../DecisionModelModal";
import { AccessStep } from "./AccessStep";
import { ModelsStep } from "./ModelsStep";
import { ServiceListStep } from "./ServiceListStep";
import { useServiceListData } from "./useServiceListData";
import { starAnchorOf } from "../../../hooks/use-model-star";
import { isConnectionFlagTrue } from "../../../lib/connection-filters";
import { jobsForAddedKinds } from "../../../lib/connection-add-adaptive";
import { cn } from "../../../lib/utils";
import {
  DECISION_BUILTIN,
  DEVICE_ITEMS,
  JOB_PROVIDER,
  KEY_TAIL,
  KIND_ICONS,
  LINKAPI,
  LINKAPI_SERVICE,
  NO_RECOMMENDED,
  PRIMARY_CLASS,
  SECONDARY_CLASS,
  errorText,
  failureReason,
  isDevice,
  jobSourceOf,
  NETWORK_ERROR,
  jobKindsOf,
  kindsOf,
  mediaBackendOf,
  type AddableKind,
  type ChipKind,
  type ConnectionRowLite,
  type DeviceService,
  type ModelPick,
  type ServiceId,
  type Target,
  type TestResult,
} from "./shared";

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
  onStartChat?: (connectionId?: string) => Promise<void>;
  /** Add for a job: step 1 starts filtered to it, and Done sets the new Model for it (with Undo). */
  forJob?: AddFor;
}

/** A pasted "127.0.0.1:7999" is a valid address to the user; the server needs the scheme. */
const withHttpScheme = (url: string) => (url && !/^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? `http://${url}` : url);

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
  const [picks, setPicks] = useState<ModelPick[]>([]);
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
  const runJobTestAction = useRef<() => Promise<void>>(async () => {});
  const [query, setQuery] = useState("");
  // Existing users open their services; the browse row opens the complete service list.
  const [pick, setPick] = useState<"job" | "model" | "provider" | null>(null);
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
  const [choosingJobs, setChoosingJobs] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState<AddJob[]>([]);
  // Set once from the first loaded list: first run means no connection rows exist.
  const [firstRun, setFirstRun] = useState<boolean | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);

  const allRows = (rows ?? []) as ConnectionRowLite[];
  const chatRows = allRows.filter((row) => isChatProvider(row.provider ?? ""));
  const hasMain = chatRows.some((row) => isConnectionFlagTrue((row as Record<string, unknown>).isDefault));
  const hasAgents = chatRows.some((row) => isConnectionFlagTrue((row as Record<string, unknown>).defaultForAgents));
  useEffect(() => {
    if (firstRun !== null || !rows) return;
    setFirstRun(!modelsFor && (rows as ConnectionRowLite[]).length === 0);
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
  const applyChoices = async (includeMain = true) => {
    if (!firstPick) return true;
    if (includeMain && offerMain && makeMainOn) {
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
  const chooseJob = (key: AddJob) => {
    setQuery("");
    const device = JOB[key].device;
    if (device) {
      void chooseService(device);
      return;
    }
    setJobFor({ job: key });
    setKindFilter(jobAddKind(key) ?? null);
  };
  const clearJob = () => {
    setJobFor(null);
    setKindFilter(null);
  };
  // Adding for a job: the first new Model of the job's kind is set for it; the result undoes that.
  const jobKind = job ? jobAddKind(job) : jobFor?.kind;
  const jobPick = jobFor && jobKind ? picks.find((pick) => pick.kind === jobKind) : undefined;
  const assignJob = async (assignment: AddFor | null = jobFor): Promise<(() => void) | null> => {
    const assignedJob = assignment?.job;
    const assignedKind = assignedJob ? jobAddKind(assignedJob) : assignment?.kind;
    const assignedPick = picks.find((pick) => pick.kind === assignedKind);
    if (!assignedPick || !assignment) return null;
    const id = assignedPick.connectionId;
    if (assignment.assign) {
      const { assign, previous = null } = assignment;
      await Promise.resolve(assign(id));
      return () => assign(previous);
    }
    if (assignedJob === "embeddings") {
      const previous = embeddingDefault.data?.connectionId ?? null;
      await setEmbeddingDefault.mutateAsync(id);
      return () => void setEmbeddingDefault.mutateAsync(previous).catch(() => {});
    }
    const entry = assignedJob ? JOB[assignedJob] : undefined;
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
      const undoVoice = assignedJob === "voice" ? await followVoiceJob(id).catch(() => null) : null;
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

  // After adding, the window closes and the panel scrolls to the new card.
  const close = async (saveChoices = false, jobs: AddJob[] = []) => {
    setFinishing(true);
    let undo: (() => void) | null = null;
    try {
      if (saveChoices && !choosingJobs && !(await applyChoices())) return;
      if (saveChoices) {
        try {
          undo = await assignJob();
          for (const key of jobs) await assignJob({ job: key });
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
    baseUrl:
      withHttpScheme(baseUrl.trim()) || selectedMedia?.defaultBaseUrl || (keyless ? "" : (def?.defaultBaseUrl ?? "")),
    maxRequestsPerMinute: maxRpm ? Math.min(600, Math.max(1, Math.trunc(Number(maxRpm)))) : null,
    maxParallelJobs: maxJobs ? Math.min(16, Math.max(1, Math.trunc(Number(maxJobs)))) : null,
  });

  /** Creates the Connection with its empty first Model (or updates it on a retry), tests it, and on success goes on. */
  const saveAndTest = async (continueAnyway = false) => {
    if (!provider) return;
    let current = target;
    const discardFreshAccount = async () => {
      if (!current?.fresh) return;
      await deleteRow.mutateAsync(current.connectionId).catch(() => undefined);
      await deleteAccount.mutateAsync(current.accountId).catch(() => undefined);
      setTarget(null);
    };
    try {
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
      const result = continueAnyway ? { success: true } : await testConnection.mutateAsync(current.connectionId);
      setTested(result);
      if (!result.success) {
        await discardFreshAccount();
        return;
      }
      // "Test and continue" is one press: a passing test opens the models.
      const available: AddableKind[] = service
        ? kindsOf(service).filter((kind): kind is AddableKind => kind !== "local")
        : ["chat"];
      setSetupKind(startKind(available));
      setStep(3);
    } catch (error) {
      await discardFreshAccount();
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
        : media && (media.source === "comfyui" || media.source === "swarmui" || media.source === "pockettts")
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

  const mediaSetupStarted = useRef("");

  const startChatting = async () => {
    if (!onStartChat || !firstPick) return;
    setFinishing(true);
    try {
      if (!(await applyChoices())) return;
      await onStartChat(makeMainOn ? undefined : firstPick.connectionId);
    } catch {
      // useCreateChat already shows the error toast; the window stays open so the user can try again.
    } finally {
      setFinishing(false);
    }
  };

  // ── Step 1: the service list ──
  const accountRows = (accountId: string) => allRows.filter((row) => row.accountId === accountId);
  const { connectedAccounts, badgesFor, searching, routesOf, listJobs, listModels, listGroups } = useServiceListData({
    firstRun,
    service,
    target,
    accounts,
    rows: allRows,
    accountRows,
    kindFilter,
    query,
    pick,
    step,
    job,
    newChatMode,
    deviceAvailable: (key) => deviceSetup[DEVICE_ITEMS[key as DeviceService]].available,
    deviceSetUp: (key) => deviceSetup[DEVICE_ITEMS[key as DeviceService]].setUp,
    serviceName,
    serviceHint,
    kindItems,
    jobLabel,
    featureModels: featureModels.data,
    embeddingId: embeddingDefault.data?.connectionId,
  });
  // ── Step 2: access for the chosen service ──
  const existing = connectedAccounts[0];
  // Already connected: the user picks one of those connections or makes a new one before any field shows.
  const choosing = connectedAccounts.length > 0 && !target && !second;
  const failure = tested && !tested.success && provider ? failureReason(provider, tested.message ?? "") : null;
  const requiresAccessKey = !keyless && !isLocal && (!isMedia || !!selectedMedia);
  const connectDisabled = busy || choosing || (isLocal && !baseUrl.trim()) || (requiresAccessKey && !apiKey.trim());
  const resetTest = () => setTested(null);
  const connectSecond = () => {
    setSecond(true);
    if (window.matchMedia?.("(pointer: fine)").matches) requestAnimationFrame(() => keyRef.current?.focus());
  };

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
    (setupKind === "decision" ? serviceName(service ?? provider ?? "custom") : undefined) ||
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
  const optionalJobs = jobsForAddedKinds(picks.map((pick) => pick.kind));
  const offerJobs = !jobFor && !modelsFor && !onStartChat && optionalJobs.length > 0;
  const finishModels = async () => {
    if (!offerJobs) {
      void close(true);
      return;
    }
    setFinishing(true);
    try {
      if (!(await applyChoices())) return;
      setMakeMain(false);
    } finally {
      setFinishing(false);
    }
    setSelectedJobs([]);
    setChoosingJobs(true);
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  // ── Header: Back, the step's heading and "Step n of N" ──
  const heading = choosingJobs
    ? t("connections.add.useFor.heading")
    : step === 1
      ? t(
          job
            ? t("connections.add.heading.forJob", { job: jobLabel(job) })
            : firstRun
              ? "connections.add.heading.firstRun"
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
  const subtitle = choosingJobs
    ? t("connections.add.useFor.body")
    : step === 1
      ? newChatMode
        ? t("connections.add.sub.gate", { mode: t(`connections.add.mode.${newChatMode}`) })
        : job
          ? t("connections.add.sub.job", { job: jobLabel(job) })
          : firstRun
            ? t("connections.add.sub.firstRun")
            : t(
                pick === "model"
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
                      : modelsFor
                        ? "connections.add.sub.modelsAdd"
                        : job
                          ? "connections.add.sub.modelsJob"
                          : "connections.add.sub.models",
              { job: job ? jobLabel(job) : "" },
            )
          : "";
  const stepNumber = job ? Math.max(1, step - 1) : step;
  // A prefilled job skips service selection, so its progress has two steps.
  const totalSteps = job ? 2 : 3;
  const goBack = choosingJobs
    ? () => setChoosingJobs(false)
    : step === 1 && (pick || job)
      ? () => {
          if (job) clearJob();
          else setPick(null);
          setQuery("");
          setKindFilter(null);
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
  if (choosingJobs) {
    footerLeft = (
      <button
        type="button"
        data-add-connection-skip-jobs
        onClick={() => void close(true)}
        disabled={finishing}
        className={SECONDARY_CLASS}
      >
        {t("connections.add.useFor.skip")}
      </button>
    );
    footerRight = (
      <button
        type="button"
        data-add-connection-assign-jobs
        onClick={() => void close(true, selectedJobs)}
        disabled={finishing}
        className={PRIMARY_CLASS}
      >
        {t("connections.add.done")}
      </button>
    );
  } else if (step === 1) {
    footerLeft = (
      <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{t("connections.add.footer.service")}</p>
    );
  } else if (step === 2) {
    footerRight = device ? (
      <button type="button" onClick={onClose} className={PRIMARY_CLASS}>
        {t("connections.add.done")}
      </button>
    ) : choosing ? null : tested?.success ? (
      <button type="button" onClick={() => setStep(3)} className={PRIMARY_CLASS}>
        {t("connections.add.continue")}
      </button>
    ) : (
      <div className="flex items-center gap-3">
        {failure && isLocal && (
          <button
            type="button"
            onClick={() => void saveAndTest(true)}
            disabled={busy}
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
          onClick={() => void runJobTestAction.current()}
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
          onClick={finishModels}
          // A new Connection needs one model; without it the window throws the Connection away.
          disabled={finishing || (target?.fresh && picks.length === 0)}
          className={PRIMARY_CLASS}
        >
          {finishing && <Loader2 size="0.75rem" className="animate-spin" aria-hidden />}
          {t(offerJobs ? "connections.add.continue" : "connections.add.done")}
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
    "sm:h-[min(90dvh,44rem)]",
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
        <div className="shrink-0 border-b border-[var(--marinara-chat-chrome-panel-divider)] px-3 py-3">
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
          {!modelsFor && !job && (
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
          {choosingJobs && (
            <div
              className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-4"
              data-add-connection-path="assignment"
            >
              <div role="group" aria-label={t("connections.add.useFor.heading")} className="flex flex-col gap-1">
                {optionalJobs.map((key, index) => {
                  const Icon = JOB[key].icon;
                  return (
                    <label key={key} className={optionClass}>
                      <input
                        type="checkbox"
                        data-add-connection-assign-job={key}
                        checked={selectedJobs.includes(key)}
                        onChange={(event) => {
                          setSelectedJobs((current) =>
                            event.target.checked ? [...current, key] : current.filter((job) => job !== key),
                          );
                        }}
                        className={checkClass}
                      />
                      <IconTile size="sm">
                        <Icon size="0.75rem" aria-hidden />
                      </IconTile>
                      <span>{jobLabel(key)}</span>
                      {index === 0 && (
                        <span className="mari-connection-pill">{t("connections.add.useFor.recommended")}</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          {!choosingJobs && step === 1 && (
            <ServiceListStep
              firstRun={firstRun}
              pick={pick}
              setPick={setPick}
              query={query}
              setQuery={setQuery}
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
            />
          )}
          {!choosingJobs && step === 2 && (
            <AccessStep
              provider={provider}
              service={service}
              device={device}
              deviceSetUp={device ? deviceSetup[DEVICE_ITEMS[device]].setUp : false}
              selectedMedia={selectedMedia}
              def={def}
              choosing={choosing}
              connectedAccounts={connectedAccounts}
              accountRows={(accountId) => accountRows(accountId) as ConnectionRowData[]}
              closeBlocked={closeBlocked}
              showModelsOf={showModelsOf}
              connectSecond={connectSecond}
              second={second}
              keyless={keyless}
              isLocal={isLocal}
              isMedia={isMedia}
              requiresAccessKey={requiresAccessKey}
              apiKey={apiKey}
              setApiKey={setApiKey}
              showKey={showKey}
              setShowKey={setShowKey}
              baseUrl={baseUrl}
              setBaseUrl={setBaseUrl}
              resetTest={resetTest}
              tested={tested}
              moreOpen={moreOpen}
              setMoreOpen={setMoreOpen}
              name={name}
              setName={setName}
              maxRpm={maxRpm}
              setMaxRpm={setMaxRpm}
              maxJobs={maxJobs}
              setMaxJobs={setMaxJobs}
              existing={existing}
              secondaryClass={SECONDARY_CLASS}
              serviceHint={serviceHint}
              serviceName={serviceName}
              modelCount={modelCount}
              keyRef={keyRef}
            />
          )}

          {!choosingJobs && (
            <ModelsStep
              step={step}
              service={service}
              provider={provider}
              selectedMedia={selectedMedia}
              modelsFor={modelsFor}
              target={target}
              accounts={accounts}
              accountRows={accountRows}
              setTarget={setTarget}
              setPicks={setPicks}
              setJobTest={setJobTest}
              setJobTesting={setJobTesting}
              passedJob={passedJob}
              setMediaCreating={setMediaCreating}
              mediaSetupStarted={mediaSetupStarted}
              onMediaError={(error) => toast.error(friendlyError(error))}
              onUnsupportedJob={(accountId) => flashConnectionCard(accountId)}
              runJobTestAction={runJobTestAction}
              availableKinds={availableKinds}
              chat={chat}
              isJobKind={isJobKind}
              setupKind={setupKind}
              closeBlocked={closeBlocked}
              setMediaRowId={setMediaRowId}
              setSetupKind={setSetupKind}
              mediaRow={mediaRow}
              targetName={targetName}
              want={want}
              addedIds={addedIds}
              jobPicker={jobPicker}
              pickerRow={pickerRow}
              jobTest={jobTest}
              inPlace={inPlace}
              onClose={onClose}
              recommended={recommended}
            />
          )}
        </div>

        {!choosingJobs && step === 3 && firstPick && !chat && (
          <div
            data-add-connection-choices
            role="group"
            aria-label={t("connections.add.readyChoices")}
            className="flex shrink-0 flex-wrap items-center gap-x-4 border-t border-[var(--marinara-chat-chrome-panel-divider)] px-3"
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

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--marinara-chat-chrome-panel-divider)] px-3 py-3">
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

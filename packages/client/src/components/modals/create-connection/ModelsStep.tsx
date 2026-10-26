import { useTranslation } from "react-i18next";
import { useEffect, type MutableRefObject } from "react";
import { AlertCircle, Check } from "lucide-react";
import type { ComponentProps } from "react";
import {
  AUDIO_SOURCE_OPTIONS,
  IMAGE_GENERATION_SOURCES,
  PROVIDERS,
  VIDEO_GENERATION_SOURCES,
  inferImageSource,
  inferVideoSource,
  isChatProvider,
  type APIProvider,
  type DecisionSource,
  type TTSVoicesResponse,
  type ConnectionAccountListItem,
} from "@marinara-engine/shared";
import type { ModelsFor } from "../../../lib/add-connection";
import { useCreateConnection, useTestConnection, useUpdateConnection } from "../../../hooks/use-connections";
import { api } from "../../../lib/api-client";
import { decisionConnectionTestMessage } from "../../../lib/decision-test-message";
import { ttsService } from "../../../lib/tts-service";
import { ConnectionModelPicker } from "../../connections/ConnectionModelPicker";
import { cn } from "../../../lib/utils";
import {
  IMAGE_VENDOR,
  JOB_PROVIDER,
  SPEECH_SOURCE,
  VIDEO_SOURCE_VENDOR,
  KIND_ICONS,
  type AddableKind,
  type ConnectionRowLite,
  type MediaBackend,
  type ModelPick,
  type ServiceId,
  type Target,
  isSpeechModel,
  jobSourceOf,
  errorText,
} from "./shared";

type RecommendedModel = NonNullable<ComponentProps<typeof ConnectionModelPicker>["recommended"]>;

export interface ModelsStepProps {
  step: 1 | 2 | 3;
  service: ServiceId | null;
  provider: APIProvider | null;
  selectedMedia: MediaBackend | null;
  modelsFor?: ModelsFor;
  target: Target | null;
  accounts?: ConnectionAccountListItem[];
  accountRows: (accountId: string) => ConnectionRowLite[];
  setTarget: (value: Target | null | ((current: Target | null) => Target | null)) => void;
  setPicks: (value: ModelPick[] | ((current: ModelPick[]) => ModelPick[])) => void;
  setJobTest: (value: { ok: boolean; message: string } | null) => void;
  setJobTesting: (value: boolean) => void;
  passedJob: MutableRefObject<Record<string, { model: string; name: string }>>;
  setMediaCreating: (value: boolean) => void;
  mediaSetupStarted: MutableRefObject<string>;
  onMediaError: (error: unknown) => void;
  onUnsupportedJob: (accountId: string) => void;
  runJobTestAction: MutableRefObject<() => Promise<void>>;
  availableKinds: AddableKind[];
  chat?: ModelsFor["chat"];
  isJobKind: boolean;
  setupKind: AddableKind | null;
  closeBlocked: boolean;
  setMediaRowId: (value: string | null) => void;
  setSetupKind: (value: AddableKind | null) => void;
  mediaRow?: ConnectionRowLite;
  targetName: string;
  want?: { model: string; kind: string } | null;
  addedIds: string[];
  jobPicker: boolean;
  pickerRow?: ConnectionRowLite;
  jobTest: { ok: boolean; message: string } | null;
  inPlace: boolean;
  onClose: () => void;
  recommended: RecommendedModel;
}

export function ModelsStep(props: ModelsStepProps) {
  const { t } = useTranslation();
  const createRow = useCreateConnection();
  const updateRow = useUpdateConnection();
  const testConnection = useTestConnection();
  const recordPick = (connectionId: string, modelId: string, kind: AddableKind = "chat") =>
    props.setPicks((current) =>
      kind !== "chat"
        ? [...current.filter((pick) => pick.connectionId !== connectionId), { connectionId, modelId, kind }]
        : current.some((pick) => pick.modelId === modelId)
          ? current
          : [...current, { connectionId, modelId, kind }],
    );
  const unstar = (modelId: string) => props.setPicks((current) => current.filter((pick) => pick.modelId !== modelId));

  const mediaSourceFor = (kind: "image" | "video") => {
    if (props.selectedMedia && props.selectedMedia[kind]) return props.selectedMedia.source;
    const linked = props.target ? props.accountRows(props.target.accountId) : [];
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
    if (props.service === "custom") return kind === "image" ? "openai" : undefined;
    if (props.service === "linkapi") return kind === "image" ? "openai" : undefined;
    if (props.provider && isChatProvider(props.provider)) {
      if (kind === "image") return Object.entries(IMAGE_VENDOR).find(([, vendor]) => vendor === props.provider)?.[0];
      return Object.entries(VIDEO_SOURCE_VENDOR).find(([, vendor]) => vendor === props.provider)?.[0];
    }
    return undefined;
  };

  const rowUsesMediaSource = (row: ConnectionRowLite, source: string) =>
    (row.provider === "image_generation" &&
      (row.imageGenerationSource || row.imageService || inferImageSource(row.model ?? "", row.baseUrl ?? "")) ===
        source) ||
    (row.provider === "video_generation" &&
      (row.videoGenerationSource || row.videoService || inferVideoSource(row.model ?? "", row.baseUrl ?? "")) ===
        source);

  const beginMediaSetup = async (kind: "image" | "video") => {
    const target = props.target;
    if (!target) return;
    const source = mediaSourceFor(kind);
    if (!source) {
      props.mediaSetupStarted.current = "";
      props.setSetupKind(null);
      props.onMediaError(new Error(t("connections.add.mediaCreateFailed")));
      return;
    }
    const rowProvider: APIProvider = kind === "image" ? "image_generation" : "video_generation";
    const linked = props.accountRows(target.accountId);
    const sourceDef = (kind === "image" ? IMAGE_GENERATION_SOURCES : VIDEO_GENERATION_SOURCES).find(
      (candidate) => candidate.id === source,
    );
    const preserveAccountEndpoint =
      source === "comfyui" || source === "swarmui" || props.service === "linkapi" || props.service === "custom";
    const siblingEndpoint = linked.find((row) => rowUsesMediaSource(row, source))?.baseUrl;
    const endpoint = preserveAccountEndpoint
      ? siblingEndpoint || target.accountBaseUrl || sourceDef?.defaultBaseUrl || ""
      : sourceDef?.defaultBaseUrl || "";
    props.setMediaCreating(true);
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
        props.setTarget((current) =>
          current?.accountId === target.accountId
            ? {
                ...current,
                placeholderId: id,
                ownedPlaceholderIds: [...new Set([...(current.ownedPlaceholderIds ?? []), id])],
              }
            : current,
        );
      }
      props.setSetupKind(kind);
      props.setMediaRowId(id);
    } catch (error) {
      props.onMediaError(error);
      props.setSetupKind(null);
    } finally {
      props.mediaSetupStarted.current = "";
      props.setMediaCreating(false);
    }
  };

  const beginJobSetup = async (kind: "decision" | "voice") => {
    const target = props.target;
    const account = target ? props.accounts?.find((candidate) => candidate.id === target.accountId) : undefined;
    if (!account || !target) return;
    const rowProvider = JOB_PROVIDER[kind];
    const vendor = account.provider as APIProvider;
    const backend = props.selectedMedia?.job === kind ? props.selectedMedia : undefined;
    const source = backend?.source ?? (kind === "decision" ? "openai_compatible" : SPEECH_SOURCE[vendor]);
    if (!source || (!backend && !isChatProvider(vendor))) {
      props.onClose();
      props.onUnsupportedJob(account.id);
      return;
    }
    const linked = props.accountRows(account.id);
    const placeholder = linked.find(
      (row) => row.id === target.placeholderId && row.provider === rowProvider && !row.model?.trim(),
    );
    const own = linked.find((row) => row.provider === rowProvider && jobSourceOf(row) === source);
    if (!placeholder && own) return props.setMediaRowId(own.id);
    const lentModel = backend
      ? undefined
      : linked.find((row) => row.id === props.modelsFor?.connectionId)?.model?.trim();
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
    props.setMediaCreating(true);
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
        id = created.id;
        props.setTarget((current) =>
          current?.accountId === account.id
            ? { ...current, ownedPlaceholderIds: [...new Set([...(current.ownedPlaceholderIds ?? []), id!])] }
            : current,
        );
      }
      props.setMediaRowId(id);
    } catch (error) {
      props.mediaSetupStarted.current = "";
      props.onMediaError(error);
    } finally {
      props.setMediaCreating(false);
    }
  };

  useEffect(() => {
    if (props.step !== 3 || !props.target || props.mediaRow || !props.setupKind || props.setupKind === "chat") return;
    const key = `${props.target.accountId}:${props.setupKind}`;
    if (props.mediaSetupStarted.current === key) return;
    props.mediaSetupStarted.current = key;
    void (props.setupKind === "image" || props.setupKind === "video"
      ? beginMediaSetup(props.setupKind)
      : beginJobSetup(props.setupKind));
    // The target/kind transition is the trigger; the helper reads the latest loaded rows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.step, props.target?.accountId, props.setupKind, props.mediaRow?.id]);

  const runJobTest = async () => {
    const row = props.mediaRow;
    if (!row || (props.setupKind !== "decision" && props.setupKind !== "voice")) return;
    props.setJobTesting(true);
    try {
      let result: { ok: boolean; message: string };
      if (props.setupKind === "decision") {
        const tested = await testConnection.mutateAsync(row.id);
        result =
          tested.success && tested.logprobs === false
            ? { ok: false, message: t("connections.add.decisionNoLogprobs") }
            : { ...decisionConnectionTestMessage(t, tested), ok: tested.success };
      } else {
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
      props.setJobTest(result);
      if (result.ok) {
        props.passedJob.current[row.id] = { model: row.model ?? "", name: row.name ?? row.model ?? "" };
        props.setPicks((current) => [
          ...current.filter((pick) => pick.connectionId !== row.id),
          { connectionId: row.id, modelId: row.model ?? "", kind: props.setupKind! },
        ]);
      }
    } catch (error) {
      props.setJobTest({ ok: false, message: errorText(error) });
    } finally {
      props.setJobTesting(false);
    }
  };

  const chooseJobModel = async (choice: import("@marinara-engine/shared").ChatModelChoice) => {
    if (!props.mediaRow) return;
    props.setJobTest(null);
    await updateRow.mutateAsync({ id: props.mediaRow.id, model: choice.model, name: choice.name || choice.model });
  };
  useEffect(() => {
    props.runJobTestAction.current = runJobTest;
  });
  return (
    <>
      {props.step === 3 && props.target && props.availableKinds.length > 1 && !props.chat && !props.isJobKind && (
        <div
          role="group"
          aria-label={t("connections.add.kindFilter")}
          className="flex shrink-0 flex-wrap gap-1.5 px-3 pt-3"
        >
          {props.availableKinds.map((kind) => {
            const Icon = KIND_ICONS[kind];
            return (
              <button
                key={kind}
                type="button"
                data-add-connection-capability={kind}
                aria-pressed={props.setupKind === kind}
                disabled={props.closeBlocked}
                onClick={() => {
                  if (props.setupKind === kind) return;
                  props.setMediaRowId(null);
                  props.setSetupKind(kind);
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

      {props.step === 3 && (props.setupKind === "image" || props.setupKind === "video") && props.mediaRow && (
        <ConnectionModelPicker
          className="h-full"
          // No account here: a model taken back off stays on its row instead of removing the row.
          connection={{ ...props.mediaRow, accountId: undefined }}
          accountName={props.targetName}
          onPicked={(modelId) => recordPick(props.mediaRow!.id, modelId, props.setupKind!)}
          preselect={props.want?.kind === props.setupKind ? props.want.model : undefined}
          addedIds={props.addedIds}
          addMode
          onUnstar={unstar}
          footer={null}
          autoFocusSearch
        />
      )}

      {props.step === 3 && props.isJobKind && props.target && (
        <div className="flex h-full min-h-0 flex-col">
          {props.jobPicker && props.pickerRow && props.mediaRow && (
            <ConnectionModelPicker
              className="min-h-0 flex-1"
              // The service's own list; a tap sets the model of the new decision or voice row.
              connection={{ ...props.pickerRow, model: props.mediaRow.model ?? "" }}
              accountName={props.targetName}
              onChoose={chooseJobModel}
              only={props.setupKind === "voice" ? isSpeechModel : undefined}
              footer={null}
              autoFocusSearch
            />
          )}
          {props.jobTest && (
            <div
              role="status"
              data-add-connection-job-test={props.jobTest.ok ? "ok" : "failed"}
              className={cn(
                "mx-5 my-3 flex shrink-0 items-start gap-3 rounded-xl border p-3 max-md:mx-4",
                props.jobTest.ok
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-[var(--destructive)]/40 bg-[var(--destructive)]/5",
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  props.jobTest.ok
                    ? "bg-emerald-500/15 text-emerald-500"
                    : "bg-[var(--destructive)]/15 text-[var(--destructive)]",
                )}
              >
                {props.jobTest.ok ? <Check size="1rem" aria-hidden /> : <AlertCircle size="1rem" aria-hidden />}
              </span>
              <p className="min-w-0 flex-1 self-center break-words text-sm">{props.jobTest.message}</p>
            </div>
          )}
        </div>
      )}

      {props.step === 3 && props.setupKind === "chat" && props.target && props.pickerRow && (
        <ConnectionModelPicker
          className="h-full"
          // From a chat's quick switch the check marks what that chat runs, and a tap chooses for it.
          connection={
            props.chat
              ? { ...props.pickerRow, model: props.chat.currentModel }
              : props.inPlace
                ? { ...props.pickerRow, accountId: undefined }
                : props.pickerRow
          }
          onChoose={
            props.chat
              ? async (choice) => {
                  await props.chat!.onChoose(choice);
                  props.onClose();
                }
              : undefined
          }
          accountName={props.targetName}
          onPicked={props.inPlace ? (modelId) => recordPick(props.target!.connectionId, modelId) : undefined}
          applyPick={props.inPlace ? undefined : async (connectionId, modelId) => recordPick(connectionId, modelId)}
          recommended={props.recommended}
          preselect={props.want?.kind === "chat" ? props.want.model : undefined}
          addedIds={props.addedIds}
          addMode
          onUnstar={unstar}
          footer={null}
          autoFocusSearch
        />
      )}
    </>
  );
}

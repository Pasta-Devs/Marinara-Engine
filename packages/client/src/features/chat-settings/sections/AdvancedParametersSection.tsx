import { useEffectiveGenerationParameters } from "../../../hooks/use-effective-generation-parameters";
import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Save, Gauge } from "lucide-react";
import { Drawer, useDrawerContentVisible } from "../../../components/ui/Drawer";
import { AgentSettingsActionButton } from "../../../components/chat/AgentSettingsControls";
import {
  CHAT_PARAMETER_DEFAULTS,
  GenerationParametersFields,
  getEditableGenerationParameters,
  type EditableGenerationParameters,
  ROLEPLAY_PARAMETER_DEFAULTS,
  STRICT_CONNECTION_PARAMETER_SEND_DEFAULTS,
} from "../../../components/ui/GenerationParametersEditor";
import { DraftNumberInput } from "../../../components/ui/DraftNumberInput";
import { DraftTextarea } from "../../../components/ui/DraftTextarea";
import { SettingsSwitch } from "../../../components/panels/settings/SettingControls";
import {
  useMayReadImages,
  useModelParameterCapabilities,
  useSaveConnectionDefaults,
} from "../../../hooks/use-connections";
import { ConnectionSelect } from "../../../components/connections/ConnectionSelect";
import { useFeatureModels } from "../../../hooks/use-connection-accounts";
import { useImageReadingSettings } from "../../../hooks/use-image-reading-settings";
import {
  isConnectionFlagTrue,
  isLanguageGenerationConnection,
  type ConnectionProviderLike,
} from "../../../lib/connection-filters";
import { useEffectiveChatModel } from "../../../components/connections/ConnectionSwitcherBody";
import { cn } from "../../../lib/utils";
import { useTranslation as useUiTranslation } from "react-i18next";
import { DEFAULT_IMAGE_CAPTIONING_PROMPT, parseConnectionImageCaptioningDefaults } from "@marinara-engine/shared";

const EDITABLE_PARAMETER_KEYS: Array<keyof EditableGenerationParameters> = [
  "temperature",
  "maxTokens",
  "topP",
  "topK",
  "frequencyPenalty",
  "presencePenalty",
  "reasoningEffort",
  "verbosity",
  "serviceTier",
  "strictRoleFormatting",
  "singleUserMessage",
  "assistantPrefill",
  "assistantReasoningPrefill",
  "customThinkingTags",
  "customParameters",
  "managedCustomParameters",
  "enabledParameters",
];

type AdvancedConnection = ConnectionProviderLike & Record<string, unknown>;

interface AdvancedParametersSectionProps {
  /** Open on arrival (the reply checkup's "Max output tokens" link). */
  forceOpen?: boolean;
  metadata: Record<string, unknown>;
  isConversation: boolean;
  /** The chat, so the settings shown follow the model it really runs (its own pick, or Main when it has none). */
  chatId: string;
  connectionId: string | null;
  connections: AdvancedConnection[];
  contextMessageLimit: number | null | undefined;
  /** Roleplay Advanced Memory sizes the history by its token cap and does not use the message limit. */
  advancedMemoryManagesHistory: boolean;
  excludePastReasoning: boolean | undefined;
  imageCaptioningEnabled: boolean | undefined;
  imageCaptioningConnectionId: string | null | undefined;
  onChatParametersChange: (chatParameters: Record<string, unknown>) => void;
  onContextMessageLimitChange: (value: number | null) => void;
  onExcludePastReasoningChange: (value: boolean) => void;
  onPastReasoningLimitChange: (value: number) => void;
  onImageCaptioningChange: (patch: {
    imageCaptioningEnabled?: boolean;
    imageCaptioningConnectionId?: string | null;
    imageCaptioningPrompt?: string | null;
  }) => void;
}

/** The on-device model cannot read images, so it never captions. */
const canCaption = (connection: AdvancedConnection) =>
  isLanguageGenerationConnection(connection) && connection.isLocalSidecar !== true;

export function AdvancedParametersSection({
  forceOpen,
  metadata,
  isConversation,
  chatId,
  connectionId,
  connections,
  contextMessageLimit,
  advancedMemoryManagesHistory,
  excludePastReasoning,
  imageCaptioningEnabled,
  imageCaptioningConnectionId,
  onChatParametersChange,
  onContextMessageLimitChange,
  onExcludePastReasoningChange,
  onPastReasoningLimitChange,
  onImageCaptioningChange,
}: AdvancedParametersSectionProps) {
  const { t: localizeUi } = useUiTranslation();
  const modeDefaults = isConversation ? CHAT_PARAMETER_DEFAULTS : ROLEPLAY_PARAMETER_DEFAULTS;
  const strictModeDefaults: EditableGenerationParameters = {
    ...modeDefaults,
    enabledParameters: STRICT_CONNECTION_PARAMETER_SEND_DEFAULTS,
  };
  const conn = connectionId ? connections.find((connection) => connection.id === connectionId) : null;
  // A chat without a Model of its own answers through the Main model (generate.routes.ts), so its settings, defaults
  // and hidden parameters come from Main. Without this it showed every parameter, even ones Main never sends.
  const mainConn = connectionId
    ? null
    : (connections.find((connection) => isConnectionFlagTrue(connection.isDefault)) ?? null);
  const generationConn = conn ?? mainConn;
  const generationConnectionId = connectionId ?? (typeof mainConn?.id === "string" ? mainConn.id : null);
  // The effective model also carries the chat's own catalog pick and the Connection's provider.
  const effectiveModel = useEffectiveChatModel(chatId);
  const isShuffle = connectionId === "random";
  const filterProvider = isShuffle
    ? null
    : effectiveModel?.kind === "model"
      ? (effectiveModel.provider ?? generationConn?.provider ?? null)
      : (generationConn?.provider ?? null);
  const filterModel =
    effectiveModel?.kind === "model"
      ? (effectiveModel.model ?? generationConn?.model ?? null)
      : (generationConn?.model ?? null);
  const filterBaseUrl =
    effectiveModel?.kind === "model" && effectiveModel.baseUrl
      ? effectiveModel.baseUrl
      : typeof generationConn?.baseUrl === "string"
        ? generationConn.baseUrl
        : null;
  const connectionModelCapabilities = useModelParameterCapabilities(
    isShuffle || !generationConnectionId
      ? null
      : { id: generationConnectionId, provider: filterProvider, model: filterModel },
  );
  const canSaveConnectionDefaults = !!connectionId && connectionId !== "random" && conn?.isLocalSidecar !== true;
  const imageCaptioningDefaults = parseConnectionImageCaptioningDefaults(conn?.defaultParameters);
  const saveDefaults = useSaveConnectionDefaults();
  const [expanded, setExpanded] = useState(false);
  // Explicit navigation opens once; a later user collapse still wins.
  useEffect(() => {
    if (forceOpen) setExpanded(true);
  }, [forceOpen]);
  const contentVisible = useDrawerContentVisible("advanced-parameters", expanded);
  const preview = useEffectiveGenerationParameters(generationConnectionId, contentVisible);
  const awaitingDefaults = preview.canPreview && !preview.data;
  const defaults = getEditableGenerationParameters(
    strictModeDefaults,
    preview.data?.inheritedParameters ?? generationConn?.defaultParameters,
  );
  const params = (metadata.chatParameters as Record<string, unknown>) ?? {};
  const effectiveParams = getEditableGenerationParameters(defaults, params);
  const excludeReasoningEnabled = excludePastReasoning !== false;
  const captioningEnabled =
    typeof imageCaptioningEnabled === "boolean"
      ? imageCaptioningEnabled
      : imageCaptioningDefaults.imageCaptioningEnabled === true;
  const customCaptioningPrompt =
    typeof metadata.imageCaptioningPrompt === "string" && metadata.imageCaptioningPrompt.trim()
      ? metadata.imageCaptioningPrompt
      : "";
  // Without the chat's own prompt, the engine-wide Image reading prompt (Library › Connections) is used.
  const engineCaptioningPrompt = useImageReadingSettings().data?.prompt?.trim() || DEFAULT_IMAGE_CAPTIONING_PROMPT;
  // Automatic captioning (an Image reading model, switch never touched here) reads with this prompt too.
  const imageReadingDefaultSet = !!useFeatureModels().data?.visionConnectionId;
  const showCaptioningPrompt =
    captioningEnabled || (typeof imageCaptioningEnabled !== "boolean" && imageReadingDefaultSet);
  const mayReadImages = useMayReadImages();
  const chatConnectionCanCaption = !!conn && canCaption(conn);
  const connectionOptions = useMemo(
    () =>
      connections.flatMap((connection) => {
        if (!canCaption(connection)) return [];
        const id = typeof connection.id === "string" ? connection.id : "";
        if (!id) return [];
        const name = typeof connection.name === "string" && connection.name.trim() ? connection.name.trim() : id;
        const model = typeof connection.model === "string" && connection.model.trim() ? connection.model.trim() : "";
        return [{ id, name, model }];
      }),
    [connections],
  );
  const hasCaptioningConnection = chatConnectionCanCaption || connectionOptions.length > 0;
  const effectiveCaptioningConnectionId =
    imageCaptioningConnectionId !== undefined
      ? imageCaptioningConnectionId
      : (imageCaptioningDefaults.imageCaptioningConnectionId ?? null);
  const selectedCaptioningConnectionId = connectionOptions.some(
    (option) => option.id === effectiveCaptioningConnectionId,
  )
    ? effectiveCaptioningConnectionId
    : null;
  const fallbackCaptioningConnectionId = chatConnectionCanCaption ? null : (connectionOptions[0]?.id ?? null);

  useEffect(() => {
    if (!captioningEnabled) return;
    if (imageCaptioningConnectionId === undefined) return;
    const storedId = typeof imageCaptioningConnectionId === "string" ? imageCaptioningConnectionId : null;
    const storedIsValid = !!storedId && connectionOptions.some((option) => option.id === storedId);
    if (storedId && !storedIsValid) {
      onImageCaptioningChange({ imageCaptioningConnectionId: fallbackCaptioningConnectionId });
    } else if (!storedId && !chatConnectionCanCaption && fallbackCaptioningConnectionId) {
      onImageCaptioningChange({ imageCaptioningConnectionId: fallbackCaptioningConnectionId });
    }
  }, [
    captioningEnabled,
    chatConnectionCanCaption,
    connectionOptions,
    fallbackCaptioningConnectionId,
    imageCaptioningConnectionId,
    onImageCaptioningChange,
  ]);

  const setParameters = (next: EditableGenerationParameters) => {
    if (awaitingDefaults) return;
    const editableKeys = new Set<string>(EDITABLE_PARAMETER_KEYS);
    const sparse: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (!editableKeys.has(key)) sparse[key] = value;
    }
    for (const key of EDITABLE_PARAMETER_KEYS) {
      if (key === "enabledParameters") continue;
      if (JSON.stringify(next[key]) !== JSON.stringify(defaults[key])) {
        sparse[key] = next[key];
      }
    }
    // Preserve explicit Send choices without freezing inherited connection switches
    // when the user edits an unrelated value.
    const previousSend = (params.enabledParameters ?? {}) as Record<string, unknown>;
    const sendOverrides = Object.fromEntries(
      Object.entries(next.enabledParameters ?? {}).filter(
        ([key, value]) =>
          typeof previousSend[key] === "boolean" ||
          value !== effectiveParams.enabledParameters?.[key as keyof typeof effectiveParams.enabledParameters],
      ),
    );
    if (Object.keys(sendOverrides).length > 0) sparse.enabledParameters = sendOverrides;
    if (
      next.strictRoleFormatting !== effectiveParams.strictRoleFormatting ||
      next.singleUserMessage !== effectiveParams.singleUserMessage ||
      params.strictRoleFormatting !== undefined ||
      params.singleUserMessage !== undefined
    ) {
      sparse.strictRoleFormatting = next.strictRoleFormatting;
      sparse.singleUserMessage = next.singleUserMessage;
    }
    onChatParametersChange(sparse);
  };
  return (
    // Starts collapsed on every open, as before, so the parameter preview loads only when asked for.
    <Drawer
      id="advanced-parameters"
      title={localizeUi("ui.chatSettings.advancedparameterssection.advancedParameters")}
      icon={<Gauge size="0.875rem" />}
      // The how-it-works notes live in the ? tip (and the docs), so the section opens straight on its settings.
      help={[
        localizeUi("ui.chatSettings.advancedparameterssection.overrideGenerationParametersForThisChatOnlyChangeThese"),
        localizeUi("generationParameters.effective.hint"),
        localizeUi("settings.customGenerationParameters.availabilityHint"),
      ].join(" ")}
      open={expanded}
      onOpenChange={setExpanded}
      bodyClassName="pt-3 space-y-3"
      rootAttributes={{ "data-chat-settings-section": "advanced-parameters" }}
    >
      {(preview.isError || awaitingDefaults) && (
        <p className="text-[0.625rem] text-[var(--muted-foreground)]">
          {localizeUi(
            preview.isError ? "generationParameters.effective.unavailable" : "generationParameters.effective.loading",
          )}
        </p>
      )}
      {preview.isError && (
        <AgentSettingsActionButton type="button" onClick={() => void preview.refetch()}>
          {localizeUi("generationParameters.effective.retry")}
        </AgentSettingsActionButton>
      )}
      <fieldset disabled={awaitingDefaults} className="min-w-0 disabled:opacity-60">
        <GenerationParametersFields
          effectiveParameters={preview.data?.parameters}
          value={effectiveParams}
          provider={filterProvider}
          model={filterModel}
          baseUrl={filterBaseUrl}
          modelCapabilities={connectionModelCapabilities}
          enabledParametersFallback={STRICT_CONNECTION_PARAMETER_SEND_DEFAULTS}
          onChange={setParameters}
          modelNote={
            isShuffle
              ? localizeUi("generationParameters.model.shuffle")
              : mainConn && effectiveModel?.followsMain
                ? localizeUi("generationParameters.model.followsMain", {
                    model: effectiveModel?.title || filterModel || "",
                  })
                : undefined
          }
        />
      </fieldset>
      <div className="space-y-2 pt-3">
        <SettingsSwitch
          label={localizeUi("ui.chatSettings.advancedparameterssection.limitContextMessages")}
          description={localizeUi("ui.chatSettings.advancedparameterssection.onlySendTheLastNMessagesToTheModel")}
          checked={Boolean(contextMessageLimit)}
          onChange={(checked) => onContextMessageLimitChange(checked ? 50 : null)}
          labelPosition="start"
          className={cn(
            "justify-between rounded-lg px-3 py-2.5 text-left",
            contextMessageLimit
              ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
              : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
          )}
          labelClassName="text-xs font-medium"
        />
        {contextMessageLimit && (
          <div className="flex items-center gap-2 px-1">
            <DraftNumberInput
              aria-label={localizeUi("ui.chatSettings.advancedparameterssection.contextMessageLimit")}
              min={1}
              max={9999}
              value={contextMessageLimit}
              onCommit={(value) => onContextMessageLimitChange(Math.max(1, Math.min(9999, value)))}
              selectOnFocus
              className="w-20 rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
            />
            <span className="text-[0.625rem] text-[var(--muted-foreground)]">
              {localizeUi("ui.agents.agenteditor.messages")}
            </span>
          </div>
        )}
        {contextMessageLimit && advancedMemoryManagesHistory && (
          <p className="px-1 text-[0.625rem] text-[var(--muted-foreground)]">
            {localizeUi("ui.chatSettings.advancedparameterssection.contextMessageLimitAdvancedMemory")}
          </p>
        )}
        <SettingsSwitch
          label={localizeUi("ui.chatSettings.advancedparameterssection.excludePastReasoning")}
          description={localizeUi(
            "ui.chatSettings.advancedparameterssection.keepStoredThinkingReasoningMetadataOutOfFuturePrompts",
          )}
          checked={excludeReasoningEnabled}
          onChange={onExcludePastReasoningChange}
          labelPosition="start"
          className={cn(
            "justify-between rounded-lg px-3 py-2.5 text-left",
            excludeReasoningEnabled
              ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
              : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
          )}
          labelClassName="text-xs font-medium"
        />
        {!excludeReasoningEnabled && (
          <label className="block space-y-1 px-1">
            <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
              {localizeUi("chatSettings.advanced.pastReasoningLimit")}
            </span>
            <DraftNumberInput
              ariaLabel={localizeUi("chatSettings.advanced.pastReasoningLimit")}
              min={0}
              max={9999}
              value={typeof metadata.pastReasoningLimit === "number" ? metadata.pastReasoningLimit : 1}
              onCommit={(value) => onPastReasoningLimitChange(Math.max(0, Math.min(9999, Math.floor(value))))}
              selectOnFocus
              className="w-20 rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
            />
            <span className="block text-[0.625rem] text-[var(--muted-foreground)]">
              {localizeUi("chatSettings.advanced.pastReasoningLimitHint")}
            </span>
          </label>
        )}
        <SettingsSwitch
          label={localizeUi("ui.chatSettings.advancedparameterssection.imageCaptioning")}
          description={
            hasCaptioningConnection
              ? localizeUi(
                  "ui.chatSettings.advancedparameterssection.describeImageAttachmentsWithASelectedConnectionInsteadOf",
                )
              : localizeUi("ui.chatSettings.advancedparameterssection.addAConnectionBeforeEnablingImageCaptioning")
          }
          checked={captioningEnabled}
          onChange={(checked) =>
            onImageCaptioningChange({
              imageCaptioningEnabled: checked,
              ...(checked && !chatConnectionCanCaption
                ? { imageCaptioningConnectionId: fallbackCaptioningConnectionId }
                : {}),
            })
          }
          disabled={!hasCaptioningConnection}
          labelPosition="start"
          className={cn(
            "justify-between rounded-lg px-3 py-2.5 text-left",
            captioningEnabled
              ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
              : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
          )}
          labelClassName="text-xs font-medium"
        />
        {captioningEnabled && (
          <label className="block space-y-1 px-1">
            <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
              {localizeUi("ui.chatSettings.advancedparameterssection.captioningConnection")}
            </span>
            <ConnectionSelect
              job={localizeUi("connections.picker.job.imageReading")}
              value={selectedCaptioningConnectionId || null}
              onChange={(connectionId) => onImageCaptioningChange({ imageCaptioningConnectionId: connectionId })}
              defaultLabel={
                chatConnectionCanCaption
                  ? localizeUi("ui.agents.agenteditor.useChatConnection")
                  : localizeUi("ui.chatSettings.advancedparameterssection.selectACaptioningConnection")
              }
              rowFilter={mayReadImages}
            />
          </label>
        )}
        {showCaptioningPrompt && !captioningEnabled && (
          <p className="px-1 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
            {localizeUi("chatSettings.advanced.imageCaptioningAutomatic")}
          </p>
        )}
        {showCaptioningPrompt && (
          <div className="space-y-1 px-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
                {localizeUi("chatSettings.advanced.imageCaptioningPrompt")}
              </span>
              {customCaptioningPrompt && (
                <button
                  type="button"
                  onClick={() => onImageCaptioningChange({ imageCaptioningPrompt: null })}
                  className="flex items-center justify-center rounded-lg bg-[var(--secondary)] px-2 py-1 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                  title={localizeUi("chatSettings.advanced.imageCaptioningPromptReset")}
                  aria-label={localizeUi("chatSettings.advanced.imageCaptioningPromptReset")}
                >
                  <RotateCcw size="0.625rem" />
                </button>
              )}
            </div>
            <DraftTextarea
              aria-label={localizeUi("chatSettings.advanced.imageCaptioningPrompt")}
              value={customCaptioningPrompt || engineCaptioningPrompt}
              onCommit={(value) => {
                // Clearing the box or matching the Image reading prompt drops the chat's own prompt.
                const trimmed = value.trim();
                onImageCaptioningChange({
                  imageCaptioningPrompt: trimmed && trimmed !== engineCaptioningPrompt.trim() ? value : null,
                });
              }}
              rows={5}
              spellCheck={false}
              className="w-full resize-y rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs leading-relaxed outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
            />
            <span className="block text-[0.625rem] text-[var(--muted-foreground)]">
              {localizeUi("chatSettings.advanced.imageCaptioningPromptHint")}
            </span>
          </div>
        )}
      </div>
      {canSaveConnectionDefaults && (
        <AgentSettingsActionButton
          type="button"
          variant="primary"
          disabled={awaitingDefaults || saveDefaults.isPending}
          onClick={() => {
            saveDefaults.mutate({
              id: connectionId,
              params: {
                ...(effectiveParams as unknown as Record<string, unknown>),
                imageCaptioningEnabled: captioningEnabled,
                imageCaptioningConnectionId: selectedCaptioningConnectionId,
              },
            });
          }}
          className="w-full"
        >
          <Save size="0.625rem" className="inline mr-1 -mt-px" />
          {saveDefaults.isPending
            ? localizeUi("chat.settings.inlineEditor.saving")
            : localizeUi("ui.chatSettings.advancedparameterssection.saveAsConnectionDefault")}
        </AgentSettingsActionButton>
      )}
      <AgentSettingsActionButton type="button" onClick={() => onChatParametersChange({})} className="w-full">
        {localizeUi("ui.chatSettings.advancedparameterssection.resetToDefaults")}
      </AgentSettingsActionButton>
    </Drawer>
  );
}

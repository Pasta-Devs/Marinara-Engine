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
import { useModelParameterCapabilities, useSaveConnectionDefaults } from "../../../hooks/use-connections";
import { isLanguageGenerationConnection, type ConnectionProviderLike } from "../../../lib/connection-filters";
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
  metadata: Record<string, unknown>;
  isConversation: boolean;
  connectionId: string | null;
  connections: AdvancedConnection[];
  contextMessageLimit: number | null | undefined;
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

export function AdvancedParametersSection({
  metadata,
  isConversation,
  connectionId,
  connections,
  contextMessageLimit,
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
  const connectionModelCapabilities = useModelParameterCapabilities(conn);
  const canSaveConnectionDefaults = !!connectionId && connectionId !== "random" && conn?.isLocalSidecar !== true;
  const imageCaptioningDefaults = parseConnectionImageCaptioningDefaults(conn?.defaultParameters);
  const saveDefaults = useSaveConnectionDefaults();
  const [expanded, setExpanded] = useState(false);
  const contentVisible = useDrawerContentVisible("advanced-parameters", expanded);
  const preview = useEffectiveGenerationParameters(connectionId, contentVisible);
  const awaitingDefaults = preview.canPreview && !preview.data;
  const defaults = getEditableGenerationParameters(
    strictModeDefaults,
    preview.data?.inheritedParameters ?? conn?.defaultParameters,
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
  const chatConnectionCanCaption = !!conn && isLanguageGenerationConnection(conn);
  const connectionOptions = useMemo(
    () =>
      connections.flatMap((connection) => {
        if (!isLanguageGenerationConnection(connection)) return [];
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
    // Send toggles are behavior, not merely editable values. Keep the explicit
    // map even when it matches the editor fallback so an inherited preset value
    // cannot make a disabled parameter reappear in the provider request.
    sparse.enabledParameters = next.enabledParameters ?? STRICT_CONNECTION_PARAMETER_SEND_DEFAULTS;
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
      help={localizeUi(
        "ui.chatSettings.advancedparameterssection.overrideGenerationParametersForThisChatOnlyChangeThese",
      )}
      open={expanded}
      onOpenChange={setExpanded}
      bodyClassName="pt-3 space-y-3"
      rootAttributes={{ "data-chat-settings-section": "advanced-parameters" }}
    >
      <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
        {localizeUi("settings.customGenerationParameters.availabilityHint")}
      </p>
      <p className="text-[0.625rem] text-[var(--muted-foreground)]">
        {localizeUi(
          preview.isError
            ? "generationParameters.effective.unavailable"
            : awaitingDefaults
              ? "generationParameters.effective.loading"
              : "generationParameters.effective.hint",
        )}
      </p>
      {preview.isError && (
        <AgentSettingsActionButton type="button" onClick={() => void preview.refetch()}>
          {localizeUi("generationParameters.effective.retry")}
        </AgentSettingsActionButton>
      )}
      <fieldset disabled={awaitingDefaults} className="min-w-0 disabled:opacity-60">
        <GenerationParametersFields
          effectiveParameters={preview.data?.parameters}
          value={effectiveParams}
          provider={conn?.provider ?? null}
          model={conn?.model ?? null}
          baseUrl={typeof conn?.baseUrl === "string" ? conn.baseUrl : null}
          modelCapabilities={connectionModelCapabilities}
          enabledParametersFallback={STRICT_CONNECTION_PARAMETER_SEND_DEFAULTS}
          onChange={setParameters}
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
            <select
              value={selectedCaptioningConnectionId ?? ""}
              onChange={(event) =>
                onImageCaptioningChange({
                  imageCaptioningConnectionId: event.target.value || null,
                })
              }
              className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
            >
              {chatConnectionCanCaption ? (
                <option value="">{localizeUi("ui.agents.agenteditor.useChatConnection")}</option>
              ) : (
                <option value="" disabled>
                  {localizeUi("ui.chatSettings.advancedparameterssection.selectACaptioningConnection")}
                </option>
              )}
              {connectionOptions.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {connection.name}
                  {connection.model
                    ? localizeUi("ui.chatSettings.advancedparameterssection.value1", { value1: connection.model })
                    : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        {captioningEnabled && (
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
              value={customCaptioningPrompt || DEFAULT_IMAGE_CAPTIONING_PROMPT}
              onCommit={(value) => {
                // Clearing the box or matching the default drops the chat's own prompt.
                const trimmed = value.trim();
                onImageCaptioningChange({
                  imageCaptioningPrompt: trimmed && trimmed !== DEFAULT_IMAGE_CAPTIONING_PROMPT ? value : null,
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

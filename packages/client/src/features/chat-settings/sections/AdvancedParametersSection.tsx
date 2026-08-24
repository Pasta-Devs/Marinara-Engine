import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { ChevronDown, Save, Settings2 } from "lucide-react";
import { HelpTooltip } from "../../../components/ui/HelpTooltip";
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
import { SettingsSwitch } from "../../../components/panels/settings/SettingControls";
import { useSaveConnectionDefaults } from "../../../hooks/use-connections";
import { isLanguageGenerationConnection, type ConnectionProviderLike } from "../../../lib/connection-filters";
import { cn } from "../../../lib/utils";
import { useTranslation as useUiTranslation } from "react-i18next";
import { parseConnectionImageCaptioningDefaults } from "@marinara-engine/shared";

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
  onImageCaptioningChange: (patch: {
    imageCaptioningEnabled?: boolean;
    imageCaptioningConnectionId?: string | null;
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
  onImageCaptioningChange,
}: AdvancedParametersSectionProps) {
  const { t: localizeUi } = useUiTranslation();
  const modeDefaults = isConversation ? CHAT_PARAMETER_DEFAULTS : ROLEPLAY_PARAMETER_DEFAULTS;
  const strictModeDefaults: EditableGenerationParameters = {
    ...modeDefaults,
    enabledParameters: STRICT_CONNECTION_PARAMETER_SEND_DEFAULTS,
  };
  const conn = connectionId ? connections.find((connection) => connection.id === connectionId) : null;
  const canSaveConnectionDefaults = !!connectionId && connectionId !== "random" && conn?.isLocalSidecar !== true;
  const defaults = getEditableGenerationParameters(strictModeDefaults, conn?.defaultParameters);
  const imageCaptioningDefaults = parseConnectionImageCaptioningDefaults(conn?.defaultParameters);
  const saveDefaults = useSaveConnectionDefaults();
  const [expanded, setExpanded] = useState(false);
  const params = (metadata.chatParameters as Record<string, unknown>) ?? {};
  const effectiveParams = getEditableGenerationParameters(defaults, params);
  const excludeReasoningEnabled = excludePastReasoning !== false;
  const captioningEnabled =
    typeof imageCaptioningEnabled === "boolean"
      ? imageCaptioningEnabled
      : imageCaptioningDefaults.imageCaptioningEnabled === true;
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
    onChatParametersChange(sparse);
  };
  const toggleExpanded = () => setExpanded((open) => !open);
  const handleHeaderKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggleExpanded();
  };

  return (
    <div data-chat-settings-section="advanced-parameters" className="border-b border-[var(--border)]">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={toggleExpanded}
        onKeyDown={handleHeaderKeyDown}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-[var(--accent)]/50"
      >
        <span className="shrink-0 text-[var(--muted-foreground)]">
          <Settings2 size="0.875rem" />
        </span>
        <span className="min-w-0 flex-1 text-xs font-semibold">
          {localizeUi("ui.chatSettings.advancedparameterssection.advancedParameters")}
        </span>
        <span className="flex shrink-0 items-center" onClick={(event) => event.stopPropagation()}>
          <HelpTooltip
            text={localizeUi(
              "ui.chatSettings.advancedparameterssection.overrideGenerationParametersForThisChatOnlyChangeThese",
            )}
            side="left"
          />
        </span>
        <ChevronDown
          size="0.75rem"
          className={cn("shrink-0 text-[var(--muted-foreground)] transition-transform", expanded && "rotate-180")}
        />
      </div>
      {expanded && (
        <div className="px-4 pb-3 pt-3 space-y-3">
          <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
            {localizeUi("settings.customGenerationParameters.availabilityHint")}
          </p>
          <GenerationParametersFields
            value={effectiveParams}
            showOpenRouterServiceTier={conn?.provider === "openrouter"}
            enabledParametersFallback={STRICT_CONNECTION_PARAMETER_SEND_DEFAULTS}
            onChange={setParameters}
          />
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
          </div>
          {canSaveConnectionDefaults && (
            <AgentSettingsActionButton
              type="button"
              variant="primary"
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
        </div>
      )}
    </div>
  );
}

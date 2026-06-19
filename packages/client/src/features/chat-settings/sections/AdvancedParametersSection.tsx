import { useState, type KeyboardEvent } from "react";
import { ChevronDown, Save, Settings2 } from "lucide-react";
import { HelpTooltip } from "../../../components/ui/HelpTooltip";
import {
  CHAT_PARAMETER_DEFAULTS,
  GenerationParametersFields,
  getEditableGenerationParameters,
  type EditableGenerationParameters,
  ROLEPLAY_PARAMETER_DEFAULTS,
} from "../../../components/ui/GenerationParametersEditor";
import { DraftNumberInput } from "../../../components/ui/DraftNumberInput";
import { SettingsSwitch } from "../../../components/panels/settings/SettingControls";
import { useSaveConnectionDefaults } from "../../../hooks/use-connections";
import { cn } from "../../../lib/utils";

interface AdvancedParametersSectionProps {
  metadata: Record<string, unknown>;
  isConversation: boolean;
  connectionId: string | null;
  connections: Record<string, unknown>[];
  contextMessageLimit: number | null | undefined;
  excludePastReasoning: boolean | undefined;
  onChatParametersChange: (chatParameters: Record<string, unknown>) => void;
  onContextMessageLimitChange: (value: number | null) => void;
  onExcludePastReasoningChange: (value: boolean) => void;
}

export function AdvancedParametersSection({
  metadata,
  isConversation,
  connectionId,
  connections,
  contextMessageLimit,
  excludePastReasoning,
  onChatParametersChange,
  onContextMessageLimitChange,
  onExcludePastReasoningChange,
}: AdvancedParametersSectionProps) {
  const modeDefaults = isConversation ? CHAT_PARAMETER_DEFAULTS : ROLEPLAY_PARAMETER_DEFAULTS;
  const conn = connectionId ? connections.find((connection) => connection.id === connectionId) : null;
  const defaults = getEditableGenerationParameters(modeDefaults, conn?.defaultParameters);
  const saveDefaults = useSaveConnectionDefaults();
  const [expanded, setExpanded] = useState(false);
  const params = (metadata.chatParameters as Record<string, unknown>) ?? {};
  const effectiveParams = getEditableGenerationParameters(defaults, params);
  const excludeReasoningEnabled = excludePastReasoning !== false;

  const setParameters = (next: EditableGenerationParameters) => {
    onChatParametersChange({ ...params, ...next });
  };
  const toggleExpanded = () => setExpanded((open) => !open);
  const handleHeaderKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggleExpanded();
  };

  return (
    <div className="border-b border-[var(--border)]">
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
        <span className="min-w-0 flex-1 text-xs font-semibold">Advanced Parameters</span>
        <span className="flex shrink-0 items-center" onClick={(event) => event.stopPropagation()}>
          <HelpTooltip
            text="Override generation parameters for this chat. Only change these if you know what you're doing."
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
          <GenerationParametersFields
            value={effectiveParams}
            showOpenRouterServiceTier={conn?.provider === "openrouter"}
            onChange={setParameters}
          />
          <div className="space-y-2 pt-3">
            <SettingsSwitch
              label="Limit Context Messages"
              description="Only send the last N messages to the model."
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
                  aria-label="Context message limit"
                  min={1}
                  max={9999}
                  value={contextMessageLimit}
                  onCommit={(value) => onContextMessageLimitChange(Math.max(1, Math.min(9999, value)))}
                  selectOnFocus
                  className="w-20 rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
                />
                <span className="text-[0.625rem] text-[var(--muted-foreground)]">messages</span>
              </div>
            )}
            <SettingsSwitch
              label="Exclude Past Reasoning"
              description="Keep stored thinking/reasoning metadata out of future prompts."
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
          </div>
          {connectionId && connectionId !== "random" && (
            <button
              onClick={() => {
                saveDefaults.mutate({
                  id: connectionId,
                  params: effectiveParams as unknown as Record<string, unknown>,
                });
              }}
              className="w-full rounded-lg bg-[var(--primary)]/10 px-3 py-1.5 text-[0.625rem] font-medium text-[var(--primary)] ring-1 ring-[var(--primary)]/20 transition-colors hover:bg-[var(--primary)]/20"
            >
              <Save size="0.625rem" className="inline mr-1 -mt-px" />
              {saveDefaults.isPending ? "Saving…" : "Save as Connection Default"}
            </button>
          )}
          <button
            onClick={() => onChatParametersChange(defaults)}
            className="w-full rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-[0.625rem] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
          >
            Reset to Defaults
          </button>
        </div>
      )}
    </div>
  );
}

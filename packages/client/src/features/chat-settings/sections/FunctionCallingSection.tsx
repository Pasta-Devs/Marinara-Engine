import { Check, FilePlus2, Plus, Trash2, Wrench } from "lucide-react";
import { cn } from "../../../lib/utils";
import { SettingsSwitch } from "../../../components/panels/settings/SettingControls";
import { ChatSettingsSection } from "../ChatSettingsSection";
import { PickerDropdown } from "../PickerDropdown";
import { useTranslation as useUiTranslation } from "react-i18next";

export interface FunctionToolOption {
  id: string;
  name: string;
  description: string;
}

interface FunctionCallingSectionProps {
  enableTools: boolean | undefined;
  forceToolCall: boolean | undefined;
  activeToolIds: string[];
  pendingToolIds: string[];
  availableTools: FunctionToolOption[];
  showToolPicker: boolean;
  toolSearch: string;
  onEnableToolsChange: (enabled: boolean) => void;
  onForceToolCallChange: (enabled: boolean) => void;
  onToggleTool: (toolId: string) => void;
  onShowToolPickerChange: (show: boolean) => void;
  onToolSearchChange: (value: string) => void;
  onPendingToolIdsChange: (updater: (previous: string[]) => string[]) => void;
  onAddPendingTools: () => void;
  onCreateCustomTool: () => void;
}

export function FunctionCallingSection({
  enableTools,
  forceToolCall,
  activeToolIds,
  pendingToolIds,
  availableTools,
  showToolPicker,
  toolSearch,
  onEnableToolsChange,
  onForceToolCallChange,
  onToggleTool,
  onShowToolPickerChange,
  onToolSearchChange,
  onPendingToolIdsChange,
  onAddPendingTools,
  onCreateCustomTool,
}: FunctionCallingSectionProps) {
  const { t: localizeUi } = useUiTranslation();
  const inactiveTools = availableTools.filter((tool) => !activeToolIds.includes(tool.id));
  const visibleInactiveTools = inactiveTools.filter((tool) =>
    tool.name.toLowerCase().includes(toolSearch.toLowerCase()),
  );

  return (
    <ChatSettingsSection
      id="function-calling"
      label={localizeUi("ui.chatSettings.functioncallingsection.functionCalling")}
      icon={<Wrench size="0.875rem" />}
      count={activeToolIds.length}
      help={localizeUi("ui.chatSettings.functioncallingsection.whenEnabledTheAiCanCallBuiltInTools")}
    >
      <div className="space-y-2">
        <SettingsSwitch
          label={localizeUi("ui.chatSettings.functioncallingsection.enableToolUse")}
          description={localizeUi("ui.chatSettings.functioncallingsection.allowAiToCallFunctionsDiceRollsGameState")}
          checked={!!enableTools}
          onChange={onEnableToolsChange}
          labelPosition="start"
          className={cn(
            "justify-between rounded-lg px-3 py-2.5 text-left",
            enableTools
              ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
              : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
          )}
          labelClassName="text-xs font-medium"
        />
        <p className="text-[0.625rem] text-[var(--muted-foreground)] px-1">
          {enableTools
            ? localizeUi("ui.chatSettings.functioncallingsection.ifEnabledThisChatCanUseGloballyEnabledTools")
            : localizeUi("ui.chatSettings.functioncallingsection.ifDisabledNoFunctionsWillBeAvailable")}
        </p>

        {enableTools && (
          <>
            <SettingsSwitch
              label={localizeUi("ui.chatSettings.functioncallingsection.forceToCallTool")}
              description={localizeUi("ui.chatSettings.functioncallingsection.forceToCallToolDescription")}
              checked={!!forceToolCall}
              onChange={onForceToolCallChange}
              labelPosition="start"
              className={cn(
                "justify-between rounded-lg px-3 py-2.5 text-left",
                forceToolCall
                  ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                  : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
              )}
              labelClassName="text-xs font-medium"
            />
            {activeToolIds.length === 0 ? (
              <p className="text-[0.6875rem] text-[var(--muted-foreground)] px-1">
                {localizeUi("ui.chatSettings.functioncallingsection.allGloballyEnabledToolsAreAvailableToThisChat")}
              </p>
            ) : (
              <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                {activeToolIds.map((toolId) => {
                  const tool = availableTools.find((item) => item.id === toolId);
                  if (!tool) return null;
                  return (
                    <div
                      key={tool.id}
                      className="flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-3 py-2 ring-1 ring-[var(--primary)]/30"
                    >
                      <Wrench size="0.875rem" className="text-[var(--primary)]" />
                      <div className="flex-1 min-w-0">
                        <span className="block truncate text-xs">{tool.name}</span>
                      </div>
                      <button
                        onClick={() => onToggleTool(tool.id)}
                        className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                        title={localizeUi("ui.chatSettings.functioncallingsection.removeFromChat")}
                      >
                        <Trash2 size="0.6875rem" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {!showToolPicker ? (
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    onShowToolPickerChange(true);
                    onToolSearchChange("");
                    onPendingToolIdsChange(() => []);
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
                >
                  <Plus size="0.75rem" /> {localizeUi("ui.chatSettings.functioncallingsection.addFunctions")}
                </button>
                <button
                  type="button"
                  onClick={onCreateCustomTool}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
                >
                  <FilePlus2 size="0.75rem" /> {localizeUi("ui.chatSettings.functioncallingsection.newCustomFunction")}
                </button>
              </div>
            ) : (
              <PickerDropdown
                search={toolSearch}
                onSearchChange={onToolSearchChange}
                onClose={() => onShowToolPickerChange(false)}
                placeholder={localizeUi("ui.chatSettings.functioncallingsection.searchFunctions")}
                footer={
                  <div className="grid gap-2 border-t border-[var(--border)] px-3 py-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={onCreateCustomTool}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                    >
                      <FilePlus2 size="0.75rem" />{" "}
                      {localizeUi("ui.chatSettings.functioncallingsection.newCustomFunction")}
                    </button>
                    <button
                      type="button"
                      disabled={pendingToolIds.length === 0}
                      onClick={onAddPendingTools}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <Plus size="0.75rem" />
                      {pendingToolIds.length > 0
                        ? localizeUi("ui.chatSettings.functioncallingsection.addValue1FunctionValue2", {
                            value1: pendingToolIds.length,
                            value2: pendingToolIds.length === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
                          })
                        : localizeUi("ui.chatSettings.functioncallingsection.addSelected")}
                    </button>
                  </div>
                }
              >
                {visibleInactiveTools.map((tool) => {
                  const selected = pendingToolIds.includes(tool.id);
                  return (
                    <button
                      key={tool.id}
                      onClick={() =>
                        onPendingToolIdsChange((previous) =>
                          previous.includes(tool.id) ? previous.filter((id) => id !== tool.id) : [...previous, tool.id],
                        )
                      }
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-[var(--accent)]",
                        selected && "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                          selected
                            ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                            : "border-[var(--border)]",
                        )}
                      >
                        {selected && <Check size="0.625rem" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="block truncate text-xs">{tool.name}</span>
                        <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]">
                          {tool.description}
                        </span>
                      </div>
                    </button>
                  );
                })}
                {visibleInactiveTools.length === 0 && (
                  <p className="px-3 py-2 text-[0.6875rem] text-[var(--muted-foreground)]">
                    {inactiveTools.length === 0
                      ? localizeUi("ui.chatSettings.functioncallingsection.allFunctionsAlreadyAdded")
                      : localizeUi("ui.lorebooks.linkedresourcepicker.noMatches")}
                  </p>
                )}
              </PickerDropdown>
            )}
          </>
        )}
      </div>
    </ChatSettingsSection>
  );
}

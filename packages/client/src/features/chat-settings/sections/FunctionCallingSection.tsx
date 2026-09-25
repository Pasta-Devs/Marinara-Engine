import { Check, FilePlus2, Plus, Trash2, Wrench } from "lucide-react";
import { cn } from "../../../lib/utils";
import { SettingsSwitch } from "../../../components/panels/settings/SettingControls";
import { DraftNumberInput } from "../../../components/ui/DraftNumberInput";
import { ChatSettingsSection } from "../ChatSettingsSection";
import { PickerDropdown } from "../PickerDropdown";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  MAX_GAME_DICE_POOL_AGE_TURNS,
  MAX_GAME_DICE_POOL_WINDOW,
  supportsNativeToolCalls,
} from "@marinara-engine/shared";

export interface FunctionToolOption {
  id: string;
  name: string;
  description: string;
}

interface FunctionCallingSectionProps {
  /** Game chats get the dice tool regardless of this toggle, so they need the extra context. */
  isGameMode: boolean;
  narratorProvider?: string;
  connections: Array<{ id: string; name: string; model?: string; provider?: string }>;
  toolConnectionId: string;
  onToolConnectionChange: (id: string | null) => void;
  gameLorebookSearch: boolean;
  onGameLorebookSearchChange: (enabled: boolean) => void;
  gameDiceOutcomeNarration: boolean;
  onGameDiceOutcomeNarrationChange: (enabled: boolean) => void;
  /** One-request dice: the Game Master finishes a rolled turn itself. Off by default. */
  gameOneRequestDice: boolean;
  onGameOneRequestDiceChange: (enabled: boolean) => void;
  /** The sighted pool sub-option. Rendered only while the parent switch is on; off by default. */
  gameDicePoolMode: boolean;
  onGameDicePoolModeChange: (enabled: boolean) => void;
  /** How many values per size the GM is shown. 1 is the default and the largest mitigation. */
  gameDicePoolWindow: number;
  onGameDicePoolWindowChange: (value: number) => void;
  /** Accepted turns a size may sit unspent before it is rethrown. 0 turns aging off. */
  gameDicePoolAgeTurns: number;
  onGameDicePoolAgeTurnsChange: (value: number) => void;
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
  isGameMode,
  narratorProvider,
  connections,
  toolConnectionId,
  onToolConnectionChange,
  gameLorebookSearch,
  onGameLorebookSearchChange,
  gameDiceOutcomeNarration,
  onGameDiceOutcomeNarrationChange,
  gameOneRequestDice,
  onGameOneRequestDiceChange,
  gameDicePoolMode,
  onGameDicePoolModeChange,
  gameDicePoolWindow,
  onGameDicePoolWindowChange,
  gameDicePoolAgeTurns,
  onGameDicePoolAgeTurnsChange,
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
  const toolProvider =
    isGameMode && toolConnectionId
      ? connections.find((connection) => connection.id === toolConnectionId)?.provider
      : narratorProvider;
  // A random-pool choice is resolved by the server at generation time; an
  // unselected narrator must still allow configuring the chat in advance.
  const nativeToolsAvailable = toolProvider ? supportsNativeToolCalls(toolProvider) : !(isGameMode && toolConnectionId);
  const loreSearchUnavailable = isGameMode && !gameLorebookSearch;
  const inactiveTools = availableTools.filter(
    (tool) => !activeToolIds.includes(tool.id) && !(loreSearchUnavailable && tool.name === "search_lorebook"),
  );
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
        {isGameMode && (
          <>
            <label className="flex flex-col gap-1 px-1 text-xs">
              {localizeUi("chat.settings.tools.connection")}
              <select
                value={toolConnectionId}
                onChange={(event) => onToolConnectionChange(event.target.value || null)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50"
              >
                <option value="">{localizeUi("chat.settings.tools.sameConnection")}</option>
                {toolConnectionId && !connections.some((connection) => connection.id === toolConnectionId) && (
                  <option value={toolConnectionId} disabled>
                    {localizeUi("chat.settings.tools.missingConnection")}
                  </option>
                )}
                {connections.map((connection) => (
                  <option
                    key={connection.id}
                    value={connection.id}
                    disabled={!supportsNativeToolCalls(connection.provider)}
                  >
                    {connection.name}
                    {connection.model
                      ? localizeUi("ui.chat.chatsettingsdrawer.value1", { value1: connection.model })
                      : ""}
                  </option>
                ))}
              </select>
            </label>
            <p className="px-1 text-[0.625rem] text-[var(--muted-foreground)]">
              {localizeUi("chat.settings.tools.connectionHelp")}
            </p>
            {/* One-request dice sits directly above the narration toggle because turning this
                on makes that one inert: its whole purpose is the second request this removes. */}
            <SettingsSwitch
              label={localizeUi("chat.settings.tools.oneRequestDice")}
              description={localizeUi("chat.settings.tools.oneRequestDiceHelp")}
              checked={gameOneRequestDice}
              onChange={onGameOneRequestDiceChange}
              labelPosition="start"
              className="justify-between rounded-lg bg-[var(--secondary)] px-3 py-2.5 text-left"
              labelClassName="text-xs font-medium"
            />
            {gameOneRequestDice && toolConnectionId && (
              <p className="px-1 text-[0.625rem] text-[var(--muted-foreground)]">
                {localizeUi("chat.settings.tools.oneRequestDiceToolConnection")}
              </p>
            )}
            {/* The sighted pool, indented under its parent and rendered only while the parent
                is on. Its help text names the trade-off outright, because a player who does not
                know the Game Master saw the dice will read a suspiciously heroic session as luck. */}
            {gameOneRequestDice && (
              <div className="ml-3 space-y-2 border-l border-[var(--border)] pl-3">
                <SettingsSwitch
                  label={localizeUi("chat.settings.tools.dicePool")}
                  description={localizeUi("chat.settings.tools.dicePoolHelp")}
                  checked={gameDicePoolMode}
                  onChange={onGameDicePoolModeChange}
                  labelPosition="start"
                  className="justify-between rounded-lg bg-[var(--secondary)] px-3 py-2.5 text-left"
                  labelClassName="text-xs font-medium"
                />
                {gameDicePoolMode && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                      {localizeUi("chat.settings.tools.dicePoolWindow")}
                      {/* The repo's canonical numeric control, not a raw number input: it holds
                          the draft while the field is being edited, so an empty field on the way
                          to a two-digit value cannot commit, and the async echo of the previous
                          commit cannot wipe the edit in progress (#5636). Bounds come from the
                          shared constants the server clamps with, so the two cannot drift. */}
                      <DraftNumberInput
                        ariaLabel={localizeUi("chat.settings.tools.dicePoolWindow")}
                        min={1}
                        max={MAX_GAME_DICE_POOL_WINDOW}
                        integer
                        value={gameDicePoolWindow}
                        onCommit={onGameDicePoolWindowChange}
                        className="w-24 rounded-xl bg-[var(--secondary)] px-3 py-2 text-xs tabular-nums ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                      />
                      <span className="font-normal">{localizeUi("chat.settings.tools.dicePoolWindowHelp")}</span>
                    </label>
                    <label className="flex flex-col gap-1 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                      {localizeUi("chat.settings.tools.dicePoolAging")}
                      <DraftNumberInput
                        ariaLabel={localizeUi("chat.settings.tools.dicePoolAging")}
                        min={0}
                        max={MAX_GAME_DICE_POOL_AGE_TURNS}
                        integer
                        value={gameDicePoolAgeTurns}
                        onCommit={onGameDicePoolAgeTurnsChange}
                        className="w-24 rounded-xl bg-[var(--secondary)] px-3 py-2 text-xs tabular-nums ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                      />
                      <span className="font-normal">{localizeUi("chat.settings.tools.dicePoolAgingHelp")}</span>
                    </label>
                  </div>
                )}
              </div>
            )}
            {/* Rendered disabled rather than hidden, and its stored value is never written here:
                a player who turns one-request dice back off gets their narration setting back
                exactly as they left it. */}
            <SettingsSwitch
              label={localizeUi("chat.settings.tools.diceOutcomeNarration")}
              description={localizeUi("chat.settings.tools.diceOutcomeNarrationHelp")}
              checked={gameDiceOutcomeNarration}
              disabled={gameOneRequestDice}
              onChange={onGameDiceOutcomeNarrationChange}
              labelPosition="start"
              className="justify-between rounded-lg bg-[var(--secondary)] px-3 py-2.5 text-left"
              labelClassName="text-xs font-medium"
            />
            {gameOneRequestDice && (
              <p className="px-1 text-xs text-[var(--muted-foreground)]">
                {localizeUi("chat.settings.tools.oneRequestDiceNarrationInert")}
              </p>
            )}
            <SettingsSwitch
              label={localizeUi("chat.settings.tools.loreSearch")}
              description={localizeUi("chat.settings.tools.loreSearchHelp")}
              checked={gameLorebookSearch}
              disabled={!nativeToolsAvailable}
              onChange={(enabled) => {
                if (!enabled) {
                  onPendingToolIdsChange((previous) =>
                    previous.filter((id) => availableTools.find((tool) => tool.id === id)?.name !== "search_lorebook"),
                  );
                }
                onGameLorebookSearchChange(enabled);
              }}
              labelPosition="start"
              className="justify-between rounded-lg bg-[var(--secondary)] px-3 py-2.5 text-left"
              labelClassName="text-xs font-medium"
            />
            {loreSearchUnavailable && (
              <p className="px-1 text-xs text-[var(--muted-foreground)]">
                {localizeUi("chat.settings.tools.loreSearchDisabled")}
              </p>
            )}
          </>
        )}
        {!nativeToolsAvailable && (
          <p role="status" className="px-1 text-xs text-[var(--muted-foreground)]">
            {localizeUi("chat.settings.tools.unavailable")}
          </p>
        )}
        <SettingsSwitch
          label={localizeUi("ui.chatSettings.functioncallingsection.enableToolUse")}
          description={localizeUi("ui.chatSettings.functioncallingsection.allowAiToCallFunctionsDiceRollsGameState")}
          checked={!!enableTools}
          disabled={!nativeToolsAvailable}
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
          {isGameMode
            ? localizeUi(
                toolConnectionId
                  ? "chat.settings.tools.separateHint"
                  : "ui.chatSettings.functioncallingsection.gameChatsAlreadyRollRealDiceWithoutThis",
              )
            : enableTools
              ? localizeUi("ui.chatSettings.functioncallingsection.ifEnabledThisChatCanUseGloballyEnabledTools")
              : localizeUi("ui.chatSettings.functioncallingsection.ifDisabledNoFunctionsWillBeAvailable")}
        </p>

        {enableTools && nativeToolsAvailable && (
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
                {localizeUi("chat.settings.tools.availableDefaults")}
              </p>
            ) : (
              <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                {activeToolIds.map((toolId) => {
                  const tool = availableTools.find((item) => item.id === toolId);
                  if (!tool) return null;
                  const unavailable = loreSearchUnavailable && tool.name === "search_lorebook";
                  return (
                    <div
                      key={tool.id}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2 ring-1",
                        unavailable
                          ? "bg-[var(--secondary)] text-[var(--muted-foreground)] ring-[var(--border)]"
                          : "bg-[var(--primary)]/10 ring-[var(--primary)]/30",
                      )}
                    >
                      <Wrench size="0.875rem" className={unavailable ? "shrink-0" : "shrink-0 text-[var(--primary)]"} />
                      <div className="flex-1 min-w-0">
                        <span className="block truncate text-xs">{tool.name}</span>
                        {unavailable && (
                          <span className="block text-xs">{localizeUi("chat.settings.tools.loreSearchDisabled")}</span>
                        )}
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

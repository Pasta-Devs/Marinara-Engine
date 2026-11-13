import { useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { MessagesSquare } from "lucide-react";
import { toast } from "sonner";
import {
  BUILT_IN_AGENT_IDS,
  type AutoActiveCharactersMode,
  type Chat,
  type GroupChatMode,
} from "@marinara-engine/shared";
import { useUpdateChatMetadata } from "../../../hooks/use-chats";
import { useHasDecisionModel } from "../../../hooks/use-decision-model";
import { cn } from "../../../lib/utils";
import { MacroTextarea } from "../../../components/ui/MacroTextarea";
import { SettingsSwitch } from "../../../components/panels/settings/SettingControls";
import { ChatSettingsSection } from "../ChatSettingsSection";

interface GroupChatSectionProps {
  sectionId: string;
  order: number;
  /** Rendered either way so the scenario draft lives as long as the drawer does; hidden when false. */
  visible: boolean;
  chat: Chat;
  metadata: Record<string, unknown>;
  isConversation: boolean;
  isRoleplayMode: boolean;
  groupChatMode: GroupChatMode;
  autoActiveCharactersMode: AutoActiveCharactersMode;
  activeManualTrackerTypes: Set<string>;
  activeAgentIds: string[];
}

export function GroupChatSection({
  sectionId,
  order,
  visible,
  chat,
  metadata,
  isConversation,
  isRoleplayMode,
  groupChatMode,
  autoActiveCharactersMode,
  activeManualTrackerTypes,
  activeAgentIds,
}: GroupChatSectionProps) {
  const { t: localizeUi } = useUiTranslation();
  const updateMeta = useUpdateChatMetadata();
  // Generation waits for queued saves, so the next reply uses the narration mode shown here (#6959).
  const updateGroupChatModeMeta = useUpdateChatMetadata({ serialize: true });
  const hasDecisionModel = useHasDecisionModel();
  const characterTrackerEnabled =
    metadata.enableAgents === true && activeAgentIds.includes(BUILT_IN_AGENT_IDS.CHARACTER_TRACKER);
  const setAutoActiveCharactersMode = (mode: AutoActiveCharactersMode) => {
    if (mode === autoActiveCharactersMode) return;
    // Turning automation off clears the pins: their icons hide with it, so kept pins would
    // silently freeze characters when it comes back on.
    updateMeta.mutate({
      id: chat.id,
      autoActiveCharacters: mode,
      ...(mode === "off" ? { autoActiveCharacterPins: [] } : {}),
    });
  };
  const [groupScenarioDraft, setGroupScenarioDraft] = useState((metadata.groupScenarioText as string) ?? "");

  if (!visible) return null;
  return (
    <ChatSettingsSection
      id={sectionId}
      style={{ order }}
      label={localizeUi("ui.chat.chatsettingsdrawer.groupChat")}
      icon={<MessagesSquare size="0.875rem" />}
      help={
        isConversation
          ? localizeUi("ui.chat.chatsettingsdrawer.chooseOneGroupedResponseOrSeparateCharacterTurnsIndividual")
          : localizeUi("ui.chat.chatsettingsdrawer.configureHowMultipleCharactersInteractMergedModeCombinesAll")
      }
    >
      {/* Mode selector */}
      <div className="space-y-2">
        <label className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
          {localizeUi("ui.chat.chatsettingsdrawer.mode")}
        </label>
        <div className="flex rounded-lg ring-1 ring-[var(--border)]">
          <button
            onClick={() => updateGroupChatModeMeta.mutate({ id: chat.id, groupChatMode: "merged" })}
            className={cn(
              "flex-1 px-3 py-2 text-[0.6875rem] font-medium transition-colors rounded-l-lg",
              groupChatMode === "merged"
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
            )}
          >
            {isConversation
              ? localizeUi("ui.chat.chatsettingsdrawer.grouped")
              : localizeUi("ui.chat.chatsettingsdrawer.mergedNarrator")}
          </button>
          <button
            onClick={() => {
              if (groupChatMode === "individual") return;
              updateGroupChatModeMeta.mutate({
                id: chat.id,
                groupChatMode: "individual",
                ...(isConversation && metadata.groupResponseOrder === "manual"
                  ? { groupResponseOrder: "sequential" as const }
                  : {}),
              });
              if (isConversation) {
                toast.warning(localizeUi("ui.chat.chatsettingsdrawer.individualRepliesCanUseManyTokens"), {
                  description: localizeUi(
                    "ui.chat.chatsettingsdrawer.eachRespondingCharacterUsesASeparateModelRequestLarge",
                  ),
                  duration: 12_000,
                });
              }
            }}
            className={cn(
              "flex-1 px-3 py-2 text-[0.6875rem] font-medium transition-colors rounded-r-lg",
              groupChatMode === "individual"
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
            )}
          >
            {localizeUi("ui.chat.chatsettingsdrawer.individual")}
          </button>
        </div>
      </div>

      {/* Merged mode: speaker color option */}
      {!isConversation && groupChatMode === "merged" && (
        <div className="mt-2">
          <SettingsSwitch
            label={localizeUi("ui.chat.chatsettingsdrawer.colorDialogues")}
            description={localizeUi(
              "ui.chat.chatsettingsdrawer.colorCharacterDialoguesDifferentlyUsingTheSpecialTagsThe",
            )}
            checked={Boolean(metadata.groupSpeakerColors)}
            onChange={(checked) => updateMeta.mutate({ id: chat.id, groupSpeakerColors: checked })}
            labelPosition="start"
            className={cn(
              "justify-between rounded-md px-3 py-2.5 text-left",
              metadata.groupSpeakerColors
                ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
            )}
            labelClassName="text-[0.6875rem] font-medium"
          />
        </div>
      )}

      {/* Merged Roleplay: who keeps the active characters current. Same segmented control as Mode. */}
      {isRoleplayMode && groupChatMode === "merged" && (
        <div className="mt-2 space-y-2">
          <label className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.chatsettingsdrawer.autoActiveCharacters.label")}
          </label>
          <div className="flex rounded-lg ring-1 ring-[var(--border)]">
            {(["off", "decision", "tracker"] as const).map((mode, index, modes) => (
              <button
                key={mode}
                type="button"
                onClick={() => setAutoActiveCharactersMode(mode)}
                aria-pressed={autoActiveCharactersMode === mode}
                className={cn(
                  "flex-1 px-3 py-2 text-[0.6875rem] font-medium transition-colors",
                  index === 0 && "rounded-l-lg",
                  index === modes.length - 1 && "rounded-r-lg",
                  autoActiveCharactersMode === mode
                    ? "bg-[var(--primary)] text-white"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                )}
              >
                {localizeUi(`ui.chat.chatsettingsdrawer.autoActiveCharacters.${mode}`)}
              </button>
            ))}
          </div>
          <p className="text-[0.625rem] text-[var(--muted-foreground)]">
            {autoActiveCharactersMode === "decision"
              ? hasDecisionModel
                ? localizeUi("ui.chat.chatsettingsdrawer.autoActiveCharacters.decisionHint")
                : localizeUi("ui.chat.chatsettingsdrawer.autoActiveCharacters.decisionMissingHint")
              : autoActiveCharactersMode === "tracker"
                ? !characterTrackerEnabled
                  ? localizeUi("ui.chat.chatsettingsdrawer.autoActiveCharacters.trackerMissingHint")
                  : activeManualTrackerTypes.has(BUILT_IN_AGENT_IDS.CHARACTER_TRACKER)
                    ? localizeUi("ui.chat.chatsettingsdrawer.autoActiveCharacters.trackerManualHint")
                    : localizeUi("ui.chat.chatsettingsdrawer.autoActiveCharacters.trackerHint")
                : localizeUi("ui.chat.chatsettingsdrawer.autoActiveCharacters.offHint")}
          </p>
        </div>
      )}

      {/* Individual mode: response order */}
      {groupChatMode === "individual" && (
        <div className="mt-2 space-y-2">
          <label className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.chatsettingsdrawer.responseOrder")}
          </label>
          <div className="flex rounded-lg ring-1 ring-[var(--border)]">
            <button
              onClick={() => updateMeta.mutate({ id: chat.id, groupResponseOrder: "sequential" })}
              className={cn(
                "flex-1 px-3 py-2 text-[0.6875rem] font-medium transition-colors rounded-l-lg",
                (metadata.groupResponseOrder ?? "sequential") === "sequential"
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
              )}
            >
              {localizeUi("ui.chat.chatsettingsdrawer.sequential")}
            </button>
            <button
              onClick={() => updateMeta.mutate({ id: chat.id, groupResponseOrder: "smart" })}
              className={cn(
                "flex-1 px-3 py-2 text-[0.6875rem] font-medium transition-colors",
                metadata.groupResponseOrder === "smart"
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
              )}
            >
              {localizeUi("ui.chat.chatsettingsdrawer.smart")}
            </button>
            <button
              onClick={() => updateMeta.mutate({ id: chat.id, groupResponseOrder: "manual" })}
              className={cn(
                "flex-1 px-3 py-2 text-[0.6875rem] font-medium transition-colors rounded-r-lg",
                metadata.groupResponseOrder === "manual"
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
              )}
            >
              {localizeUi("ui.chat.chatsettingsdrawer.manual")}
            </button>
          </div>
          <p className="text-[0.625rem] text-[var(--muted-foreground)]">
            {metadata.groupResponseOrder === "manual"
              ? isConversation
                ? localizeUi("ui.chat.chatsettingsdrawer.noAutomaticResponsesMentionOneOrMoreCharactersTo")
                : localizeUi("ui.chat.chatsettingsdrawer.noAutomaticResponsesUseTheCharacterPickerInThe")
              : metadata.groupResponseOrder === "smart"
                ? isConversation
                  ? localizeUi("ui.chat.chatsettingsdrawer.smartChoosesOneOrMoreAvailableCharactersUsingThe")
                  : localizeUi("ui.chat.chatsettingsdrawer.anAiAgentDecidesWhichCharactersShouldRespondBased")
                : isConversation
                  ? localizeUi("ui.chat.chatsettingsdrawer.availableCharactersRespondOneByOneInTheirListed")
                  : localizeUi("ui.chat.chatsettingsdrawer.charactersRespondOneByOneInTheirListedOrder")}
          </p>
          <SettingsSwitch
            label={localizeUi("ui.chat.chatsettingsdrawer.addTurnToPrompt")}
            description={
              metadata.groupTurnPromptEnabled !== false
                ? localizeUi(
                    "ui.chat.chatsettingsdrawer.eachIndividualTurnIncludesAShortRespondingCharacterInstruction",
                  )
                : localizeUi("ui.chat.chatsettingsdrawer.individualTurnsRelyOnContextWithoutAddingATurn")
            }
            checked={metadata.groupTurnPromptEnabled !== false}
            onChange={(checked) =>
              updateMeta.mutate({
                id: chat.id,
                groupTurnPromptEnabled: checked,
              })
            }
            labelPosition="start"
            className={cn(
              "justify-between rounded-md px-3 py-2.5 text-left",
              metadata.groupTurnPromptEnabled !== false
                ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
            )}
            labelClassName="text-[0.6875rem] font-medium"
          />
          {!isConversation && (
            <SettingsSwitch
              label={localizeUi("ui.chat.chatsettingsdrawer.namePrefixHistory")}
              description={
                metadata.groupSpeakerNamesInHistory === true
                  ? localizeUi("ui.chat.chatsettingsdrawer.historyTurnsAreSentAsNameMessageBeforeMerged")
                  : localizeUi("ui.chat.chatsettingsdrawer.historyTurnsKeepTheirStoredTextBeforeRoleMerging")
              }
              checked={metadata.groupSpeakerNamesInHistory === true}
              onChange={(checked) => updateMeta.mutate({ id: chat.id, groupSpeakerNamesInHistory: checked })}
              labelPosition="start"
              className={cn(
                "justify-between rounded-md px-3 py-2.5 text-left",
                metadata.groupSpeakerNamesInHistory === true
                  ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                  : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
              )}
              labelClassName="text-[0.6875rem] font-medium"
            />
          )}
        </div>
      )}

      {/* Scenario Override */}
      {!isConversation && (
        <div className="mt-2 space-y-1.5">
          <label className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.chatsettingsdrawer.scenarioOverride")}
          </label>
          <MacroTextarea
            title={localizeUi("ui.chat.chatsettingsdrawer.groupScenarioOverride")}
            value={groupScenarioDraft}
            onChange={setGroupScenarioDraft}
            onBlur={() => {
              if (groupScenarioDraft !== (metadata.groupScenarioText ?? "")) {
                updateMeta.mutate({ id: chat.id, groupScenarioText: groupScenarioDraft });
              }
            }}
            onExpandedClose={() => {
              if (groupScenarioDraft !== (metadata.groupScenarioText ?? "")) {
                updateMeta.mutate({ id: chat.id, groupScenarioText: groupScenarioDraft });
              }
            }}
            placeholder={localizeUi(
              "ui.chat.chatsettingsdrawer.replaceIndividualCharacterScenariosWithASharedScenarioFor",
            )}
            rows={4}
            className="mari-chrome-field min-h-[6rem] !rounded-md px-3 py-2 pr-8 text-xs leading-relaxed"
          />
        </div>
      )}
    </ChatSettingsSection>
  );
}

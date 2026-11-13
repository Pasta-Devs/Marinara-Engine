import { type Chat, type ChatMode, type GroupChatMode } from "@marinara-engine/shared";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useUpdateChatMetadata } from "../../../hooks/use-chats";
import { useId } from "react";
import { SettingsSwitch } from "../../../components/panels/settings/SettingControls";
import { cn } from "../../../lib/utils";
import { AdvancedMemorySettings } from "../../../components/chat/AdvancedMemorySettings";
import { Brain } from "lucide-react";
import { AdvancedMemoryInspector } from "../../../components/chat/AdvancedMemoryInspector";
import { ChatSettingsSection } from "../ChatSettingsSection";

interface MemoryRecallSectionProps {
  order: number;
  chat: Chat;
  metadata: Record<string, any>;
  chatMode: ChatMode;
  isConversation: boolean;
  isRoleplayMode: boolean;
  isGame: boolean;
  /** Required, not optional: the "memory-recall" link opens this section in Roleplay and Game. */
  initialSection: string | null | undefined;
  groupChatMode: GroupChatMode;
  chatCharIds: string[];
  charNameMap: Map<string, string>;
  memoryView: "advanced" | "standard" | null;
  setMemoryView: React.Dispatch<React.SetStateAction<"advanced" | "standard" | null>>;
  advancedMemoryAvailable: boolean;
  advancedMemoryEnabled: boolean;
  advancedMemoryNeedsReview: boolean;
}

export function MemoryRecallSection({
  order,
  chat,
  metadata,
  chatMode,
  isConversation,
  isRoleplayMode,
  isGame,
  initialSection,
  groupChatMode,
  chatCharIds,
  charNameMap,
  memoryView,
  setMemoryView,
  advancedMemoryAvailable,
  advancedMemoryEnabled,
  advancedMemoryNeedsReview,
}: MemoryRecallSectionProps) {
  const { t: localizeUi } = useUiTranslation();
  const updateMeta = useUpdateChatMetadata();
  const advancedMemoryAttentionId = useId();
  const renderMemoryRecallControls = (defaultOn: boolean) => {
    const effectiveValue =
      !advancedMemoryEnabled &&
      (metadata.enableMemoryRecall !== undefined ? metadata.enableMemoryRecall === true : defaultOn);
    return (
      <div className="space-y-2">
        <SettingsSwitch
          label={localizeUi("ui.chat.chatsettingsdrawer.enableMemoryRecall")}
          description={localizeUi("ui.chat.chatsettingsdrawer.recallRelevantFragmentsFromEarlierInThisChatAnd")}
          checked={effectiveValue}
          onChange={(enableMemoryRecall) => updateMeta.mutate({ id: chat.id, enableMemoryRecall })}
          labelPosition="start"
          className={cn(
            "justify-between rounded-md px-3 py-2.5 text-left",
            effectiveValue
              ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
              : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
          )}
          labelClassName="text-[0.6875rem] font-medium"
        />
        {advancedMemoryAvailable && (
          <AdvancedMemorySettings
            chatId={chat.id}
            metadataSettings={metadata.advancedMemory}
            gameMode={isGame}
            individual={!isGame && groupChatMode === "individual"}
            characters={chatCharIds.map((id) => ({ id, name: charNameMap.get(id) ?? id }))}
            hasHistory={!!chat.lastMessageAt}
          />
        )}
        <button
          type="button"
          onClick={() =>
            setMemoryView((current) =>
              advancedMemoryEnabled ? (current === "advanced" ? null : "advanced") : "standard",
            )
          }
          className="mari-chrome-control relative flex min-h-9 w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-50"
          aria-expanded={advancedMemoryEnabled ? memoryView === "advanced" : undefined}
          aria-describedby={advancedMemoryEnabled && advancedMemoryNeedsReview ? advancedMemoryAttentionId : undefined}
        >
          <Brain size="0.75rem" />
          {localizeUi("ui.chat.chatsettingsdrawer.accessMemoriesForThisChat")}
          {advancedMemoryEnabled && advancedMemoryNeedsReview && (
            // The theme's accent held steady marks scenes that need attention.
            <span
              data-advanced-memory-attention
              aria-hidden="true"
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--marinara-app-accent-static)]"
            />
          )}
        </button>
        {advancedMemoryEnabled && advancedMemoryNeedsReview && (
          <span id={advancedMemoryAttentionId} className="sr-only">
            {localizeUi("chat.advancedMemory.fix.scenesNeedAttention")}
          </span>
        )}
        {advancedMemoryEnabled && memoryView === "advanced" && (
          <AdvancedMemoryInspector
            chatId={chat.id}
            individual={!isGame && groupChatMode === "individual"}
            characters={chatCharIds.map((id) => ({ id, name: charNameMap.get(id) ?? id }))}
          />
        )}
      </div>
    );
  };
  return (
    <ChatSettingsSection
      id={`${chatMode}-memory-recall`}
      // Only Roleplay and Game open on the memory-recall link; Conversation never did.
      forceOpen={isConversation ? undefined : initialSection === "memory-recall"}
      style={{ order }}
      label={localizeUi("ui.chat.chatsettingsdrawer.memoryRecall")}
      icon={<Brain size="0.875rem" />}
      help={localizeUi(
        isRoleplayMode
          ? "chat.advancedMemory.recallHelp"
          : "ui.chat.chatsettingsdrawer.whenEnabledRelevantFragmentsFromThisChatAreAutomatically",
      )}
    >
      {/* Conversation recalls by default; Roleplay and Game only during an active scene. */}
      {renderMemoryRecallControls(isConversation ? true : metadata.sceneStatus === "active")}
    </ChatSettingsSection>
  );
}

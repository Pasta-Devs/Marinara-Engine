// Long-term memory's Chat Settings controls. Conversation shows an on/off switch above the package's own
// settings; Roleplay and Game turn the agent on from their agent lists, so they show only the package's settings.
import type { Chat } from "@marinara-engine/shared";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useUpdateChatMetadata } from "../../../hooks/use-chats";
import { CapabilityElement } from "../../../components/capabilities/CapabilityElement";
import { SettingsSwitch } from "../../../components/panels/settings/SettingControls";
import { showAlertDialog } from "../../../lib/app-dialogs";
import { cn } from "../../../lib/utils";
import { useUIStore } from "../../../stores/ui.store";

export function LongTermMemoryEnableSwitch({
  enabledForChat,
  setLtmEnabledForChat,
}: {
  enabledForChat: boolean;
  setLtmEnabledForChat: (enabled: boolean) => Promise<void>;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <SettingsSwitch
      label={localizeUi("ui.chat.chatsettingsdrawer.longTermMemory")}
      description={localizeUi("ui.chat.chatsettingsdrawer.enableLongTermMemoryForThisConversation")}
      checked={enabledForChat}
      onChange={(enabled) => {
        void setLtmEnabledForChat(enabled).catch((error) => {
          void showAlertDialog({
            title: localizeUi("ui.chat.chatsettingsdrawer.longTermMemory"),
            message:
              error instanceof Error
                ? error.message
                : localizeUi("ui.chat.chatsettingsdrawer.failedToUpdateLongTermMemory"),
          });
        });
      }}
      labelPosition="start"
      className={cn(
        "justify-between rounded-lg px-3 py-2.5 text-left",
        enabledForChat
          ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
          : "bg-[var(--background)]/75 ring-1 ring-[var(--border)] hover:bg-[var(--accent)]",
      )}
      labelClassName="text-xs font-medium"
    />
  );
}

export function LongTermMemoryCapabilitySettings({
  chat,
  metadata,
  packageId,
  enabledForChat,
  setLtmEnabledForChat,
  requestClose,
  rememberSettingsReturn,
  className = "block overflow-hidden rounded-lg",
}: {
  chat: Chat;
  metadata: Record<string, unknown>;
  packageId: string;
  enabledForChat: boolean;
  setLtmEnabledForChat: (enabled: boolean) => Promise<void>;
  requestClose: () => Promise<boolean>;
  rememberSettingsReturn: () => void;
  /** Roleplay's standalone agent card draws its own rounded frame, so it passes this without the rounding. */
  className?: string;
}) {
  const updateMeta = useUpdateChatMetadata();
  const setEditorDirty = useUIStore((s) => s.setEditorDirty);
  return (
    <CapabilityElement
      packageId={packageId}
      view="settings"
      capabilityProps={{
        chatId: chat.id,
        enabledForChat,
        chatSettings: {
          longTermMemoryRecallStyle: metadata.longTermMemoryRecallStyle,
          longTermMemoryBudgetTokens: metadata.longTermMemoryBudgetTokens,
          longTermMemoryMaxChunks: metadata.longTermMemoryMaxChunks,
        },
        onEnabledForChatChange: setLtmEnabledForChat,
        onChatSettingsChange: async (patch: Record<string, unknown>) => {
          await updateMeta.mutateAsync({ id: chat.id, ...patch });
        },
        onOpenAgentSettings: () => {
          void requestClose().then((closed) => {
            if (closed) {
              rememberSettingsReturn();
              useUIStore.getState().openAgentDetail("long-term-memory");
            }
          });
        },
        onDirtyChange: setEditorDirty,
      }}
      className={className}
    />
  );
}

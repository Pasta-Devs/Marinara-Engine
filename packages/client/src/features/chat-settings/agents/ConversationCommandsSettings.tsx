import { type Chat, type ConversationCommandToggles, isConversationCommandToggleOn } from "@marinara-engine/shared";
import type { ConversationCommandToggleOption } from "../lib/conversation-command-toggles";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useUpdateChatMetadata } from "../../../hooks/use-chats";
import { SettingsSwitch } from "../../../components/panels/settings/SettingControls";
import { cn } from "../../../lib/utils";

interface ConversationCommandsSettingsProps {
  chat: Chat;
  conversationCommandsEnabled: boolean;
  conversationCommandToggles: ConversationCommandToggles;
  availableConversationCommandOptions: ConversationCommandToggleOption[];
}

export function ConversationCommandsSettings({
  chat,
  conversationCommandsEnabled,
  conversationCommandToggles,
  availableConversationCommandOptions,
}: ConversationCommandsSettingsProps) {
  const { t: localizeUi } = useUiTranslation();
  const updateMeta = useUpdateChatMetadata();
  return (
    <>
      <SettingsSwitch
        label={localizeUi("ui.chat.chatsettingsdrawer.commands")}
        description={localizeUi("ui.chat.chatsettingsdrawer.allowModelsToInteractWithYouThroughInstalledCommands")}
        checked={conversationCommandsEnabled}
        onChange={(enabled) => updateMeta.mutate({ id: chat.id, characterCommands: enabled })}
        labelPosition="start"
        className={cn(
          "justify-between rounded-lg px-3 py-2.5 text-left",
          conversationCommandsEnabled
            ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
            : "bg-[var(--background)]/75 ring-1 ring-[var(--border)] hover:bg-[var(--accent)]",
        )}
        labelClassName="text-xs font-medium"
      />

      {conversationCommandsEnabled && (
        <div className="grid gap-2 @lg:grid-cols-2">
          {availableConversationCommandOptions.map((command) => {
            const enabled = isConversationCommandToggleOn(conversationCommandToggles, command.id);
            return (
              <SettingsSwitch
                key={command.id}
                label={command.labelKey ? localizeUi(command.labelKey) : command.label}
                description={
                  command.descriptionKey
                    ? localizeUi(command.descriptionKey, command.descriptionValues)
                    : command.description
                }
                checked={enabled}
                onChange={(nextEnabled) =>
                  updateMeta.mutate({
                    id: chat.id,
                    conversationCommandToggles: {
                      ...conversationCommandToggles,
                      [command.id]: nextEnabled,
                    },
                  })
                }
                labelPosition="start"
                className={cn(
                  "h-full min-h-[4.125rem] items-center justify-between rounded-lg px-3 py-2.5 text-left",
                  enabled
                    ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                    : "bg-[var(--background)]/75 ring-1 ring-[var(--border)] hover:bg-[var(--accent)]",
                )}
                labelClassName="text-[0.6875rem] font-medium"
              />
            );
          })}
        </div>
      )}
    </>
  );
}

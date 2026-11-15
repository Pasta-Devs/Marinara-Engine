// Connected chats in every mode. A Conversation links to a Roleplay or Game chat; a Roleplay or Game chat shows the
// Conversation linked to it, and only a Game chat can start the link from its own side.
import { useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { ArrowRightLeft, Link2, Plus, Unlink } from "lucide-react";
import { includesTextForMatch, isRoleplayCommandEnabled, type Chat, type ChatMode } from "@marinara-engine/shared";
import { useConnectChat, useDisconnectChat, useUpdateChatMetadata } from "../../../hooks/use-chats";
import { getConnectedChatDisplayName } from "../../../lib/chat-display";
import { cn } from "../../../lib/utils";
import { ChatModeIcon } from "../../../components/chat/ChatModeIcon";
import { SettingsSwitch } from "../../../components/panels/settings/SettingControls";
import { ChatSettingsSection } from "../ChatSettingsSection";
import { PickerDropdown } from "../PickerDropdown";
import { DiscordMirrorControls } from "./DiscordMirrorSection";

/** The chats each mode can link to from its own picker, with that picker's words. Roleplay has no picker. */
const LINK_PICKERS: Partial<Record<ChatMode, { modes: readonly ChatMode[]; label: string; placeholder: string }>> = {
  conversation: {
    modes: ["roleplay", "game"],
    label: "ui.chat.chatsettingsdrawer.linkToRoleplayOrGame",
    placeholder: "ui.chat.chatsettingsdrawer.searchRoleplayOrGameChats",
  },
  game: {
    modes: ["conversation"],
    label: "ui.chat.chatsettingsdrawer.linkToConversation",
    placeholder: "ui.chat.chatsettingsdrawer.searchConversationChats",
  },
};

function helpKey(chatMode: ChatMode, linked: boolean) {
  if (chatMode === "conversation")
    return "ui.chat.chatsettingsdrawer.controlAwarenessOfSiblingChatsOrLinkThisConversation";
  if (chatMode === "roleplay") return "ui.chat.chatsettingsdrawer.linkToAnOocConversationAndOptionallyLetRoleplay";
  return linked
    ? "ui.chat.chatsettingsdrawer.linkedToAConversationInfluenceTagsFromTheConversation"
    : "ui.chat.chatsettingsdrawer.linkThisGameToAnOocConversationTheConversation";
}

interface ConnectedChatsSectionProps {
  order: number;
  chat: Chat;
  metadata: Record<string, any>;
  chatMode: ChatMode;
  allChats: Chat[] | undefined;
  noodleInstalled: boolean;
  slurp2Installed: boolean;
}

export function ConnectedChatsSection({
  order,
  chat,
  metadata,
  chatMode,
  allChats,
  noodleInstalled,
  slurp2Installed,
}: ConnectedChatsSectionProps) {
  const { t: localizeUi } = useUiTranslation();
  const updateMeta = useUpdateChatMetadata();
  const connectChat = useConnectChat();
  const disconnectChat = useDisconnectChat();
  const [showConnectionPicker, setShowConnectionPicker] = useState(false);
  const [connectionSearch, setConnectionSearch] = useState("");
  // Package integrations only show while their package is installed and usable.
  const noodleTimelineContextEnabled = metadata.noodleTimelineContextEnabled === true;
  const slurp2ActivityContextEnabled = metadata.slurp2ActivityContextEnabled === true;
  const isConversation = chatMode === "conversation";
  const picker = LINK_PICKERS[chatMode];
  const linked = chat.connectedChatId ? (allChats ?? []).find((c: Chat) => c.id === chat.connectedChatId) : undefined;
  // A Conversation may be linked to either other mode, so it names the linked chat's mode; the other modes only
  // link to a Conversation.
  const linkedMode: ChatMode = isConversation
    ? linked?.mode === "conversation" || linked?.mode === "roleplay" || linked?.mode === "game"
      ? linked.mode
      : "roleplay"
    : "conversation";

  return (
    <ChatSettingsSection
      id={`${chatMode}-connected-chats`}
      style={{ order }}
      label={localizeUi("ui.chat.chatsettingsdrawer.connectedChats")}
      icon={<Link2 size="0.875rem" />}
      help={localizeUi(helpKey(chatMode, !!chat.connectedChatId))}
    >
      <div className="space-y-2">
        {chatMode === "conversation" && (
          <SettingsSwitch
            label={localizeUi("ui.chat.chatsettingsdrawer.crossChatAwareness")}
            description={localizeUi("ui.chat.chatsettingsdrawer.charactersKnowWhatHappensInTheirOtherChats")}
            checked={metadata.crossChatAwareness !== false}
            onChange={(crossChatAwareness) => updateMeta.mutate({ id: chat.id, crossChatAwareness })}
            labelPosition="start"
            className={cn(
              "justify-between rounded-md px-3 py-2.5 text-left",
              metadata.crossChatAwareness !== false
                ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
            )}
            labelClassName="text-xs font-medium"
          />
        )}
        {chatMode === "roleplay" && (
          <SettingsSwitch
            label={localizeUi("ui.chat.chatsettingsdrawer.allowCharacterDms")}
            description={localizeUi("roleplay.commands.dm.shortcutDescription")}
            checked={isRoleplayCommandEnabled(metadata, "dm")}
            onChange={(enabled) =>
              updateMeta.mutate({
                id: chat.id,
                ...(enabled ? { roleplayCommandsEnabled: true } : {}),
                roleplayCommandToggles: { ...metadata.roleplayCommandToggles, dm: enabled },
              })
            }
            labelPosition="start"
            className="min-h-11 justify-between rounded-md bg-[var(--secondary)] px-3 py-2.5 text-left"
            labelClassName="text-xs font-medium"
          />
        )}
        {chat.connectedChatId ? (
          <div className="flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-3 py-2 ring-1 ring-[var(--primary)]/30">
            {/* Only a Conversation marks a linked chat that no longer exists. */}
            {isConversation && !linked ? (
              <ArrowRightLeft size="0.875rem" className="text-[var(--primary)]" />
            ) : (
              <ChatModeIcon mode={linkedMode} size="0.875rem" className="text-[var(--primary)]" />
            )}
            <div className="min-w-0 flex-1">
              <span className="truncate text-xs font-medium">
                {linked ? getConnectedChatDisplayName(linked) : localizeUi("ui.chat.chatsettingsdrawer.unknownChat")}
              </span>
              <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                {!isConversation
                  ? localizeUi("settings.modes.conversation")
                  : linked
                    ? linkedMode === "roleplay"
                      ? localizeUi("settings.modes.roleplay")
                      : linkedMode
                    : localizeUi("ui.chat.chatsettingsdrawer.deleted")}
              </p>
            </div>
            <button
              onClick={() => disconnectChat.mutate(chat.id)}
              className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
              title={localizeUi("ui.agents.agenteditor.disconnect")}
            >
              <Unlink size="0.6875rem" />
            </button>
          </div>
        ) : !picker ? (
          <p className="rounded-lg bg-[var(--secondary)]/50 px-3 py-2 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.chatsettingsdrawer.noOocConversationIsLinkedDirectMessageCommandsCan")}
          </p>
        ) : !showConnectionPicker ? (
          <button
            onClick={() => {
              setShowConnectionPicker(true);
              setConnectionSearch("");
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
          >
            <Plus size="0.75rem" /> {localizeUi(picker.label)}
          </button>
        ) : (
          <PickerDropdown
            search={connectionSearch}
            onSearchChange={setConnectionSearch}
            onClose={() => setShowConnectionPicker(false)}
            placeholder={localizeUi(picker.placeholder)}
          >
            {((allChats ?? []) as Chat[])
              .filter(
                (c) =>
                  c.id !== chat.id &&
                  picker.modes.includes(c.mode) &&
                  !c.connectedChatId &&
                  includesTextForMatch(getConnectedChatDisplayName(c), connectionSearch),
              )
              .map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    connectChat.mutate({ chatId: chat.id, targetChatId: c.id });
                    setShowConnectionPicker(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--accent)]"
                >
                  <ChatModeIcon mode={c.mode} size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" />
                  <span className="truncate">{getConnectedChatDisplayName(c)}</span>
                </button>
              ))}
          </PickerDropdown>
        )}
        {noodleInstalled && (
          <SettingsSwitch
            label={localizeUi("ui.chat.chatsettingsdrawer.allowNoodleReferences")}
            description={localizeUi("ui.chat.chatsettingsdrawer.timelineRefreshesMayIncludeRecentMessagesFromThisChat")}
            checked={noodleTimelineContextEnabled}
            onChange={(checked) => updateMeta.mutate({ id: chat.id, noodleTimelineContextEnabled: checked })}
            labelPosition="start"
            className={cn(
              "justify-between rounded-md px-3 py-2.5 text-left",
              noodleTimelineContextEnabled
                ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
            )}
            labelClassName="text-[0.6875rem] font-medium"
          />
        )}
        {slurp2Installed && (
          <SettingsSwitch
            label={localizeUi("ui.chat.chatsettingsdrawer.allowSlurpActivity")}
            description={localizeUi("ui.chat.chatsettingsdrawer.allowSlurpActivityDescription")}
            checked={slurp2ActivityContextEnabled}
            onChange={(checked) => updateMeta.mutate({ id: chat.id, slurp2ActivityContextEnabled: checked })}
            labelPosition="start"
            className={cn(
              "justify-between rounded-md px-3 py-2.5 text-left",
              slurp2ActivityContextEnabled
                ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
            )}
            labelClassName="text-[0.6875rem] font-medium"
          />
        )}
        <DiscordMirrorControls
          webhookUrl={(metadata.discordWebhookUrl as string) ?? ""}
          onWebhookUrlChange={(discordWebhookUrl) => updateMeta.mutate({ id: chat.id, discordWebhookUrl })}
        />
      </div>
    </ChatSettingsSection>
  );
}

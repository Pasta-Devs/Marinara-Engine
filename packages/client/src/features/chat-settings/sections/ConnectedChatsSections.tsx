// The Connected chats section in each chat mode, plus Notes from Conversation. Moved from the drawer as they were:
// four near-copies, one per mode (Game has a linked and an unlinked one). Merging them is a separate step.
import { useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { ArrowRightLeft, Link2, Plus, Unlink } from "lucide-react";
import { includesTextForMatch, isRoleplayCommandEnabled, type Chat } from "@marinara-engine/shared";
import { useConnectChat, useDisconnectChat, useUpdateChatMetadata } from "../../../hooks/use-chats";
import { getConnectedChatDisplayName } from "../../../lib/chat-display";
import { cn } from "../../../lib/utils";
import { ChatModeIcon } from "../../../components/chat/ChatModeIcon";
import { SettingsSwitch } from "../../../components/panels/settings/SettingControls";
import { ChatSettingsSection } from "../ChatSettingsSection";
import { PickerDropdown } from "../PickerDropdown";
import { DiscordMirrorControls } from "./DiscordMirrorSection";
import { ConversationNotesSection } from "./ConversationNotesSection";

interface ConnectedChatsSectionsProps {
  order: number;
  notesOrder: number;
  chat: Chat;
  metadata: Record<string, any>;
  chatMode: string;
  isConversation: boolean;
  isRoleplayMode: boolean;
  isGame: boolean;
  allChats: Chat[] | undefined;
  noodleInstalled: boolean;
  slurp2Installed: boolean;
}

export function ConnectedChatsSections({
  order,
  notesOrder,
  chat,
  metadata,
  chatMode,
  isConversation,
  isRoleplayMode,
  isGame,
  allChats,
  noodleInstalled,
  slurp2Installed,
}: ConnectedChatsSectionsProps) {
  const { t: localizeUi } = useUiTranslation();
  const updateMeta = useUpdateChatMetadata();
  const connectChat = useConnectChat();
  const disconnectChat = useDisconnectChat();
  const [showConnectionPicker, setShowConnectionPicker] = useState(false);
  const [connectionSearch, setConnectionSearch] = useState("");
  // Package integrations only show while their package is installed and usable.
  const noodleTimelineContextEnabled = metadata.noodleTimelineContextEnabled === true;
  const slurp2ActivityContextEnabled = metadata.slurp2ActivityContextEnabled === true;
  const renderPackageContextToggles = () => (
    <>
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
    </>
  );

  return (
    <>
      {/* Connected Roleplay — conversation mode: link to a roleplay or game chat */}
      {isConversation && (
        <ChatSettingsSection
          id="conversation-connected-chats"
          style={{ order }}
          label={localizeUi("ui.chat.chatsettingsdrawer.connectedChats")}
          icon={<Link2 size="0.875rem" />}
          help={localizeUi("ui.chat.chatsettingsdrawer.controlAwarenessOfSiblingChatsOrLinkThisConversation")}
        >
          <div className="space-y-2">
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
            {chat.connectedChatId ? (
              (() => {
                const linked = (allChats ?? []).find((c: Chat) => c.id === chat.connectedChatId);
                const linkedMode =
                  linked?.mode === "conversation" || linked?.mode === "roleplay" || linked?.mode === "game"
                    ? linked.mode
                    : "roleplay";
                return (
                  <div className="flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-3 py-2 ring-1 ring-[var(--primary)]/30">
                    {linked ? (
                      <ChatModeIcon mode={linkedMode} size="0.875rem" className="text-[var(--primary)]" />
                    ) : (
                      <ArrowRightLeft size="0.875rem" className="text-[var(--primary)]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="truncate text-xs font-medium">
                        {linked
                          ? getConnectedChatDisplayName(linked)
                          : localizeUi("ui.chat.chatsettingsdrawer.unknownChat")}
                      </span>
                      <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                        {linked
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
                );
              })()
            ) : !showConnectionPicker ? (
              <button
                onClick={() => {
                  setShowConnectionPicker(true);
                  setConnectionSearch("");
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
              >
                <Plus size="0.75rem" /> {localizeUi("ui.chat.chatsettingsdrawer.linkToRoleplayOrGame")}
              </button>
            ) : (
              <PickerDropdown
                search={connectionSearch}
                onSearchChange={setConnectionSearch}
                onClose={() => setShowConnectionPicker(false)}
                placeholder={localizeUi("ui.chat.chatsettingsdrawer.searchRoleplayOrGameChats")}
              >
                {((allChats ?? []) as Chat[])
                  .filter(
                    (c) =>
                      c.id !== chat.id &&
                      (c.mode === "roleplay" || c.mode === "game") &&
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
            {renderPackageContextToggles()}
            <DiscordMirrorControls
              webhookUrl={(metadata.discordWebhookUrl as string) ?? ""}
              onWebhookUrlChange={(discordWebhookUrl) => updateMeta.mutate({ id: chat.id, discordWebhookUrl })}
            />
          </div>
        </ChatSettingsSection>
      )}

      {/* Connected Conversation — roleplay mode: linked OOC chat + optional in-world DM command */}
      {isRoleplayMode && (
        <ChatSettingsSection
          id="roleplay-connected-chats"
          style={{ order }}
          label={localizeUi("ui.chat.chatsettingsdrawer.connectedChats")}
          icon={<Link2 size="0.875rem" />}
          help={localizeUi("ui.chat.chatsettingsdrawer.linkToAnOocConversationAndOptionallyLetRoleplay")}
        >
          <div className="space-y-2">
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
            {chat.connectedChatId ? (
              (() => {
                const linked = (allChats ?? []).find((c: Chat) => c.id === chat.connectedChatId);
                return (
                  <div className="flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-3 py-2 ring-1 ring-[var(--primary)]/30">
                    <ChatModeIcon mode="conversation" size="0.875rem" className="text-[var(--primary)]" />
                    <div className="flex-1 min-w-0">
                      <span className="truncate text-xs font-medium">
                        {linked
                          ? getConnectedChatDisplayName(linked)
                          : localizeUi("ui.chat.chatsettingsdrawer.unknownChat")}
                      </span>
                      <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                        {localizeUi("settings.modes.conversation")}
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
                );
              })()
            ) : (
              <p className="rounded-lg bg-[var(--secondary)]/50 px-3 py-2 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                {localizeUi("ui.chat.chatsettingsdrawer.noOocConversationIsLinkedDirectMessageCommandsCan")}
              </p>
            )}

            {renderPackageContextToggles()}

            <DiscordMirrorControls
              className="space-y-2"
              webhookUrl={(metadata.discordWebhookUrl as string) ?? ""}
              onWebhookUrlChange={(discordWebhookUrl) => updateMeta.mutate({ id: chat.id, discordWebhookUrl })}
            />
          </div>
        </ChatSettingsSection>
      )}

      {/* Connected Conversation — game mode: show linked OOC chat */}
      {isGame && chat.connectedChatId && (
        <ChatSettingsSection
          id="game-connected-chats"
          style={{ order }}
          label={localizeUi("ui.chat.chatsettingsdrawer.connectedChats")}
          icon={<Link2 size="0.875rem" />}
          help={localizeUi("ui.chat.chatsettingsdrawer.linkedToAConversationInfluenceTagsFromTheConversation")}
        >
          <div className="space-y-2">
            {(() => {
              const linked = (allChats ?? []).find((c: Chat) => c.id === chat.connectedChatId);
              return (
                <div className="flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-3 py-2 ring-1 ring-[var(--primary)]/30">
                  <ChatModeIcon mode="conversation" size="0.875rem" className="text-[var(--primary)]" />
                  <div className="min-w-0 flex-1">
                    <span className="truncate text-xs font-medium">
                      {linked
                        ? getConnectedChatDisplayName(linked)
                        : localizeUi("ui.chat.chatsettingsdrawer.unknownChat")}
                    </span>
                    <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                      {localizeUi("settings.modes.conversation")}
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
              );
            })()}
            {renderPackageContextToggles()}
            <DiscordMirrorControls
              webhookUrl={(metadata.discordWebhookUrl as string) ?? ""}
              onWebhookUrlChange={(discordWebhookUrl) => updateMeta.mutate({ id: chat.id, discordWebhookUrl })}
            />
          </div>
        </ChatSettingsSection>
      )}

      {/* Notes from Conversation — durable notes saved by the connected conversation's character */}
      {!isConversation && chat.connectedChatId && (
        <div style={{ order: notesOrder }}>
          <ConversationNotesSection chatId={chat.id} />
        </div>
      )}

      {/* Connect to Conversation — game mode without existing link */}
      {chatMode === "game" && !chat.connectedChatId && (
        <ChatSettingsSection
          id="game-connected-chats"
          style={{ order }}
          label={localizeUi("ui.chat.chatsettingsdrawer.connectedChats")}
          icon={<Link2 size="0.875rem" />}
          help={localizeUi("ui.chat.chatsettingsdrawer.linkThisGameToAnOocConversationTheConversation")}
        >
          <div className="space-y-2">
            {!showConnectionPicker ? (
              <button
                onClick={() => {
                  setShowConnectionPicker(true);
                  setConnectionSearch("");
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
              >
                <Plus size="0.75rem" /> {localizeUi("ui.chat.chatsettingsdrawer.linkToConversation")}
              </button>
            ) : (
              <PickerDropdown
                search={connectionSearch}
                onSearchChange={setConnectionSearch}
                onClose={() => setShowConnectionPicker(false)}
                placeholder={localizeUi("ui.chat.chatsettingsdrawer.searchConversationChats")}
              >
                {((allChats ?? []) as Chat[])
                  .filter(
                    (c) =>
                      c.id !== chat.id &&
                      c.mode === "conversation" &&
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
                      <ChatModeIcon
                        mode="conversation"
                        size="0.75rem"
                        className="shrink-0 text-[var(--muted-foreground)]"
                      />
                      <span className="truncate">{getConnectedChatDisplayName(c)}</span>
                    </button>
                  ))}
              </PickerDropdown>
            )}
            {renderPackageContextToggles()}
            <DiscordMirrorControls
              webhookUrl={(metadata.discordWebhookUrl as string) ?? ""}
              onWebhookUrlChange={(discordWebhookUrl) => updateMeta.mutate({ id: chat.id, discordWebhookUrl })}
            />
          </div>
        </ChatSettingsSection>
      )}
    </>
  );
}

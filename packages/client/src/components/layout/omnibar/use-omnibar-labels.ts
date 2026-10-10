import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Chat } from "@marinara-engine/shared";
import type { CommandCenterCategoryFilter, CommandCenterResultGroupId } from "../../../lib/command-center";
import type {
  CommandCenterCategoryLabels,
  CommandCenterChatModeLabels,
} from "../../command-center/command-center-visuals";

/** Every fixed label the omnibar shows: the idle greeting, categories, chat modes, filters, groups and context reasons. */
export function useOmnibarLabels(activeChat: Chat | null, activeChatId: string | null) {
  const { t } = useTranslation();
  const idleGreeting = useMemo(() => {
    if (!activeChat) return t("omnibar.hello", "Hi, I'm Professor Mari. Type to search, or ask me anything.");

    const greetings =
      activeChat.mode === "roleplay"
        ? [
            t("omnibar.greetings.roleplay.one", "What should we look into in this roleplay?"),
            t("omnibar.greetings.roleplay.two", "Your roleplay is open. What do you need?"),
            t("omnibar.greetings.roleplay.three", "This roleplay is open. What would you like to find?"),
          ]
        : activeChat.mode === "conversation"
          ? [
              t("omnibar.greetings.conversation.one", "What should we look into in this conversation?"),
              t("omnibar.greetings.conversation.two", "Your conversation is open. What do you need?"),
              t("omnibar.greetings.conversation.three", "This chat is open. What would you like to find?"),
            ]
          : [
              t("omnibar.greetings.chat.one", "What should we look into in this chat?"),
              t("omnibar.greetings.chat.two", "Your chat is open. What do you need?"),
              t("omnibar.greetings.chat.three", "A chat is open. What would you like to find?"),
            ];

    const seed = activeChatId ? [...activeChatId].reduce((sum, character) => sum + character.charCodeAt(0), 0) : 0;
    return greetings[seed % greetings.length];
  }, [activeChat, activeChatId, t]);

  const categoryLabels = useMemo<CommandCenterCategoryLabels>(
    () => ({
      navigation: t("omnibar.categories.navigation", "Navigation"),
      chat: t("omnibar.categories.chat", "Chats"),
      character: t("omnibar.categories.character", "Characters"),
      persona: t("omnibar.categories.persona", "Personas"),
      lorebook: t("omnibar.categories.lorebook", "Lorebooks"),
      preset: t("omnibar.categories.preset", "Presets"),
      connection: t("omnibar.categories.connection", "Connections"),
      agent: t("omnibar.categories.agent", "Agents"),
      settings: t("omnibar.categories.settings", "Settings"),
      professor: t("omnibar.categories.professor", "Professor Mari"),
      docs: t("omnibar.categories.docs", "Docs"),
    }),
    [t],
  );
  const chatModeLabels = useMemo<CommandCenterChatModeLabels>(
    () => ({
      conversation: t("home.recentChats.mode.conversation", "Conversation"),
      roleplay: t("home.recentChats.mode.roleplay", "Roleplay"),
      game: t("home.recentChats.mode.game", "Game"),
    }),
    [t],
  );
  const filterLabels = useMemo<Record<CommandCenterCategoryFilter, string>>(
    () => ({
      all: t("commandCenter.filters.all", "All"),
      chats: t("commandCenter.filters.chats", "Chats"),
      characters: t("commandCenter.filters.characters", "Characters"),
      personas: t("commandCenter.filters.personas", "Personas"),
      lorebooks: t("commandCenter.filters.lorebooks", "Lorebooks"),
      presets: t("commandCenter.filters.presets", "Presets"),
      connections: t("commandCenter.filters.connections", "Connections"),
      agents: t("commandCenter.filters.agents", "Agents"),
      settings: t("commandCenter.filters.settings", "Settings"),
      docs: t("commandCenter.filters.docs", "Docs"),
    }),
    [t],
  );
  const groupLabels = useMemo<Record<CommandCenterResultGroupId, string>>(
    () => ({
      now: t("commandCenter.groups.now", "Needs you now"),
      try: t("commandCenter.groups.try", "Try"),
      context: t("commandCenter.groups.context", "On this screen"),
      "current-work": t("commandCenter.groups.currentWork", "Current work"),
      continue: t("commandCenter.groups.continue", "Continue"),
      frecent: t("commandCenter.groups.frecent", "Frequently used here"),
      recent: t("commandCenter.groups.recent", "Recent"),
      "quick-controls": t("commandCenter.groups.quickControls", "Quick controls"),
      "create-navigation": t("commandCenter.groups.suggested", "Suggested"),
      navigation: t("commandCenter.groups.navigation", "Navigation"),
      messages: t("commandCenter.groups.messages", "Messages"),
      "lorebook-entries": t("commandCenter.groups.lorebookEntries", "Lorebook entries"),
      chats: filterLabels.chats,
      characters: filterLabels.characters,
      personas: filterLabels.personas,
      lorebooks: filterLabels.lorebooks,
      presets: filterLabels.presets,
      connections: filterLabels.connections,
      agents: filterLabels.agents,
      settings: filterLabels.settings,
      docs: filterLabels.docs,
      "professor-suggested": t("commandCenter.groups.mariSuggested", "Professor Mari"),
      "top-hit": t("commandCenter.groups.topHit", "Top hit"),
      "professor-fallback": t("commandCenter.groups.askMari", "Ask Professor Mari"),
    }),
    [filterLabels, t],
  );

  const contextLabels = useMemo(
    () => ({
      surface: t("commandCenter.context.currentSurface", "On this screen"),
      "open-resource": t("commandCenter.context.openResource", "Open now"),
      "active-chat": t("commandCenter.context.activeChat", "Used by this chat"),
      "settings-target": t("commandCenter.context.settingsTarget", "Current setting"),
      dirty: t("commandCenter.context.unsaved", "Open with unsaved changes"),
      setup: t("commandCenter.context.setup", "Setup available"),
      error: t("commandCenter.context.error", "Related to a current error"),
      recent: t("commandCenter.context.recent", "Recently used"),
    }),
    [t],
  );
  return { idleGreeting, categoryLabels, chatModeLabels, filterLabels, groupLabels, contextLabels };
}

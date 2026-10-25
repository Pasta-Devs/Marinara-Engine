import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useApplyChatPreset, useChatPresets } from "./use-chat-presets";
import { useCreateChat } from "./use-chats";
import { connectionListQuery, useConnections } from "./use-connections";
import { useChatStore } from "../stores/chat.store";
import { isMobileShellViewport, useUIStore } from "../stores/ui.store";
import { CHAT_MODE_OPTIONS, type ChatLaunchMode } from "../components/chat/ChatModeSelectorModal";

/**
 * The non-multiplayer half of `HomeNewChatLauncher`'s `selectMode`, pulled out
 * so the omnibar's "New conversation/roleplay/game" commands start the exact
 * same chat instead of a second copy of this logic. Returns a promise (via
 * `mutateAsync`, not `mutate`) so a caller that closes its own UI right after
 * — the omnibar does — can await it first: closing unmounts this hook's
 * `useCreateChat` instance, and a mutate-level `onSuccess` queued on a
 * mutation whose owning component has already unmounted never runs.
 */
export function useStartNewChatMode() {
  const { t: localizeUi } = useUiTranslation();
  const queryClient = useQueryClient();
  // Starts loading the connection list as soon as the buttons show.
  useConnections();
  const { data: chatPresetsData } = useChatPresets();
  const createChat = useCreateChat();
  const applyChatPreset = useApplyChatPreset();
  const launchInFlight = useRef(false);

  return async (mode: ChatLaunchMode) => {
    // Right after Home opens (slowest on phones, the APK and Termux) the list can still be loading, which is not
    // the same as having no connections, so wait for it. Taps while loading the list or creating the chat are
    // ignored, so a second tap can't make a second chat. A list that fails to load counts as no connections.
    if (launchInFlight.current) return;
    launchInFlight.current = true;
    try {
      const connections = await queryClient.fetchQuery(connectionListQuery).catch(() => []);
      const connectionRows = (connections as Array<{ id: string }>).filter((connection) => !!connection.id);
      const store = useChatStore.getState();
      if (connectionRows.length === 0) {
        store.setPendingNewChatMode(mode, "home");
        return;
      }

      const presets = chatPresetsData ?? [];
      const presetMode = mode === "conversation" || mode === "roleplay" ? mode : null;
      const starred = presetMode
        ? (presets.find((preset) => preset.mode === presetMode && preset.isActive && !preset.isDefault) ?? null)
        : null;
      const modeLabel = localizeUi(CHAT_MODE_OPTIONS.find((option) => option.mode === mode)?.labelKey ?? mode);
      const chat = await createChat.mutateAsync({
        name: localizeUi("home.newChat.defaultName", { mode: modeLabel }),
        mode,
        characterIds: [],
        connectionId: starred?.settings.connectionId ?? undefined,
        promptPresetId: starred?.settings.promptPresetId ?? undefined,
      });
      // On the phone shell the sidebar is the full-screen Chats sheet, so
      // opening it here would cover the wizard about to open (O4 item 5); on
      // desktop it stays open the way starting a chat from the sidebar "+"
      // already left it.
      useUIStore.getState().setSidebarOpen(!isMobileShellViewport());
      store.setActiveChatId(chat.id);
      store.setShouldOpenSettings(true);
      store.setShouldOpenWizard(true);
      if (starred) {
        void applyChatPreset
          .mutateAsync({ presetId: starred.id, chatId: chat.id, initialSetupProfile: starred })
          .catch(() => {
            /* Non-fatal: the setup wizard still opens with system defaults. */
          });
      }
    } finally {
      launchInFlight.current = false;
    }
  };
}

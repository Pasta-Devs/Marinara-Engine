import { useTranslation as useUiTranslation } from "react-i18next";
import { useApplyChatPreset, useChatPresets } from "./use-chat-presets";
import { useCreateChat } from "./use-chats";
import { useConnections } from "./use-connections";
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
  const { data: connections } = useConnections();
  const { data: chatPresetsData } = useChatPresets();
  const createChat = useCreateChat();
  const applyChatPreset = useApplyChatPreset();

  return async (mode: ChatLaunchMode) => {
    const connectionRows = ((connections ?? []) as Array<{ id: string }>).filter((connection) => !!connection.id);
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
      void applyChatPreset.mutateAsync({ presetId: starred.id, chatId: chat.id }).catch(() => {
        /* Non-fatal: the setup wizard still opens with system defaults. */
      });
    }
  };
}

import { useState, type CSSProperties, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useApplyChatPreset, useChatPresets } from "../../hooks/use-chat-presets";
import { useCreateChat } from "../../hooks/use-chats";
import { useConnections } from "../../hooks/use-connections";
import { useChatStore } from "../../stores/chat.store";
import { useUIStore } from "../../stores/ui.store";
import { cn } from "../../lib/utils";
import { HOME_CHAT_MODE_ACCENTS } from "../../lib/home-chat-mode-style";
import { CHAT_MODE_OPTIONS, ChatModeSelectorModal, type ChatLaunchMode } from "./ChatModeSelectorModal";

type HomeNewChatLauncherProps = {
  mode?: ChatLaunchMode;
  className?: string;
  children?: ReactNode;
  ariaLabel?: string;
};

/** Creates a chat in `mode` with the starred settings profile, or opens the connection gate when none exist. */
export function useLaunchNewChat() {
  const { t: localizeUi } = useUiTranslation();
  const { data: connections } = useConnections();
  const { data: chatPresetsData } = useChatPresets();
  const createChat = useCreateChat();
  const applyChatPreset = useApplyChatPreset();

  const launch = (mode: ChatLaunchMode) => {
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
    createChat.mutate(
      {
        name: localizeUi("home.newChat.defaultName", { mode: modeLabel }),
        mode,
        characterIds: [],
        connectionId: starred?.settings.connectionId ?? undefined,
        promptPresetId: starred?.settings.promptPresetId ?? undefined,
      },
      {
        onSuccess: (chat) => {
          useUIStore.getState().setSidebarOpen(true);
          store.setActiveChatId(chat.id);
          store.setShouldOpenSettings(true);
          store.setShouldOpenWizard(true);
          if (starred) {
            void applyChatPreset.mutateAsync({ presetId: starred.id, chatId: chat.id }).catch(() => {
              /* Non-fatal: the setup wizard still opens with system defaults. */
            });
          }
        },
      },
    );
  };

  return { launch, isPending: createChat.isPending };
}

export function HomeNewChatLauncher({ mode, className, children, ariaLabel }: HomeNewChatLauncherProps = {}) {
  const { t: localizeUi } = useUiTranslation();
  const [selectorOpen, setSelectorOpen] = useState(false);
  const { launch, isPending } = useLaunchNewChat();

  const selectMode = (mode: ChatLaunchMode) => {
    setSelectorOpen(false);
    launch(mode);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => (mode ? selectMode(mode) : setSelectorOpen(true))}
        data-home-chat-mode={mode}
        style={mode ? ({ "--home-chat-mode-accent": HOME_CHAT_MODE_ACCENTS[mode] } as CSSProperties) : undefined}
        className={cn(
          "mari-chrome-control mari-chrome-control--small h-8 px-3 py-0 text-xs",
          mode &&
            "hover:!border-[color-mix(in_srgb,var(--home-chat-mode-accent)_66%,var(--border))] hover:!shadow-[0_10px_24px_-16px_var(--home-chat-mode-accent)] focus-visible:!ring-[var(--home-chat-mode-accent)] active:!border-[var(--home-chat-mode-accent)]",
          className,
        )}
        aria-label={ariaLabel}
      >
        {children ?? (
          <>
            <Plus size="0.75rem" />
            {localizeUi("home.actions.newChat")}
          </>
        )}
      </button>

      {!mode ? (
        <ChatModeSelectorModal
          open={selectorOpen}
          onClose={() => setSelectorOpen(false)}
          onSelectMode={selectMode}
          isPending={isPending}
        />
      ) : null}
    </>
  );
}

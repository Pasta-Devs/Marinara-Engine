import { useState, type CSSProperties, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useMultiplayerMutation } from "../../hooks/use-multiplayer";
import { useCreateChat } from "../../hooks/use-chats";
import { useStartNewChatMode } from "../../hooks/use-start-new-chat-mode";
import { useChatStore } from "../../stores/chat.store";
import { cn } from "../../lib/utils";
import { HOME_CHAT_MODE_ACCENTS } from "../../lib/home-chat-mode-style";
import { showAlertDialog } from "../../lib/app-dialogs";
import { ChatModeSelectorModal, type ChatLaunchMode } from "./ChatModeSelectorModal";

type HomeNewChatLauncherProps = {
  mode?: ChatLaunchMode;
  className?: string;
  children?: ReactNode;
  ariaLabel?: string;
};

export function HomeNewChatLauncher({ mode, className, children, ariaLabel }: HomeNewChatLauncherProps = {}) {
  const { t: localizeUi } = useUiTranslation();
  const [selectorOpen, setSelectorOpen] = useState(false);
  const createChat = useCreateChat();
  const startNewChatMode = useStartNewChatMode();
  const createShared = useMultiplayerMutation<{ chatId: string }, { name: string; mode: ChatLaunchMode }>(
    "/multiplayer/prepare",
  );

  const selectMode = (mode: ChatLaunchMode, playTogether = false) => {
    setSelectorOpen(false);
    if (playTogether) {
      createShared.mutate(
        { name: localizeUi("multiplayer.defaultName"), mode },
        {
          onSuccess: (result) => useChatStore.getState().setActiveChatId(result.chatId),
          onError: () => void showAlertDialog({ message: localizeUi("multiplayer.actionFailed") }),
        },
      );
      return;
    }
    void startNewChatMode(mode).catch(() => {
      /* The create mutation's own onError already surfaces a toast. */
    });
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
          showPlayTogether
          open={selectorOpen}
          onClose={() => setSelectorOpen(false)}
          onSelectMode={selectMode}
          isPending={createChat.isPending || createShared.isPending}
        />
      ) : null}
    </>
  );
}

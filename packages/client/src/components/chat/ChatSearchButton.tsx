import { Search } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useChatStore } from "../../stores/chat.store";
import { getChatToolbarButtonClass } from "./ChatToolbarControls";

interface ChatSearchButtonProps {
  compact?: boolean;
}

/**
 * Toolbar trigger for "Find in chat".
 *
 * Self-contained on purpose: it reads the active chat from the store rather
 * than taking props, so it can be dropped into any of the chat toolbar
 * clusters without threading state through the surfaces.
 */
export function ChatSearchButton({ compact }: ChatSearchButtonProps) {
  const { t } = useUiTranslation();
  const activeChatId = useChatStore((s) => s.activeChatId);
  const open = useChatStore((s) => s.chatSearchOpen);
  const openChatSearch = useChatStore((s) => s.openChatSearch);
  const closeChatSearch = useChatStore((s) => s.closeChatSearch);

  if (!activeChatId) return null;

  const label = t("chat.search.open");

  return (
    <button
      type="button"
      onClick={() => (open ? closeChatSearch() : openChatSearch())}
      className={getChatToolbarButtonClass({ active: open, compact })}
      title={label}
      aria-label={label}
      aria-expanded={open}
      data-chat-search-trigger
    >
      <Search size="0.875rem" />
    </button>
  );
}
